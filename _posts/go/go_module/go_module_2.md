---
title: 2 文件 IO
date: 2020-12-02
categories:
    - Go
tags:
	- go标准库及第三方库
	- 入门指南
series: go 语言入门
---

文件IO
<!-- more -->


## 1. 文件 IO 概述
Go 的标准库我们就从文件 IO 开始。Go 标准库中为文件 IO 提供了如下这些包:
1. os: 文件操作的方法都在 os 包中
2. io：
	- 为了扩展"文本操作"的范围(类似 Linux 中一切接文件，可以把文本操作扩展到其他类型的资源上) io 包提供了I/O原语的基本接口
	- io 包基本任务是包装这些原语已有的实现（如os包里的原语），使之成为共享的公共接口。
3. bufio: 
	- os 包内的文件IO 是不带语言层的缓存的， bufio 提供了语言层带缓存 IO
	- 通过带缓存 IO，使得我们可以以特定的方式读取类文件中的内容，比如按特定分隔符读取等等
4. string/bytes：为了以类文件方式操作 string 和 []bytes ，string 和 bytes 包为 string 和 bytes 实现了部分文件 io 的公共接口
5. io/ioutil: 提供了一些文件 IO 的便捷函数

接下来我们就一一来介绍这些包的使用。

## 2. os 文件操作
os包提供了操作系统函数的不依赖平台的接口。os包的接口规定为在所有操作系统中都是一致的，非公用的属性可以从操作系统特定的syscall包获取。os 包中与文件 IO 相关的部分如下:

```go
// 文件对象
type File struct {
    // 内含隐藏或非导出字段
}

type File
	func Create(name string) (file *File, err error) 
	func Open(name string) (file *File, err error)
	// 文件操作的核心函数
	func OpenFile(name string, flag int, perm FileMode) (file *File, err error) 
	func NewFile(fd uintptr, name string) *File
	func Pipe() (r *File, w *File, err error)

	func (f *File) Name() string
	func (f *File) Stat() (fi FileInfo, err error)
	func (f *File) Fd() uintptr
	func (f *File) Chdir() error   // Chdir将当前工作目录修改为f，f必须是一个目录
	func (f *File) Chmod(mode FileMode) error
	func (f *File) Chown(uid, gid int) error
	func (f *File) Readdir(n int) (fi []FileInfo, err error)
	func (f *File) Readdirnames(n int) (names []string, err error)
	func (f *File) Truncate(size int64) error
	func (f *File) Sync() (err error)

	// 重要: 文件 IO 公共接口包含的方法
	func (f *File) Read(b []byte) (n int, err error)
	func (f *File) ReadAt(b []byte, off int64) (n int, err error)
	func (f *File) Write(b []byte) (n int, err error)
	func (f *File) WriteString(s string) (ret int, err error)
	func (f *File) WriteAt(b []byte, off int64) (n int, err error)
	func (f *File) Seek(offset int64, whence int) (ret int64, err error)
	func (f *File) Close() error

// 文件状态对象
type FileInfo interface {
    Name() string       // 文件的名字（不含扩展名）
    Size() int64        // 普通文件返回值表示其大小；其他文件的返回值含义各系统不同
    Mode() FileMode     // 文件的模式位
    ModTime() time.Time // 文件的修改时间
    IsDir() bool        // 等价于Mode().IsDir()
    Sys() interface{}   // 底层数据来源（可以返回nil）
}

type FileInfo
	func Stat(name string) (fi FileInfo, err error)
	func Lstat(name string) (fi FileInfo, err error)

// FileMode代表文件的模式和权限位
type FileMode uint32

type FileMode
	func (m FileMode) IsDir() bool
	func (m FileMode) IsRegular() bool
	func (m FileMode) Perm() FileMode
	func (m FileMode) String() string
```

os 包为文件 IO 提供了这样几个核心对象:
1. File: 
	- 代表一个打开的文件对象
	- File 中提供了几个文件读写方法就是 io 包抽象的公共接口
2. FileInfo: 描述一个文件对象
3. FileMode: 代表文件的模式和权限位

## 3. io 抽象的公共接口

io 包将文件 IO 中所有的文件操作及其组合都抽象为独立的接口:

```go
// 1. 基础 io 操作及其组合
type Reader
type Writer
type Closer
type Seeker
type ReaderAt
type WriterAt

type ReadCloser
type ReadSeeker
type WriteCloser
type WriteSeeker
type ReadWriter
type ReadWriteCloser
type ReadWriteSeeker

// 2. 可撤回读
type ByteWriter
type ByteReader
type ByteScanner
type RuneReader
type RuneScanner

type ByteWriter interface {
    WriteByte(c byte) error
}

// 3. 文件互操作
type ReaderFrom
type WriterTo

// ReadFrom方法从r读取数据直到EOF或者遇到错误。返回值n是读取的字节数，执行时遇到的错误（EOF除外）
type ReaderFrom interface {
    ReadFrom(r Reader) (n int64, err error)
}

// WriteTo方法将数据写入w直到没有数据可以写入或者遇到错误。返回写入的字节数和执行时遇到的任何错误
type WriterTo interface {
    WriteTo(w Writer) (n int64, err error)
}
```

