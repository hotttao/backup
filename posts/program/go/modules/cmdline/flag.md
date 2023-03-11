---
weight: 1
title: "命令行参数 - flag/pflag"
date: 2021-06-21T09:00:00+08:00
lastmod: 2021-06-21T09:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 项目的配置管理"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

Cobra 是 Go 语言里面命令行参数的事实标准，基本上很多项目都在使用。Cobra 把命令行参数的实现分成了三个独立的 package:
1. pflag: 对标准库中的 flag 的扩展
2. viper: 配置管理
3. cobra: pflag + viper

学习 Cobra 之前我们先来看看 flag/pflag

## 1. flag
flag 是 Go 标准库提供的命令行参数实现，通过 [dumels](https://www.dumels.com/) 生成的 UML 类图如下: 

![flag](/images/go/module/flag.png)

在标准库的 flag 包中:
1. Flag: 一个命令行参数的抽象
2. Value: 一个接口，参数值的抽象，所有内置基础类型都有一个与之对应重命名类型，这个重命名类型实现了 Value 接口，完成命令行参数到具体参数的解析。
3. FlagSet: Flag 的集合。

### 1.1 Flag

```go
type Value interface {
	String() string
	Set(string) error  // 定义了参数的解析规则
}

// Getter is an interface that allows the contents of a Value to be retrieved.
// It wraps the Value interface, rather than being part of it, because it
// appeared after Go 1 and its compatibility rules. All Value types provided
// by this package satisfy the Getter interface, except the type used by Func.
type Getter interface {
	Value
	Get() any
}

// A Flag represents the state of a flag.
type Flag struct {
	Name     string // name as it appears on command line
	Usage    string // help message
	Value    Value  // value as set
	DefValue string // default value (as text); for usage message
}
```

### 1.2 参数解析
以 float64 为例，有一个与之对应的 float64Value:

```go
// -- float64 Value
type float64Value float64

func newFloat64Value(val float64, p *float64) *float64Value {
	*p = val
	return (*float64Value)(p)
}

func (f *float64Value) Set(s string) error {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		err = numError(err)
	}
	*f = float64Value(v)
	return err
}

func (f *float64Value) Get() any { return float64(*f) }

func (f *float64Value) String() string { return strconv.FormatFloat(float64(*f), 'g', -1, 64) }
```

### 1.3 FlagSet

```go
// A FlagSet represents a set of defined flags. The zero value of a FlagSet
// has no name and has ContinueOnError error handling.
//
// Flag names must be unique within a FlagSet. An attempt to define a flag whose
// name is already in use will cause a panic.
type FlagSet struct {
	// Usage is the function called when an error occurs while parsing flags.
	// The field is a function (not a method) that may be changed to point to
	// a custom error handler. What happens after Usage is called depends
	// on the ErrorHandling setting; for the command line, this defaults
	// to ExitOnError, which exits the program after calling Usage.
	Usage func()

	name          string
	parsed        bool
	actual        map[string]*Flag
	formal        map[string]*Flag
	args          []string // arguments after flags
	errorHandling ErrorHandling
	output        io.Writer // nil means stderr; use Output() accessor
}

// NewFlagSet returns a new, empty flag set with the specified name and
// error handling property. If the name is not empty, it will be printed
// in the default usage message and in error messages.
func NewFlagSet(name string, errorHandling ErrorHandling) *FlagSet {
	f := &FlagSet{
		name:          name,
		errorHandling: errorHandling,
	}
	f.Usage = f.defaultUsage
	return f
}
```

对于 FlagSet 最终要的是 Var 和 Parse 两个方法:

#### Var
Var 方法会把创建的 Flag 收集到 FlagSet 中

```go
// Var defines a flag with the specified name and usage string. The type and
// value of the flag are represented by the first argument, of type Value, which
// typically holds a user-defined implementation of Value. For instance, the
// caller could create a flag that turns a comma-separated string into a slice
// of strings by giving the slice the methods of Value; in particular, Set would
// decompose the comma-separated string into the slice.
func (f *FlagSet) Var(value Value, name string, usage string) {
	// Flag must not begin "-" or contain "=".
	if strings.HasPrefix(name, "-") {
		panic(f.sprintf("flag %q begins with -", name))
	} else if strings.Contains(name, "=") {
		panic(f.sprintf("flag %q contains =", name))
	}

	// Remember the default value as a string; it won't change.
	flag := &Flag{name, usage, value, value.String()}
	_, alreadythere := f.formal[name]
	if alreadythere {
		var msg string
		if f.name == "" {
			msg = f.sprintf("flag redefined: %s", name)
		} else {
			msg = f.sprintf("%s flag redefined: %s", f.name, name)
		}
		panic(msg) // Happens only if flags are declared with identical names
	}
	if f.formal == nil {
		f.formal = make(map[string]*Flag)
	}
	f.formal[name] = flag
}
```

在 Var 基础上，flag 为每种类型实现两种将 Flag 添加 FlagSet 的方法:
1. BoolVar: 事先准备一个 bool 类型的变量，并传入其指针
2. Bool: 创建一个 bool 变量并返回其指针

```go
// BoolVar defines a bool flag with specified name, default value, and usage string.
// The argument p points to a bool variable in which to store the value of the flag.
func (f *FlagSet) BoolVar(p *bool, name string, value bool, usage string) {
	f.Var(newBoolValue(value, p), name, usage)
}

// Bool defines a bool flag with specified name, default value, and usage string.
// The return value is the address of a bool variable that stores the value of the flag.
func (f *FlagSet) Bool(name string, value bool, usage string) *bool {
	p := new(bool)
	f.BoolVar(p, name, value, usage)
	return p
}
```

#### Parse
Parse 使用 Var 收集的 Flag 对命令行参数进行解析

```go
// Parse parses flag definitions from the argument list, which should not
// include the command name. Must be called after all flags in the FlagSet
// are defined and before flags are accessed by the program.
// The return value will be ErrHelp if -help or -h were set but not defined.
func (f *FlagSet) Parse(arguments []string) error {
	f.parsed = true
	f.args = arguments
	for {
		seen, err := f.parseOne()
		if seen {
			continue
		}
		if err == nil {
			break
		}
		switch f.errorHandling {
		case ContinueOnError:
			return err
		case ExitOnError:
			if err == ErrHelp {
				os.Exit(0)
			}
			os.Exit(2)
		case PanicOnError:
			panic(err)
		}
	}
	return nil
}
```

## 2. pflag
[pflag](https://github.com/spf13/pflag) 是对标准库 flag 的扩展。pflag 与 flag 非常相似，包括:
1. Flag
2. FlagSet
3. Value
4. SliceValue: 是 Value 的 slice

### 1. Flag
```go

// A Flag represents the state of a flag.
type Flag struct {
	Name                string              // name as it appears on command line
	Shorthand           string              // one-letter abbreviated flag
	Usage               string              // help message
	Value               Value               // value as set
	DefValue            string              // default value (as text); for usage message
	Changed             bool                // If the user set the value (or if left to default)
	NoOptDefVal         string              // default value (as text); if the flag is on the command line without any options
	Deprecated          string              // If this flag is deprecated, this string is the new or now thing to use
	Hidden              bool                // used by cobra.Command to allow flags to be hidden from help/usage text
	ShorthandDeprecated string              // If the shorthand of this flag is deprecated, this string is the new or now thing to use
	Annotations         map[string][]string // used by cobra.Command bash autocomple code
}

// Value is the interface to the dynamic value stored in a flag.
// (The default value is represented as a string.)
type Value interface {
	String() string
	Set(string) error
	Type() string
}

// SliceValue is a secondary interface to all flags which hold a list
// of values.  This allows full control over the value of list flags,
// and avoids complicated marshalling and unmarshalling to csv.
type SliceValue interface {
	// Append adds the specified value to the end of the flag value list.
	Append(string) error
	// Replace will fully overwrite any data currently in the flag value list.
	Replace([]string) error
	// GetSlice returns the flag value list as an array of strings.
	GetSlice() []string
}
```

### 1.2 参数解析
与 flag 类似，pflag 也为每个内置的基础类型重命名了新的类型，并为止实现了 Value 接口，依旧以 float64 为例:

```go
// -- float32 Value
type float32Value float32

func newFloat32Value(val float32, p *float32) *float32Value {
	*p = val
	return (*float32Value)(p)
}

func (f *float32Value) Set(s string) error {
	v, err := strconv.ParseFloat(s, 32)
	*f = float32Value(v)
	return err
}

func (f *float32Value) Type() string {
	return "float32"
}

func (f *float32Value) String() string { return strconv.FormatFloat(float64(*f), 'g', -1, 32) }
```

除了 float32Value 外，pflag 还是实现了 float64SliceValue ，用于解析一组 float64 参数。这个 float64SliceValue 同时实现了 Value 和 SliceValue 接口，因此 float64SliceValue 可以直接作为 Flag 的 Value 使用。

```go
// -- float64Slice Value
type float64SliceValue struct {
	value   *[]float64
	changed bool
}

func newFloat64SliceValue(val []float64, p *[]float64) *float64SliceValue {
	isv := new(float64SliceValue)
	isv.value = p
	*isv.value = val
	return isv
}
```

### 1.2 FlagSet
pflag 的 FlagSet 与 flag FlagSet 也很类似

```go
// A FlagSet represents a set of defined flags.
type FlagSet struct {
	// Usage is the function called when an error occurs while parsing flags.
	// The field is a function (not a method) that may be changed to point to
	// a custom error handler.
	Usage func()

	// SortFlags is used to indicate, if user wants to have sorted flags in
	// help/usage messages.
	SortFlags bool

	// ParseErrorsWhitelist is used to configure a whitelist of errors
	ParseErrorsWhitelist ParseErrorsWhitelist

	name              string
	parsed            bool
	actual            map[NormalizedName]*Flag
	orderedActual     []*Flag
	sortedActual      []*Flag
	formal            map[NormalizedName]*Flag
	orderedFormal     []*Flag
	sortedFormal      []*Flag
	shorthands        map[byte]*Flag
	args              []string // arguments after flags
	argsLenAtDash     int      // len(args) when a '--' was located when parsing, or -1 if no --
	errorHandling     ErrorHandling
	output            io.Writer // nil means stderr; use Output() accessor
	interspersed      bool      // allow interspersed option/non-option args
	normalizeNameFunc func(f *FlagSet, name string) NormalizedName

	addedGoFlagSets []*goflag.FlagSet
}
```

pflag Flagset 的实现中:
1. Parse/ParseAll: 解析参数
2. Var/VarP: 向 FlagSet 添加 Flag


#### Var/VarP
无论是 Var 还是 VarP 最终调用的还是 VarPF --> AddFlag。

```go
func (f *FlagSet) Var(value Value, name string, usage string) {
	f.VarP(value, name, "", usage)
}

// VarPF is like VarP, but returns the flag created
func (f *FlagSet) VarPF(value Value, name, shorthand, usage string) *Flag {
	// Remember the default value as a string; it won't change.
	flag := &Flag{
		Name:      name,
		Shorthand: shorthand,
		Usage:     usage,
		Value:     value,
		DefValue:  value.String(),
	}
	f.AddFlag(flag)
	return flag
}

// VarP is like Var, but accepts a shorthand letter that can be used after a single dash.
func (f *FlagSet) VarP(value Value, name, shorthand, usage string) {
	f.VarPF(value, name, shorthand, usage)
}
```

在 Var/VarP 基础上，flag 为每种类型实现两种将 Flag 添加 FlagSet 的方法:

```go
// 1. 事先提供 float64 变量，传入其指针 
func (f *FlagSet) Float64Var(p *float64, name string, value float64, usage string) {
	f.VarP(newFloat64Value(value, p), name, "", usage)
}

// Float64VarP is like Float64Var, but accepts a shorthand letter that can be used after a single dash.
func (f *FlagSet) Float64VarP(p *float64, name, shorthand string, value float64, usage string) {
	f.VarP(newFloat64Value(value, p), name, shorthand, usage)
}

// 2. 创建一个 float64 变量并返回其指针
func (f *FlagSet) Float64(name string, value float64, usage string) *float64 {
	p := new(float64)
	f.Float64VarP(p, name, "", value, usage)
	return p
}

// Float64P is like Float64, but accepts a shorthand letter that can be used after a single dash.
func (f *FlagSet) Float64P(name, shorthand string, value float64, usage string) *float64 {
	p := new(float64)
	f.Float64VarP(p, name, shorthand, value, usage)
	return p
}
```

可以这么总结:
1. 包含 P: 表示可以设置短变量
2. 包含 Var: 表示方法返回一个变量

最有 pflag 与 flag 不同的是，pflag FlagSet 提供了通过 name 获取命令行参数值的方法，这样我们就无需把单个变量传来传去。

```go
func (f *FlagSet) GetFloat64(name string) (float64, error) {
	val, err := f.getFlagType(name, "float64", float64Conv)
	if err != nil {
		return 0, err
	}
	return val.(float64), nil
}
```

#### Parse/ParseAll
Parse 方法中提供了了默认的参数解析函数 set，其实就是调用 Flag 的 Set 方法。而 ParseAll 支持传入一个 `func(flag *Flag, value string) error`。

```go
func Parse() {
	// Ignore errors; CommandLine is set for ExitOnError.
	CommandLine.Parse(os.Args[1:])
}

func (f *FlagSet) Parse(arguments []string) error {
	if f.addedGoFlagSets != nil {
		for _, goFlagSet := range f.addedGoFlagSets {
			goFlagSet.Parse(nil)
		}
	}
	f.parsed = true

	if len(arguments) < 0 {
		return nil
	}

	f.args = make([]string, 0, len(arguments))

	set := func(flag *Flag, value string) error {
		return f.Set(flag.Name, value)
	}

	err := f.parseArgs(arguments, set)
	if err != nil {
		switch f.errorHandling {
		case ContinueOnError:
			return err
		case ExitOnError:
			fmt.Println(err)
			os.Exit(2)
		case PanicOnError:
			panic(err)
		}
	}
	return nil
}
```
