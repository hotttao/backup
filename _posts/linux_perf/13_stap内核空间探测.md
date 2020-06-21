---
title: 3.3 Systemtap 内核空间探测
date: 2020-01-10
categories:
    - 运维
tags:
    - Linux性能调优
---

本节我们继续来学习 Systemtap 的使用 -- 内核的动态追踪

<!-- more -->

![stap_flow_diagram](/images/linux_pf/stap_flow_diagram.png)

## 1. 内核变量的获取
本节我们来看如何获取内核空间中的变量，包括:
1. 目标变量获取
2. 全局以及静态变量获取
3. 内置的便捷变量

## 2. 内核变量获取
跟内核代码相关的事件，如kernel.function("function")和kernel.statement("statement")，允许使用目标变量获取这部分代码中可访问到的变量的值。`stap -L` 可以列出特定探测点下可用的目标变量。

```bash
> stap -L `kernel.function("vfs_read")`
kernel.function("vfs_read@fs/read_write.c:277") $file:struct file* $buf:char* $count:size_t $pos:loff_t*
```
`stap -L` 输出的每个目标变量前面都以$开头，并以:加变量类型结尾。上面的输出表示，vfs_read函数入口处有4个变量可用:
1. $file（指向描述文件的结构体）
2. $buf（指向接收读取的数据的用户空间缓冲区）
3. $count（读取的字节数）
4. $pos（读开始的位置）

下面使用目标变量的一个示例:
```bash
> stap -L 'syscall.read'
stap -L 'syscall.read'
syscall.read name:string fd:long buf_uaddr:long count:long argstr:string $fd:long int $buf:long int $count:long int $ret:long int


probe syscall.read.return {
  p = pid()
  fd = $fd                   # 引用目标变量
  bytes = $return
  time = gettimeofday_us() - @entry(gettimeofday_us())
  if (bytes > 0)
    fileread[p, fd] += bytes
  time_io[p, fd] <<< time
}

```

## 2.全局变量获取
对于那些不属于本地变量的变量，像是全局变量或一个在文件中定义的静态变量，可以用`@var("varname@src/file.c")`获取。 SystemTap会保留目标变量的类型信息，并且允许通过`->`访问其中的成员。

`->`既可以用来访问指针指向的值，也可以用来访问子结构体中的成员。在获取复杂结构体中的信息时，`->`可以链式使用。下面是一个获取 `fs/file_table.c`中的静态目标变量`files_stat` 的示例，files_stat存储着一些当前文件系统中可调节的参数。

```bash
probe kernel.function(vfs_read) {
    printf("current file_stat max_files: %d\n", 
            @var("file_stat@fs/file_table.c")->max_files)
            exit()
}
```

有许多函数可以通过指向基本类型的指针获取内核空间对应地址上的数据：
|函数|作用|
|:---|:---|
|kernel_char(address)|从内核空间地址中获取char变量|
|kernel_short(address)||
|kernel_long(address)||
|kernel_int(address)||
|kernel_string(address)||
|kernel_string_n(address, n)|从内核空间地址中获取长为n的字符串|

## 3. 内置变量
某些场景中，我们可能需要输出当前可访问的各种变量，以便于记录底层的变化。SystemTap提供了一些操作，可以生成描述特定目标变量的字符串：
1. `$$vars`: 
    - 输出作用域内每个变量的值
    - 等同于 `sprintf("parm1=%x ... parmN=%x var1=%x ... varN=%x", parm1, ..., parmN, var1, ..., varN)`
2. `$$locals`: 同$$vars，只输出本地变量
3. `$$parms`: 同$$vars，只输出函数入参。
4. `$$return`: 
    - 仅在带return的探针中可用
    - 如果被监控的函数有返回值，它等价于sprintf("return=%x", $return)，否则为空字符串。

