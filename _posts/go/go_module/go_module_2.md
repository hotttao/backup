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
	// off 表示相对于文件开始 off 位置起
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

### 3.1 io 中的接口
io 包将文件 IO 中所有的文件操作及其组合都抽象为独立的接口，其接口大致上分成了三类:
1. os 包文件操作及其组合
2. 带读取撤回的接口
3. 文件互操作

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

type ByteReader interface {
    ReadByte() (c byte, err error)
}

type ByteScanner interface {
    ByteReader
	//读回撤
	UnreadByte() error
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

### 3.2 io 中的数据结构
除了接口外，io 包还提供了一些具有特殊用途的数据结构:

```go
// 1. 只能限制读取 n 个字节的 Reader
type LimitedReader
	func LimitReader(r Reader, n int64) Reader
	func (l *LimitedReader) Read(p []byte) (n int, err error)

// 2. 从 r 中的偏移量off处为起始，读取n个字节后以EOF停止的SectionReader
type SectionReader
	func NewSectionReader(r ReaderAt, off int64, n int64) *SectionReader
	func (s *SectionReader) Size() int64
	func (s *SectionReader) Read(p []byte) (n int, err error)
	func (s *SectionReader) ReadAt(p []byte, off int64) (n int, err error)
	func (s *SectionReader) Seek(offset int64, whence int) (int64, error)

// 3. 管道符
type PipeReader
	func Pipe() (*PipeReader, *PipeWriter)
	func (r *PipeReader) Read(data []byte) (n int, err error)
	func (r *PipeReader) Close() error
	func (r *PipeReader) CloseWithError(err error) error

type PipeWriter
	func (w *PipeWriter) Write(data []byte) (n int, err error)
	func (w *PipeWriter) Close() error
	func (w *PipeWriter) CloseWithError(err error) error
```

### 3.3 io 中的功能函数
除了接口和数据结构，io 包还包含了如下具有特殊用途的功能函数:

```go
// 返回一个从 r 读，并且往 w 写的 Reader
func TeeReader(r Reader, w Writer) Reader

// 将多个 Reader 合并为一个 Reader
func MultiReader(readers ...Reader) Reader

// 将写同时写入多个 writer
func MultiWriter(writers ...Writer) Writer

// 文件拷贝
func Copy(dst Writer, src Reader) (written int64, err error)

// 文件拷贝，限制长度为 n
func CopyN(dst Writer, src Reader, n int64) (written int64, err error)

// 至少读取min字节数据填充进buf
func ReadAtLeast(r Reader, buf []byte, min int) (n int, err error)

// 精确地读取len(buf)字节数据填充进buf
func ReadFull(r Reader, buf []byte) (n int, err error)

// 将字符串s的内容写入w中
func WriteString(w Writer, s string) (n int, err error)
```

## 4. io/ioutil
说完了 io 包，我们先来看看 io/ioutil，这个包也是提供了一些 io 的功能函数。

```go
// 写黑洞，/dev/null 所有Write调用都会无实际操作的成功返回
var Discard io.Writer = devNull(0)

// 用一个无操作的Close方法包装r返回一个ReadCloser接口
func NopCloser(r io.Reader) io.ReadCloser

// r 读取数据直到EOF或遇到error，返回读取的数据和遇到的错误, EOF 错误不会被返回
func ReadAll(r io.Reader) ([]byte, error)

// 同 ReadAll，接收的是一个文件路径
func ReadFile(filename string) ([]byte, error)

// 向filename指定的文件中写入数据，文件不存在创建，文件存在清空
func WriteFile(filename string, data []byte, perm os.FileMode) error

// 返回dirname指定的目录的目录信息的有序列表，与 os.File Readdir 方法作用一致
func ReadDir(dirname string) ([]os.FileInfo, error)

// 在dir目录里创建一个新的、使用prfix作为前缀的临时文件夹，并返回文件夹的路径
// 如果dir是空字符串，TempDir使用默认用于临时文件的目录（即 os.TempDir函数返回的临时目录）
func TempDir(dir, prefix string) (name string, err error)

// 在dir目录下创建一个新的、使用prefix为前缀的临时文件，以读写模式打开该文件并返回os.File指针
func TempFile(dir, prefix string) (f *os.File, err error)
```

## 5. strings/bytes 
为了能像读写文件一样去操作 strings 和 []byte，strings/bytes 提供了对应类型的 io 接口实现。

### 5.1 strings
strings.Reader 将一个字符串转换成，**可读的**类文本对象。

```go
type Reader
	func NewReader(s string) *Reader
	func (r *Reader) Len() int
	func (r *Reader) Read(b []byte) (n int, err error)
	func (r *Reader) ReadByte() (b byte, err error)
	func (r *Reader) UnreadByte() error
	func (r *Reader) ReadRune() (ch rune, size int, err error)
	func (r *Reader) UnreadRune() error
	func (r *Reader) Seek(offset int64, whence int) (int64, error)
	func (r *Reader) ReadAt(b []byte, off int64) (n int, err error)
	func (r *Reader) WriteTo(w io.Writer) (n int64, err error)

type Reader struct {
    // 内含隐藏或非导出字段
}

type Replacer
	// 多组old、new字符串对，
	func NewReplacer(oldnew ...string) *Replacer

	// 在传入的 s 中执行替换，用初始化时的 new 替换 old
	func (r *Replacer) Replace(s string) string
	// 对 s 进行替换并写入 w
	func (r *Replacer) WriteString(w io.Writer, s string) (n int, err error)

type Replacer struct {
    // 内含隐藏或非导出字段
}
```

### 5.2 bytes
bytest.Reader 将一个 []byte 转换成**可读的**类文本对象。而比较特殊的是 Buffer 对象，这是一个可读写的字节缓冲。
```go
type Reader
	func NewReader(b []byte) *Reader
	func (r *Reader) Len() int
	func (r *Reader) Read(b []byte) (n int, err error)
	func (r *Reader) ReadByte() (b byte, err error)
	func (r *Reader) UnreadByte() error
	func (r *Reader) ReadRune() (ch rune, size int, err error)
	func (r *Reader) UnreadRune() error
	func (r *Reader) Seek(offset int64, whence int) (int64, error)
	func (r *Reader) ReadAt(b []byte, off int64) (n int, err error)
	func (r *Reader) WriteTo(w io.Writer) (n int64, err error)

type Reader struct {
    // 内含隐藏或非导出字段
}


// 可读写的字节缓冲
type Buffer struct {
    // 内含隐藏或非导出字段
}

type Buffer
	func NewBuffer(buf []byte) *Buffer
	func NewBufferString(s string) *Buffer
	// Reset重设缓冲，因此会丢弃全部内容，等价于b.Truncate(0)
	func (b *Buffer) Reset()
	func (b *Buffer) Len() int
	// 返回未读取部分字节数据的切片
	func (b *Buffer) Bytes() []byte
	func (b *Buffer) String() string
	func (b *Buffer) Truncate(n int)
	// 必要时会增加缓冲的容量，以保证n字节的剩余空间
	func (b *Buffer) Grow(n int)
	// 返回未读取部分前n字节数据的切片，并且移动读取位置，就像调用了Read方法一样
	// 切片只在下一次调用b的读/写方法前才合法
	func (b *Buffer) Next(n int) []byte

	func (b *Buffer) Read(p []byte) (n int, err error)
	func (b *Buffer) ReadByte() (c byte, err error)
	func (b *Buffer) UnreadByte() error
	func (b *Buffer) ReadRune() (r rune, size int, err error)
	func (b *Buffer) UnreadRune() error

	// ReadBytes读取直到第一次遇到delim字节，返回一个包含已读取的数据和delim字节的切片
	func (b *Buffer) ReadBytes(delim byte) (line []byte, err error)
	func (b *Buffer) ReadString(delim byte) (line string, err error)
	
	// Write将p的内容写入缓冲中，如必要会增加缓冲容量。返回值n为len(p
	func (b *Buffer) Write(p []byte) (n int, err error)
	func (b *Buffer) WriteString(s string) (n int, err error)
	func (b *Buffer) WriteByte(c byte) error
	func (b *Buffer) WriteRune(r rune) (n int, err error)
	func (b *Buffer) ReadFrom(r io.Reader) (n int64, err error)
	func (b *Buffer) WriteTo(w io.Writer) (n int64, err error)
```

Buffer 的初始化有三种方式:
1. `NewBuffer(buf []byte)`: 
	- 使用buf作为初始内容创建并初始化一个Buffer
	- 用于创建一个用于读取已存在数据的buffer
	- 也用于指定用于写入的内部缓冲的大小，此时，buf应为一个具有指定容量但长度为0的切片
2. `func NewBufferString(s string) *Buffer`:
	- 使用s作为初始内容创建一个用于读取已存在数据的buffer
3. `new(Buffer)`: 大多数情况下使用，初始化一个Buffer


## 6. bufio
bufio包实现了有缓冲的I/O。它包装一个io.Reader或io.Writer接口对象，创建另一个也实现了该接口。因为有了缓存 bufio 可以实现下面这些非常使用的功能:
1. 读取文件直至特定的分隔符
2. 文件扫描，实现按行或者按照特定分隔符流式读取文件

### 6.1 文件分割
为了实现**读取文件直至xxx**功能，bufio 定义了一个特殊的函数类型:

```go
type SplitFunc func(data []byte, atEOF bool) (advance int, token []byte, err error)
```

SplitFunc类型代表用于对输出作词法分析的分割函数。bufio 中他有如下实现:

```go
// 将每个字节作为一个token返回
func ScanBytes(data []byte, atEOF bool) (advance int, token []byte, err error)

// 将每个utf-8编码的unicode码值作为一个token返回
func ScanRunes(data []byte, atEOF bool) (advance int, token []byte, err error)

// 将单词(空白符分割)作为一个 token 返回
func ScanWords(data []byte, atEOF bool) (advance int, token []byte, err error)

// 将每一行文本去掉末尾的换行标记作为一个token返回
func ScanLines(data []byte, atEOF bool) (advance int, token []byte, err error)
```

### 6.2 文件扫描
Scanner 使用 SplitFunc 定义的词法分割函数，实现文件扫描:

```go
type Scanner struct {
    // 内含隐藏或非导出字段
}

type Scanner
	// 返回一个从r读取数据的Scanner，默认的分割函数是ScanLines
	func NewScanner(r io.Reader) *Scanner
	// 设置该Scanner的分割函数
	func (s *Scanner) Split(split SplitFunc)

	// Scan 方法获取当前位置的token（该token可以通过Bytes或Text方法获得）
	// 并让Scanner的扫描位置移动到下一个token
	// 当扫描因为抵达输入流结尾或者遇到错误而停止时，本方法会返回false
	// 在Scan方法返回false后，Err方法将返回扫描时遇到的任何错误；除非是io.EOF，此时Err会返回nil
	func (s *Scanner) Scan() bool

	// 返回最近一次Scan调用生成的token
	func (s *Scanner) Bytes() []byte
	func (s *Scanner) Text() string

	// 反回 Scanner 遇到的第一个非 EOF 的错误
	func (s *Scanner) Err() error

scanner := bufio.NewScanner(os.Stdin)
for scanner.Scan() {
    fmt.Println(scanner.Text()) // Println will add back the final '\n'
}
if err := scanner.Err(); err != nil {
    fmt.Fprintln(os.Stderr, "reading standard input:", err)
}
```

### 6.3 带缓存 IO
bufio 剩下的部分就是实现了一个带缓存的 io

#### Reader

```go
type Reader struct {
    // 内含隐藏或非导出字段
}

type Reader
	// 创建一个具有默认大小缓冲、从r读取的*Reader
	func NewReader(rd io.Reader) *Reader
	// 创建一个具有最少有size尺寸的缓冲、从r读取的*Reader
	// 如果参数 r 已经是一个具有足够大缓冲的* Reader类型值，会返回r
	func NewReaderSize(rd io.Reader, size int) *Reader

	// 丢弃缓冲中的数据，清除任何错误
	func (b *Reader) Reset(r io.Reader)
	// 返回缓冲中现有的可读取的字节数
	func (b *Reader) Buffered() int

	// Peek返回输入流的下n个字节，而不会移动读取位置
	// 返回的[]byte只在下一次调用读取操作前合法
	// 如果Peek返回的切片长度比n小，它也会返会一个错误说明原因
	// 如果n比缓冲尺寸还大，返回的错误将是ErrBufferFull。
	func (b *Reader) Peek(n int) ([]byte, error)

	// Read读取数据写入p
	// 本方法一次调用最多会调用下层Reader接口一次Read方法，因此返回值n可能小于len(p)
	// 读取到达结尾时，返回值n将为0而err将为io.EOF
	func (b *Reader) Read(p []byte) (n int, err error)
	func (b *Reader) ReadByte() (c byte, err error)
	func (b *Reader) UnreadByte() error
	func (b *Reader) ReadRune() (r rune, size int, err error)
	func (b *Reader) UnreadRune() error
	
	// ReadLine 和 ReadSlice 是比较底层的函数，不建议使用
	// 因为存在写满，或者可能被重写的问题
	func (b *Reader) ReadLine() (line []byte, isPrefix bool, err error)
	func (b *Reader) ReadSlice(delim byte) (line []byte, err error)
	
	// 读取直到第一次遇到delim字节，返回一个包含已读取的数据和delim字节的切片
	func (b *Reader) ReadBytes(delim byte) (line []byte, err error)
	func (b *Reader) ReadString(delim byte) (line string, err error)
	func (b *Reader) WriteTo(w io.Writer) (n int64, err error)
```

#### Writer

```go
type Writer struct {
    // 内含隐藏或非导出字段
}

type Writer
	// 创建一个具有默认大小缓冲、写入w的*Writer
	func NewWriter(w io.Writer) *Writer
	// 创建一个具有最少有size尺寸的缓冲、写入w的*Writer
	// 如果参数w已经是一个具有足够大缓冲的*Writer类型值，会返回w
	func NewWriterSize(w io.Writer, size int) *Writer
	
	// Reset丢弃缓冲中的数据，清除任何错误，将b重设为将其输出写入w
	func (b *Writer) Reset(w io.Writer)
	// 返回缓冲中已使用的字节数
	func (b *Writer) Buffered() int
	// 返回缓冲中还有多少字节未使用
	func (b *Writer) Available() int

	// 将p的内容写入缓冲。返回写入的字节数。如果返回值nn < len(p)，还会返回一个错误说明原因
	func (b *Writer) Write(p []byte) (nn int, err error)
	func (b *Writer) WriteString(s string) (int, error)
	func (b *Writer) WriteByte(c byte) error
	func (b *Writer) WriteRune(r rune) (size int, err error)

	// 将缓冲中的数据写入下层的io.Writer接口
	func (b *Writer) Flush() error
	func (b *Writer) ReadFrom(r io.Reader) (n int64, err error)
```

#### ReadWriter
ReadWriter类型保管了指向Reader和Writer类型的指针，因此实现了io.ReadWriter接口。Reader 和 Writer 中的缓存是各自内部创建的，彼此之间不存在共享，ReadWriter 只是做了一个读写分派。

```go
type ReadWriter struct {
    *Reader
    *Writer
}
// 申请创建一个新的、将读写操作分派给r和w 的ReadWriter
func NewReadWriter(r *Reader, w *Writer) *ReadWriter
```