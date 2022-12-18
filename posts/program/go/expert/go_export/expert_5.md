---
weight: 1
title: "Go 语言的复合数据类型"
date: 2022-12-16T22:00:00+08:00
lastmod: 2022-12-16T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "这个系列我们开始学习 go 语言的第二部分-go语言进阶"
featuredImage: 

tags: ["go 进阶"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

 今天我们开始深入学习，Go 语言语法的复合数据类型: slice、map、string
<!-- more -->

## 1. slice
slice 动态数组，可以自动对数组进行扩缩容。

### 1.1 切片的初始化和操作
声明和初始化切片有如下几种方式:

```go
// 1. 变量声明
var s []int // s 为 nil 未分配空间

// 2. 字面量
s := []int{}
s := []int{1, 2, 3}

// 3. make
s := make([]int, 2, 100)

// 4. 切片
array := [5]int{1, 2, 3, 4, 5}
s := array[0:2:5]
```

内置函数 append() 用于向切片中追加元素:

```go
s := make([]int, 9)
s = append(s, 1)
s = append(s, 2, 3, 4)
s = append(s []int{5, 6}...)
```
### 1.2 slice 实现
slice 定义在 src/runtime/slice.go 中，由 makeslice 函数创建:

```go
type slice struct {
	array unsafe.Pointer // 指向底层数组
	len   int
	cap   int
}

func makeslice(et *_type, len, cap int) unsafe.Pointer {
	mem, overflow := math.MulUintptr(et.size, uintptr(cap))
	if overflow || mem > maxAlloc || len < 0 || len > cap {
		// NOTE: Produce a 'len out of range' error instead of a
		// 'cap out of range' error when someone does make([]T, bignumber).
		// 'cap out of range' is true too, but since the cap is only being
		// supplied implicitly, saying len is clearer.
		// See golang.org/issue/4085.
		mem, overflow := math.MulUintptr(et.size, uintptr(len))
		if overflow || mem > maxAlloc || len < 0 {
			panicmakeslicelen()
		}
		panicmakeslicecap()
	}

	return mallocgc(mem, et, true)
}

// slice 扩缩容处理
func growslice(et *_type, old slice, cap int) slice {}

// slice copy 操作实现
func slicecopy(toPtr unsafe.Pointer, toLen int, fromPtr unsafe.Pointer, fromLen int, width uintptr) int
```

slice 的 struct 定义以及底层的数组指针决定了其具有如下的赋值特性: 
1. **赋值操作会复制整个 struct 但是共享底层的数组**
3. 赋值前后，数组的 len 和 cap 是独立的，但共享的底层数组是可能导致读写冲突的

另外，slice 的扩容和拷贝规则如下:
1. slice 的容量小于 1024 时，新的容量扩大为原来的 2 倍
2. slice 的容量大于 1024 时，新的容量扩大为原来的 1.25 倍
3. 使用 copy() 内置函数拷贝两个切片是，会将源切片数据逐个拷贝到目的切片指向的数组，拷贝数量取两个切片长度的最小值。

最后 slice 的切片有一个扩展表达式 `a[low:high:max]` max 用于限定新生成的切片容量，**注意 max 表示的是到哪，而不是有多少个**，新生成的切片:
1. len=high-low
2. cap=max-low

## 2. map
map 定义在 src/runtime/map.go 中，由 makemap 函数创建

```go
// A header for a Go map.
type hmap struct {
	// Note: the format of the hmap is also encoded in cmd/compile/internal/gc/reflect.go.
	// Make sure this stays in sync with the compiler's definition.
	count     int // # live cells == size of map.  Must be first (used by len() builtin)
	flags     uint8
	B         uint8  // log_2 of # of buckets (can hold up to loadFactor * 2^B items)
	noverflow uint16 // approximate number of overflow buckets; see incrnoverflow for details
	hash0     uint32 // hash seed

	buckets    unsafe.Pointer // array of 2^B Buckets. may be nil if count==0.
	oldbuckets unsafe.Pointer // previous bucket array of half the size, non-nil only when growing
	nevacuate  uintptr        // progress counter for evacuation (buckets less than this have been evacuated)

	extra *mapextra // optional fields
}

// mapextra holds fields that are not present on all maps.
type mapextra struct {
	// If both key and elem do not contain pointers and are inline, then we mark bucket
	// type as containing no pointers. This avoids scanning such maps.
	// However, bmap.overflow is a pointer. In order to keep overflow buckets
	// alive, we store pointers to all overflow buckets in hmap.extra.overflow and hmap.extra.oldoverflow.
	// overflow and oldoverflow are only used if key and elem do not contain pointers.
	// overflow contains overflow buckets for hmap.buckets.
	// oldoverflow contains overflow buckets for hmap.oldbuckets.
	// The indirection allows to store a pointer to the slice in hiter.
	overflow    *[]*bmap
	oldoverflow *[]*bmap

	// nextOverflow holds a pointer to a free overflow bucket.
	nextOverflow *bmap
}

// A bucket for a Go map.
type bmap struct {
	// tophash generally contains the top byte of the hash value
	// for each key in this bucket. If tophash[0] < minTopHash,
	// tophash[0] is a bucket evacuation state instead.
	tophash [bucketCnt]uint8
	// Followed by bucketCnt keys and then bucketCnt elems.
	// NOTE: packing all the keys together and then all the elems together makes the
	// code a bit more complicated than alternating key/elem/key/elem/... but it allows
	// us to eliminate padding which would be needed for, e.g., map[int64]int8.
	// Followed by an overflow pointer.
}

// makemap implements Go map creation for make(map[k]v, hint).
// If the compiler has determined that the map or the first bucket
// can be created on the stack, h and/or bucket may be non-nil.
// If h != nil, the map can be created directly in h.
// If h.buckets != nil, bucket pointed to can be used as the first bucket.
func makemap(t *maptype, hint int, h *hmap) *hmap {
	mem, overflow := math.MulUintptr(uintptr(hint), t.bucket.size)
	if overflow || mem > maxAlloc {
		hint = 0
	}

	// initialize Hmap
	if h == nil {
		h = new(hmap)
	}
	h.hash0 = fastrand()

	// Find the size parameter B which will hold the requested # of elements.
	// For hint < 0 overLoadFactor returns false since hint < bucketCnt.
	B := uint8(0)
	for overLoadFactor(hint, B) {
		B++
	}
	h.B = B

	// allocate initial hash table
	// if B == 0, the buckets field is allocated lazily later (in mapassign)
	// If hint is large zeroing this memory could take a while.
	if h.B != 0 {
		var nextOverflow *bmap
		h.buckets, nextOverflow = makeBucketArray(t, h.B, nil)
		if nextOverflow != nil {
			h.extra = new(mapextra)
			h.extra.nextOverflow = nextOverflow
		}
	}

	return h
}

func makeBucketArray(t *maptype, b uint8, dirtyalloc unsafe.Pointer) (buckets unsafe.Pointer, nextOverflow *bmap){}
```

一个哈希表有如下实现要点:
1. 首先哈希表由哈希函数和底层的数组组成
2. 哈希函数用来定位 key 的存储位置，并可能存在哈希冲突
2. 当负载因子高或者低时，哈希表需要动态扩缩容(rehash)

### 2.1 底层数组
hmap.buckets 就是 hmap 的底层数组，它由 bmap 定义，注意 bmap 的完整定义如下:

```go
type bmap struct {
	tophash [bucketCnt]uint8
	data []byte
	overflow *bmap
}
```

其中:
1. tophash:
	- 用来存储 Hash 值的高 8 位
	- 这个字段与 hmap 的定位过程有关，后面就会看到它存在的意义
2. data: 
	- 存放的是key-value 数据
	- 内存布局是 key/key/.....value/value
	- 这么存储是为了节省字节对齐带来的空间浪费
3. overflow:
	- 指向下一个 bucket
	- hmap 使用链表法解决哈希冲突

注意: data 和 overflow 并没有显示的定义在结构体中，运行时在访问 bucket 时直接通过指针的偏移来访问这些虚拟成员。

### 2.2 key 定位过程
hmap 的增删改查都需要先定位 key 在 buckets 中的位置， hmap 定位过程如下:
1. 计算 key 的 Hash 值
2. 将 Hash 值分为高 8 位和剩余低位
3. 取 Hash 值低位与 hmap.B 取模确定 bucket 的位置
4. 取 Hash 值高 8 位，在 bucket.tophash 数组中查询，如果在索引 i 处查找到，则获取索引 i 对应的 key 进行比较
5. 当前 bucket 中没有找到，则依次从溢出的 bucket 中查找，如果 map 处于扩缩容过程中，优先从 oldbuckets 数组中查找

所以 bmap 的 tophash 的类型为 `[bucketCnt]uint8` 保存的是存储在当前bucket 的所有key 的Hash 的值高 8 位，目的是加快 key 的索引过程。

### 2.3 负载因子
负载因子 = 键数量/bucket数量，Go 的 map 会在负载因为达到 6.5 时才会触发 rehash。那为什么 Go map 要在 bucket 存储多个 key-value 呢？目的是为了优化 hamp 中指针占用的存储空间。

### 2.4 扩缩容 rehash
#### 扩容条件
触发 hmap 扩容的条件有两个:
1. 负载因子 > 6.5
2. overflow 数量大于2^15

#### 扩容过程
hmap 扩容时，会新建一个 bucket 数组，长度为原来的 2 倍，Go 会采用逐步搬迁的策略，每次访问 map 时都会触发一次搬迁，每次搬迁 2 个键值对。因此 hmap 的结构体中包含了 oldbuckets 成员，指向了扩容前的原 buckets 数组。buckets 则指向新分配的数组。带 oldbuckets 数组中所有键值对搬迁完毕后，oldbuckets就会被释放。

#### 缩容过程
缩容过程发生在大量key 被删除之后，过程与扩容类似。

## 3. string
### 3.1 string 实现
string 定义在 `src/runtime/string.go` 中:

```go
type stringStruct struct {
	str unsafe.Pointer
	len int
}

func gostringnocopy(str *byte) string {
	ss := stringStruct{str: unsafe.Pointer(str), len: findnull(str)}
	s := *(*string)(unsafe.Pointer(&ss))
	return s
}
```
stringStruct 中:
1. str: 字符串的首地址
2. len: 字符串的长度

在 runtime 包中使用 gostringnocopy 函数来生成字符串，gostringnocopy 会先构建 stringStruct 对象，然后在转换成 string，string 定义在 buildin 包中:

```go
// string is the set of all strings of 8-bit bytes, conventionally but not
// necessarily representing UTF-8-encoded text. A string may be empty, but
// not nil. Values of string type are immutable.
type string string
```

从注释中可以看到:
1. string 是 8bit 的集合，通常是 UTF-8 的文本
2. string 可以为空，但不会是 nil
3. string 对象不可修改

### 3.2 字符串拼接
Go 中字符串可以直接使用 + 号进行拼接: `str := "str1" + "str2" + "str3"`，拼接过程在内部则会调用 string 包的 concatstrings() 函数，代码如下:

```go
// concatstrings implements a Go string concatenation x+y+z+...
// The operands are passed in the slice a.
// If buf != nil, the compiler has determined that the result does not
// escape the calling function, so the string data can be stored in buf
// if small enough.
func concatstrings(buf *tmpBuf, a []string) string {
	idx := 0
	l := 0
	count := 0
	for i, x := range a {
		n := len(x)
		if n == 0 {
			continue
		}
		if l+n < l {
			throw("string concatenation too long")
		}
		l += n
		count++
		idx = i
	}
	if count == 0 {
		return ""
	}

	// If there is just one string and either it is not on the stack
	// or our result does not escape the calling frame (buf != nil),
	// then we can return that string directly.
	if count == 1 && (buf != nil || !stringDataOnStack(a[idx])) {
		return a[idx]
	}
	// 返回一个 string 和切片，二者共享内存空间
	s, b := rawstringtmp(buf, l)
	for _, x := range a {
		copy(b, x)
		b = b[len(x):]
	}
	return s
}

func rawstringtmp(buf *tmpBuf, l int) (s string, b []byte) {
	if buf != nil && l <= len(buf) {
		b = buf[:l]
		s = slicebytetostringtmp(&b[0], len(b))
	} else {
		s, b = rawstring(l)
	}
	return
}

// rawstring allocates storage for a new string. The returned
// string and byte slice both refer to the same storage.
// The storage is not zeroed. Callers should use
// b to set the string contents and then drop b.
func rawstring(size int) (s string, b []byte) {
	p := mallocgc(uintptr(size), nil, false)

	stringStructOf(&s).str = p
	stringStructOf(&s).len = size

	*(*slice)(unsafe.Pointer(&b)) = slice{p, size, size}

	return
}
```

concatstrings 实现中:
1. 所有待拼接字符串都被编译器组织到一个切片中并传入 concatstrings 函数
2. 拼接需要遍历两次切片，第一次遍历获取总的字符串长度，据此申请内存
3. 第二次遍历把字符串逐个拷贝过去

### 3.3 类型转换
[]byte 和 string 可以直接相互转换，但是转换过程需要一次内存拷贝。

#### []byte -> string
[]byte -> string 调用的是 string 包的 slicebytetostring 函数

```go
// slicebytetostring converts a byte slice to a string.
// It is inserted by the compiler into generated code.
// ptr is a pointer to the first element of the slice;
// n is the length of the slice.
// Buf is a fixed-size buffer for the result,
// it is not nil if the result does not escape.
func slicebytetostring(buf *tmpBuf, ptr *byte, n int) (str string) {
	if n == 0 {
		// Turns out to be a relatively common case.
		// Consider that you want to parse out data between parens in "foo()bar",
		// you find the indices and convert the subslice to string.
		return ""
	}
	if raceenabled {
		racereadrangepc(unsafe.Pointer(ptr),
			uintptr(n),
			getcallerpc(),
			funcPC(slicebytetostring))
	}
	if msanenabled {
		msanread(unsafe.Pointer(ptr), uintptr(n))
	}
	if n == 1 {
		p := unsafe.Pointer(&staticuint64s[*ptr])
		if sys.BigEndian {
			p = add(p, 7)
		}
		stringStructOf(&str).str = p
		stringStructOf(&str).len = 1
		return
	}

	var p unsafe.Pointer
	if buf != nil && n <= len(buf) {
		// 如果预留 buf 够用，则用预留的 buf
		p = unsafe.Pointer(buf)
	} else {
		// 否则重新申请内存
		p = mallocgc(uintptr(n), nil, false)
	}
	// 构建字符串
	stringStructOf(&str).str = p
	stringStructOf(&str).len = n
	// 将切片底层数组中数据拷贝到字符串
	memmove(p, unsafe.Pointer(ptr), uintptr(n))
	return
}

func memmove(to, from unsafe.Pointer, n uintptr)

func mallocgc(size uintptr, typ *_type, needzero bool) unsafe.Pointer 
```

#### string -> []byte
[]byte -> string 调用的是 string 包的 slicebytetostring 函数:

```go
type tmpBuf [tmpStringBufSize]byte

func stringtoslicebyte(buf *tmpBuf, s string) []byte {
	var b []byte
	if buf != nil && len(s) <= len(buf) {
		// buf 小直接从栈上分配
		*buf = tmpBuf{}
		b = buf[:len(s)]
	} else {
		// 生成新的切片
		b = rawbyteslice(len(s))
	}
	copy(b, s)
	return b
}

// rawbyteslice allocates a new byte slice. The byte slice is not zeroed.
func rawbyteslice(size int) (b []byte) {
	cap := roundupsize(uintptr(size))
	p := mallocgc(cap, nil, false)
	if cap != uintptr(size) {
		memclrNoHeapPointers(add(p, uintptr(size)), cap-uintptr(size))
	}

	*(*slice)(unsafe.Pointer(&b)) = slice{p, size, int(cap)}
	return
}

type Type int
func copy(dst, src []Type) int
```

### 3.4 编译优化
[]byte 和 string 相互转化都会进行一次内存拷贝，而在某些**临时场景**下，byte 切换在转化成 string 是并不会拷贝内存，而是直接返回一个 string ，string.str 的指针指向切片的内存，这些场景都符合一个特征，即在 string 的存续期间 []byte 肯定不会修改:
1. 使用 `map[string(b)]`
2. 字符串拼接 `"a" + string(b) + "c"`
3. 字符串比较 `string(b) == "foo"`

## 4. struct
Go 语言中 struct 的一个特点是允许为字段标记 Tag，如下所示:

```go
type TypeMeta struct {
	Kind string `json:"kind,omitempty" protobuf:"bytes,1,opt,name=kind"`
}
```

### 4.1 Tag 的本质
首先 Tag 是 struct 的一部分，用于标识结构体字段的额外属性。在 reflect 包中，使用**结构体 StructField 表示结构体的一个字段**:

```go
// A StructField describes a single field in a struct.
type StructField struct {
	// Name is the field name.
	Name string
	// PkgPath is the package path that qualifies a lower case (unexported)
	// field name. It is empty for upper case (exported) field names.
	// See https://golang.org/ref/spec#Uniqueness_of_identifiers
	PkgPath string

	Type      Type      // field type
	Tag       StructTag // field tag string
	Offset    uintptr   // offset within struct, in bytes
	Index     []int     // index sequence for Type.FieldByIndex
	Anonymous bool      // is an embedded field
}

type StructTag string

func (tag StructTag) Get(key string) string {
	v, _ := tag.Lookup(key)
	return v
}
```

可以看到，Tag 也是字段的一个组成部分。从类型可以看出 Tag 是一个字符串，它有一个约定的格式，就是由 key:"value" 组成:
1. key: 必须是非空字符串，字符串不能包含控制字符、空格、引号、冒号
2. value: 以双引号括住的字符串
3. key 和 value 之间使用冒号相隔，冒号前后不能有空格，多个 key:"value" 由空格分割

### 4.2 Tag 的获取
通过反射可以获取 Tag 中 key 对应的 value，下面是一个代码示例:

```go
func PrintTag(){
	t := TypeMeta{}
	ty := reflect.TypeOf(t)

	for i := 0; i < ty.NumField(); i++ {
		fmt.Printf("Field: %s, Tag: %s\n", ty.Field(i).Name, ty.Field(i).Tag.Get("json"))
	}
}
```

Go 语言的反射特性可以动态的给结构体成员赋值，Tag 就可以给这种赋值提供"指引"。

## 5. iota
Go 中 iota 用于声明连续的整型常量，iota 的取值与其出现的额位置强相关。从编译器的角度看 iota，其取值规则只有一条: **iota 代表了 const 声明块的行索引**。除此之外，const 声明还有一个特点，如果为常量指定了一个表达式，但后续的常量没有表达式，则继承上面的表达式。

### 5.1 实现原理
在编译器代码中，每个常量或者变量的声明语句使用 ValueSpec 结构表示，ValueSpec 定义在 `src/go/ast/ast.go` 

```go
	ValueSpec struct {
		Doc     *CommentGroup // associated documentation; or nil
		Names   []*Ident      // value names (len(Names) > 0)
		Type    Expr          // value type; or nil
		Values  []Expr        // initial values; or nil
		Comment *CommentGroup // line comments; or nil
	}
```

ValueSpec 仅表示一行声明语句，比如:

```go
const (
	// 常量块注释
	a, b = iota, iota // 常量行注释
)
```

上面的常量声明中仅包括一行声明语句，对应一个 ValueSpec 结构:
1. Doc: 表示注释
2. Name: 常量的名字，使用切片表示当行语句中声明的多个变量
3. Type: 常量类型
4. Value: 常量值
5. Comment: 常量行注释

如果 const 包含多行常量声明，就会对应多个 ValueSpec，编译器在遍历时会使用类似下面的伪代码:

```go
for iota, spec := range ValueSpecs {
	for i, name := range spec.Names }{
		obj := NewConst(name, iota)
	}
}
```

从上面的代码就可以看出，iota 的本质: 仅代表常量声明的索引。


## 6. channel
channel 的定义和使用，在 go 语言的第四部分-go 并发中有详细的介绍，内容如下:
1. [Channel 使用与实现]({{< ref "posts/program/go/sync/go_sync_13.md" >}})
2. [Channel 应用]({{< ref "posts/program/go/sync/go_sync_14.md" >}})

虽然后面有更详细的介绍，但这里不妨我们对它有个基本的认识。

### 6.1 hchan 数据结构
channel 定义在源码包 src/runtime/chan.go 中，对应类型为 *hchan，由 makechan 函数创建。hchan 结构如下，其中比较难理解的是 `elementype *_type`，这个跟 Go 类型系统的实现有关，我们暂时放一放。

```go
type hchan struct {
	qcount   uint           // total data in the queue
	dataqsiz uint           // size of the circular queue
	buf      unsafe.Pointer // points to an array of dataqsiz elements
	elemsize uint16
	closed   uint32
	elemtype *_type // element type
	sendx    uint   // send index
	recvx    uint   // receive index
	recvq    waitq  // list of recv waiters
	sendq    waitq  // list of send waiters

	// lock protects all fields in hchan, as well as several
	// fields in sudogs blocked on this channel.
	//
	// Do not change another G's status while holding this lock
	// (in particular, do not ready a G), as this can deadlock
	// with stack shrinking.
	lock mutex
}

type _type struct {
	size       uintptr
	ptrdata    uintptr // size of memory prefix holding all pointers
	hash       uint32
	tflag      tflag
	align      uint8
	fieldAlign uint8
	kind       uint8
	// function for comparing objects of this type
	// (ptr to object A, ptr to object B) -> ==?
	equal func(unsafe.Pointer, unsafe.Pointer) bool
	// gcdata stores the GC type data for the garbage collector.
	// If the KindGCProg bit is set in kind, gcdata is a GC program.
	// Otherwise it is a ptrmask bitmap. See mbitmap.go for details.
	gcdata    *byte
	str       nameOff
	ptrToThis typeOff
}

type nameOff int32
type typeOff int32
type tflag uint8
```

hchan 的结构成员分成了如下几类
1. 环形队列:
	- dataqsiz: 队列的长度
	- buf: 队列的内存
	- qcount: 队列中元素个数
	- sendx: 插入数据的位置索引
	- recvx: 读取数据的位置索引
2. 等待队列:
	- recvq: 读取等待队列
	- sendq: 发送等待队列
3. 类型信息: 一个管道只能发送一种类型的值
	- elemtype: 元素类型
	- elemsize: 元素类型大小
4. 互斥锁: lock

### 6.2 channel 创建
hchan 由 makechan 函数创建，函数如下:

```go
type chantype struct {
	typ  _type
	elem *_type
	dir  uintptr
}

func makechan(t *chantype, size int) *hchan {
	elem := t.elem

	// compiler checks this but be safe.
	if elem.size >= 1<<16 {
		throw("makechan: invalid channel element type")
	}
	if hchanSize%maxAlign != 0 || elem.align > maxAlign {
		throw("makechan: bad alignment")
	}

	mem, overflow := math.MulUintptr(elem.size, uintptr(size))
	if overflow || mem > maxAlloc-hchanSize || size < 0 {
		panic(plainError("makechan: size out of range"))
	}

	// Hchan does not contain pointers interesting for GC when elements stored in buf do not contain pointers.
	// buf points into the same allocation, elemtype is persistent.
	// SudoG's are referenced from their owning thread so they can't be collected.
	// TODO(dvyukov,rlh): Rethink when collector can move allocated objects.
	var c *hchan
	switch {
	case mem == 0:
		// Queue or element size is zero.
		c = (*hchan)(mallocgc(hchanSize, nil, true))
		// Race detector uses this location for synchronization.
		c.buf = c.raceaddr()
	case elem.ptrdata == 0:
		// Elements do not contain pointers.
		// Allocate hchan and buf in one call.
		c = (*hchan)(mallocgc(hchanSize+mem, nil, true))
		c.buf = add(unsafe.Pointer(c), hchanSize)
	default:
		// Elements contain pointers.
		c = new(hchan)
		c.buf = mallocgc(mem, elem, true)
	}

	c.elemsize = uint16(elem.size)
	c.elemtype = elem
	c.dataqsiz = uint(size)
	lockInit(&c.lock, lockRankHchan)

	if debugChan {
		print("makechan: chan=", c, "; elemsize=", elem.size, "; dataqsiz=", size, "\n")
	}
	return c
}
```

### 6.3 channel 的使用
向 channel 收发数据是否会阻塞，与我们理解的环形队列的使用基本无异，只不过里面包含了一些小技巧:
1. 首先环形队列没有空间时，发送数据会阻塞
2. 同样环形队列中没有数据时，读取数据会阻塞
3. 技巧一，当接收队列 recvq 不为空时，说明缓冲区肯定没有数据但有协程在等待，所以会把写入的数据直接传递给 recvq 中的第一个协程，而不必写入 buf
4. 于技巧一类似，当 sendq 不为空时，会直接将 sendq 中第一个协程的数据发送给读取的协程

### 6.4 channel的关闭
关闭管道时，recvq/sendq 中的协程会全部唤醒，但是行为不同:
1. recvq 中的协程会获取对应类型的零值
2. sendq 中的协程会触发异常，所以 **channel 只能发送方关闭**，发送方可以确保没有协程阻塞在 sendq

除此之外下面的 channel 操作也会触发 panic:
1. 关闭值为 nil 的管道
2. 关闭已经被关闭的管道
3. 向已经关闭的管道写入数据 