```bash
> stap -e 'probe kernel.function("vfs_read") {printf("%s\n", $$parms); exit(); }'

# vfs_read的入参有四个：file，buf，count，和pos
# $$params会给这些入参生成描述字符串。在这个例子里，四个变量都是指针
file=0xffff8800b40d4c80 buf=0x7fff634403e0 count=0x2004 pos=0xffff8800af96df48

# 要想输出指针指向的值，我们可以加上$后缀
> stap -e 'probe kernel.function("vfs_read") {printf("%s\n", $$parms$); exit(); }'
file={.f_u={...}, .f_path={...}, .f_op=0xffffffffa06e1d80, .f_lock={...}, ....

# 要想展开嵌套的结构体，你需要使用$$后缀。下面是一个使用$$的例子：
# $$的输出，会受到字符串最长长度的限制而被截断
> stap -e 'probe kernel.function("vfs_read") {printf("%s\n", $$parms$$); exit(); }'
```

## 4. 如何使用 tapset
tapset 是 systemtap 提供的函数库，提供了:
1. 可用的内置函数
2. 对于常见的目标变量，已将其提取为直接可用的内置变量。

我们以 ioblock 为例，来看看如何使用 tapset。

```c
> /usr/share/systemtap/tapset/linux/ioblock.stp
/**
 *  probe ioblock.request - Fires whenever making a generic block I/O request.
 *
 *  @name      - name of the probe point
 *  @devname   - block device name
 *  @ino       - i-node number of the mapped file
 *  @sector    - beginning sector for the entire bio
 *  @flags     - see below
 *  	BIO_UPTODATE    0       ok after I/O completion
 *  	BIO_RW_BLOCK    1       RW_AHEAD set, and read/write would block
 *  	BIO_EOF         2       out-out-bounds error
 *  	BIO_SEG_VALID   3       nr_hw_seg valid 
 *  	BIO_CLONED      4       doesn't own data
 *  	BIO_BOUNCED     5       bio is a bounce bio
 *  	BIO_USER_MAPPED 6       contains user pages
 *  	BIO_EOPNOTSUPP  7       not supported
 *  
 *  @rw        - binary trace for read/write request
 *  @vcnt      - bio vector count which represents number of array element (page, offset, length) which make up this I/O request
 *  @idx       - offset into the bio vector array
 *  @phys_segments - number of segments in this bio after physical address coalescing is performed
 *  @hw_segments -   number of segments after physical and DMA remapping hardware coalescing is performed
 *  @size      - total size in bytes
 *  @bdev      - target block device
 *  @bdev_contains - points to the device object which contains the partition (when bio structure represents a partition)
 *  @p_start_sect -  points to the start sector of the partition structure of the device
 *
 * Context:
 *  The process makes block I/O request
 */
probe ioblock.request = kernel.function ("generic_make_request")
{
	name = "ioblock.request"
        devname = __bio_devname($bio)
        ino = __bio_ino($bio)

        sector = $bio->bi_sector
        flags = $bio->bi_flags
        rw = $bio->bi_rw
        vcnt = $bio->bi_vcnt
        idx = $bio->bi_idx
        phys_segments = $bio->bi_phys_segments
	hw_segments = (@defined($bio->bi_hw_segments)
		       ? $bio->bi_hw_segments : 0)
        size = $bio->bi_size

        bdev = $bio->bi_bdev
        bdev_contains = $bio->bi_bdev->bd_contains
        p_start_sect = __bio_start_sect($bio)
}
```

说明:
1. 上面是 ioblock.stp 内容的一部分
2. `probe ioblock.request` 将常用的目标变量定义成了直接可用内部变量，eg: 通过 devname，我们可以直接获取设备名称，而不需要通过目标变量去获取
3. `__bio_ino` 是 ioblock.stap 内定义的函数，但是 `__` 开头的属于内置函数不能使用。

```bash
stap -ve 'probe ioblock.request {printf("%s,%s\n", "devname: ", devname)}'
```

