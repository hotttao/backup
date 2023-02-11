---
weight: 1
title: "Go 测试"
date: 2023-01-01T22:00:00+08:00
lastmod: 2023-01-01T22:00:00+08:00
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

本部分将详细介绍Go在单元测试、性能测试的最佳实践方案。

## 1. 单元测试
Go语言在工具链和标准库中提供对测试的原生支持。在Go中测试代码与包代码放在同一个包目录下，并且Go要求所有测试代码都存放在以*_test.go结尾的文件中。go test将所有包目录下的`*_test.go`文件编译成一个临时二进制文件（可以通过go test -c显式编译出该文件），并执行该文件，后者将执行各个测试源文件中名字格式为TestXxx的函数所代表的测试用例并输出测试执行结果。

### 1.1 包内测试与包外测试
go 的单元测试主要使用 go test 命令和 testing 包。
1. testing包的官方文档说: 要编写一个新的测试集（test suite），创建一个包含TestXxx函数的以_test.go为文件名结尾的文件。将这个测试文件放在与被测试包相同的包下面。编译被测试包时，该文件将被排除在外；执行go test时，该文件将被包含在内。
2. go test命令行工具的官方文档则说: 那些包名中带有_test后缀的测试文件将被编译成一个独立的包，这个包之后会被链接到主测试二进制文件中并运行。

对比这两段官方文档，我们发现了一处“自相矛盾”的地方：testing包文档告诉我们将测试代码放入与被测试包同名的包中，而go test命令行帮助文档则提到会将包名中带有_test后缀的测试文件编译成一个独立的包。如果我们要测试的包为foo，testing包的帮助文档告诉我们把对foo包的测试代码放在包名为foo的测试文件中；而go test命令行帮助文档则告诉我们把foo包的测试代码放在包名为foo_test的测试文件中。
1. 我们把将测试代码放在与被测包同名的包中的测试方法称为“包内测试”。
2. 我们把将测试代码放在名为被测包包名+"_test"的包中的测试方法称为“包外测试”。

```bash
# 查看哪些测试源文件使用了包内测试
go list -f={{.TestGoFiles}} .

# 查看哪些测试源文件使用了包外测试
go list -f={{.XTestGoFiles}} .
```

#### 包内测试的优势与不足
由于Go构建工具链在编译包时会自动根据文件名是否具有_test.go后缀将包源文件和包的测试源文件分开，测试代码不会进入包正常构建的范畴，因此测试代码使用与被测包名相同的包内测试方法是一个很自然的选择:
1. 包内测试这种方法本质上是一种**白盒测试方法**。由于**测试代码与被测包源码在同一包名下，测试代码可以访问该包下的所有符号，无论是导出符号还是未导出符号**；
2. 并且由于包的内部实现逻辑对测试代码是透明的，包内测试可以更为直接地构造测试数据和实施测试逻辑，可以很容易地达到较高的测试覆盖率。因此对于追求高测试覆盖率的项目而言，包内测试是不二之选。

但同样的包内测试也会存在一些问题:
1. 测试代码自身需要经常性的维护: 包内测试的白盒测试本质意味着它是一种面向实现的测试。
2. 硬伤：包循环引用

![包循环引用](/images/go/expert/dead_dependence.png)

包c进行测试的代码（c_test.go）采用了包内测试的方法，其测试代码位于包c下面，测试代码导入并引用了包d，而包d本身却导入并引用了包c，这种包循环引用是Go编译器所不允许的。

#### 包外测试（仅针对导出API的测试）
与包内测试本质是面向实现的白盒测试不同，包外测试的本质是一种面向接口的黑盒测试。这里的“接口”指的就是被测试包对外导出的API，这些API是被测包与外部交互的契约。

契约一旦确定就会长期稳定，这一本质让包外测试代码与被测试包充分解耦，使得针对这些导出API进行测试的包外测试代码表现出十分健壮的特性

包外测试将测试代码放入不同于被测试包的独立包的同时，也使得包外测试不再像包内测试那样存在“包循环引用”的硬伤。

包外测试这种纯黑盒的测试还有一个功能域之外的好处，那就是可以更加聚焦地从用户视角验证被测试包导出API的设计的合理性和易用性。

不过包外测试的不足也是显而易见的，那就是存在测试盲区，很容易出现对被测试包的测试覆盖不足的情况。

#### 安插后门
针对包外测试，测试覆盖不足的问题，Go标准库的实现者们提供了一个解决这个问题的惯用法"安插后门"：export_test.go。该文件中的代码位于被测包名下，但它既不会被包含在正式产品代码中（因为位于_test.go文件中），又不包含任何测试代码，而仅用于将被测包的内部符号在测试阶段暴露给包外测试代码：

```go
// $GOROOT/src/fmt/export_test.go
package fmt

var IsSpace = isSpace
var Parsenum = parsenum
```

或者定义一些辅助包外测试的代码，比如扩展被测包的方法集合：

```go
// $GOROOT/src/strings/export_test.go
package strings

func (r *Replacer) Replacer() interface{} {
    r.once.Do(r.buildOnce)
    return r.r
}

func (r *Replacer) PrintTrie() string {
    r.once.Do(r.buildOnce)
    gen := r.r.(*genericReplacer)
    return gen.printNode(&gen.root, 0)
}
```

![export_test.go](/images/go/expert/export_test.png)

export_test.go仅在go test阶段与被测试包（fmt）一并被构建入最终的测试二进制文件中。在这个过程中，包外测试代码（fmt_test）可以通过导入被测试包（fmt）来访问export_test.go中的导出符号（如IsSpace或对fmt包的扩展）。而export_test.go相当于在测试阶段扩展了包外测试代码的视野，让很多本来很难覆盖到的测试路径变得容易了，进而让包外测试覆盖更多被测试包中的执行路径。

#### 总结
个人更倾向于优先选择包外测试，理由如下。包外测试可以：
1. 优先保证被测试包导出API的正确性；
2. 可从用户角度验证导出API的有效性；
3. 保持测试代码的健壮性，尽可能地降低对测试代码维护的投入；
4. 不失灵活！可通过export_test.go这个“后门”来导出我们需要的内部符号，满足窥探包内实现逻辑的需求。

当然go test也完全支持对被测包同时运用包内测试和包外测试两种测试方法，在这种情况下，包外测试由于将测试代码放入独立的包中，它更适合编写偏向集成测试的用例，它可以任意导入外部包，并测试与外部多个组件的交互。而包内测试更聚焦于内部逻辑的测试，通过给函数/方法传入一些特意构造的数据的方式来验证内部逻辑的正确性。

我们还可以通过测试代码的文件名来区分所属测试类别，比如：net/http包就使用transport_internal_test.go这个名字来明确该测试文件采用包内测试的方法，而对应的transport_test.go则是一个采用包外测试的源文件。

### 1.2 测试代码组织

#### 平铺模式
go test并没有对测试代码的组织提出任何约束条件。最简单就是平铺模式: 测试函数各自独立，测试函数之间没有层级关系，所有测试平铺在顶层。测试函数名称既用来区分测试，又用来关联测试。

```go
// -run提供正则表达式来匹配并选择执行哪些测试函数
go test -run=TestCompare -v .
```

#### xUnit家族模式
使用了xUnit家族单元测试框架的典型测试代码组织形式如下图所示:

![xUnit](/images/go/expert/xUnit.png)

这种测试代码组织形式主要有测试套件（Test Suite）和测试用例（Test Case）两个层级。Go 1.7中加入的对subtest的支持让我们在Go中也可以使用上面这种方式组织Go测试代码。

```go
func testCompare(t *testing.T) {
	for _, tt := range compareTests {
		cmp := strings.Compare(tt.a, tt.b)
		if cmp != tt.i {
			t.Errorf(`Compare(%q, %q) = %v`, tt.a, tt.b, cmp)
		}
	}
}

func testCompareIdenticalString(t *testing.T) {
	var s = "Hello Gophers!"
	if strings.Compare(s, s) != 0 {
		t.Error("s != s")
	}
	if strings.Compare(s, s[:1]) != 1 {
		t.Error("s > s[:1] failed")
	}
}

func testCompareStrings(t *testing.T) {
}

func TestCompare(t *testing.T) {
	t.Run("Compare", testCompare)
	t.Run("CompareString", testCompareStrings)
	t.Run("CompareIdenticalString", testCompareIdenticalString)
}
```

两种测试模式的结构对比如下图所示:

![测试模式对比](/images/go/expert/test_model.png)

改造后的名字形如TestXxx的测试函数对应着测试套件，一般针对被测包的一个导出函数或方法的所有测试都放入一个测试套件中。平铺模式下的测试函数TestXxx都改名为testXxx，并作为测试套件对应的测试函数内部的子测试（subtest）。这样的一个子测试等价于一个测试用例。通过对比，我们看到，仅通过查看测试套件内的子测试（测试用例）即可全面了解到究竟对被测函数/方法进行了哪些测试。

### 1.3 测试固件
测试固件(test fixture)是指一个人造的、确定性的环境。我们一般使用setUp和tearDown来代表测试固件的创建/设置与拆除/销毁的动作。

在传统的平铺模式下，由于每个测试函数都是相互独立的，们需要为每个TestXxx测试函数单独创建和销毁测试固件。

```go
// chapter8/sources/classic_testfixture_test.go
package demo_test
...
func setUp(testName string) func() {
    fmt.Printf("\tsetUp fixture for %s\n", testName)
    return func() {
        fmt.Printf("\ttearDown fixture for %s\n", testName)
    }
}

func TestFunc1(t *testing.T) {
    defer setUp(t.Name())()
    fmt.Printf("\tExecute test: %s\n", t.Name())
}
```

在setUp中返回匿名函数来实现tearDown的好处是，可以在setUp中利用闭包特性在两个函数间共享一些变量，避免了包级变量的使用。Go 1.14版本testing包增加了testing.Cleanup方法，为测试固件的销毁提供了包级原生的支持：

```go
func setUp() func(){
    ...
    return func() {
    }
}

func TestXxx(t *testing.T) {
    t.Cleanup(setUp())
    ...
}
```

有些时候，我们需要将所有测试函数放入一个更大范围的测试固件环境中执行，这就是**包级别测试固件**。Go 1.4版本引入了TestMain 用于创建和销毁包级别测试固件

```go
// chapter8/sources/classic_package_level_testfixture_test.go
package demo_test

...
func setUp(testName string) func() {
    fmt.Printf("\tsetUp fixture for %s\n", testName)
    return func() {
        fmt.Printf("\ttearDown fixture for %s\n", testName)
    }
}

func TestFunc3(t *testing.T) {
    t.Cleanup(setUp(t.Name()))
    fmt.Printf("\tExecute test: %s\n", t.Name())
}

func TestFunc2(t *testing.T) {
    t.Cleanup(suiteSetUp(t.Name()))
    t.Run("testcase1", func2TestCase1)
    t.Run("testcase2", func2TestCase2)
    t.Run("testcase3", func2TestCase3)
}


func pkgSetUp(pkgName string) func() {
    fmt.Printf("package SetUp fixture for %s\n", pkgName)
    return func() {
        fmt.Printf("package TearDown fixture for %s\n", pkgName)
    }
}

func TestMain(m *testing.M) {
    defer pkgSetUp("package demo_test")()
    m.Run()
}
```

使用 xUnit 模式创建测试固件的方法与平铺模式完全相同，通过组合，就可以形成一种多层次的、更灵活的测试固件设置体系。

![测试固件设置体系](/images/go/expert/test_fixture.png)

### 1.4 表驱动的测试
Go的测试函数就是一个普通的Go函数，Go仅对测试函数的函数名和函数原型有特定要求，对测试失败与否的判断在于测试代码逻辑是否进入了包含Error/Errorf、Fatal/Fatalf等方法调用的代码分支。一旦进入这些分支，即代表该测试失败。不同的是Error/Errorf并不会立刻终止当前goroutine的执行，还会继续执行该goroutine后续的测试，而Fatal/Fatalf则会立刻停止当前goroutine的测试执行。

表驱动测试十分适合Go代码测试，我们看下面这个示例:

```go
// chapter8/sources/table_driven_strings_with_subtest_test.go
func TestCompare(t *testing.T) {
    compareTests := []struct {
        name, a, b string
        i          int
    }{
        {`compareTwoEmptyString`, "", "", 0},
        {`compareSecondParamIsEmpty`, "a", "", 1},
        {`compareFirstParamIsEmpty`, "", "a", -1},
    }

    for _, tt := range compareTests {
        t.Run(tt.name, func(t *testing.T) {
            cmp := strings.Compare(tt.a, tt.b)
            if cmp != tt.i {
                t.Errorf(`want %v, but Compare(%q, %q) = %v`, tt.i, tt.a, tt.b, cmp)
            }
        })
    }
}
```

在示例中，我们将测试结果的判定逻辑放入一个单独的子测试中，这样可以单独执行表中某项数据的测试:

```go
$go test -v  -run /TwoEmptyString table_driven_strings_with_subtest_test.go
```

#### 测试失败的定位
对于非表驱动的测试，在测试失败时，我们往往通过失败点所在的行数即可判定究竟是哪块测试代码未通过，但在表驱动的测试中，由于一般情况下表驱动的测试的测试结果成功与否的判定逻辑是共享的，因此再通过行数来定位问题就不可行了。

为了在表测试驱动的测试中快速从输出的结果中定位导致测试失败的表项，我们需要在测试失败的输出结果中输出数据表项的唯一标识。最简单的方法是通过输出数据表项在数据表中的偏移量来辅助定位“元凶”：

```go
// chapter8/sources/table_driven_strings_by_offset_test.go
func TestCompare(t *testing.T) {
    compareTests := []struct {
        a, b string
        i    int
    }{
        {"", "", 7},
        {"a", "", 6},
        {"", "a", -1},
    }

    for i, tt := range compareTests {
        cmp := strings.Compare(tt.a, tt.b)
        if cmp != tt.i {
            t.Errorf(`[table offset: %v] want %v, but Compare(%q, %q) = %v`, i+1, tt.i, tt.a, tt.b, cmp)
        }
    }
}
```

另一个更直观的方式是使用名字来区分不同的数据项：

```go
// chapter8/sources/table_driven_strings_by_name_test.go
func TestCompare(t *testing.T) {
    compareTests := []struct {
        name, a, b string
        i          int
    }{
        {"compareTwoEmptyString", "", "", 7},
        {"compareSecondStringEmpty", "a", "", 6},
        {"compareFirstStringEmpty", "", "a", -1},
    }

    for _, tt := range compareTests {
        cmp := strings.Compare(tt.a, tt.b)
        if cmp != tt.i {
            t.Errorf(`[%s] want %v, but Compare(%q, %q) = %v`, tt.name, tt.i, tt.a, tt.b, cmp)
        }
    }
}
```

个人推荐这种方式，结合自测试，可以更灵活的执行单元测试，便于排错。

#### Errorf还是Fatalf
一般而言，如果一个数据项导致的测试失败不会对后续数据项的测试结果造成影响，那么推荐Errorf，这样可以通过执行一次测试看到所有导致测试失败的数据项；否则，如果数据项导致的测试失败会直接影响到后续数据项的测试结果，那么可以使用Fatalf让测试尽快结束，因为继续执行的测试的意义已经不大了。

### 1.5 testdata
Go语言规定：Go工具链将忽略名为testdata的目录。这样开发者在编写测试时，就可以在名为testdata的目录下存放和管理测试代码依赖的数据文件。而go test命令在执行时会将被测试程序包源码所在目录设置为其工作目录，这样如果要使用testdata目录下的某个数据文件，我们无须再处理各种恼人的路径问题，而可以直接在测试代码中像下面这样定位到充当测试固件的数据文件：

```go
f, err := os.Open("testdata/data-001.txt")
f, err := os.Open(filepath.Join("testdata", "data-001.txt"))
```

#### golden 文件惯用法
我们经常将预期结果数据保存在文件中并放置在testdata下，用于测试结果的比较基准。那我们怎么得到这些 golden 文件，能否把将预期数据采集到文件的过程与测试代码融合到一起呢？Go标准库为我们提供了一种惯用法：golden文件。

```go
var update = flag.Bool("update", false, "update .golden files")

func TestAttendeeMarshal(t *testing.T) {
    for _, tt := range tests {
        got, err := xml.MarshalIndent(&tt.a, "", "  ")
        if err != nil {
            t.Fatalf("want nil, got %v", err)
        }
        // update的变量以及它所控制的golden文件的预期结果数据采集过程
        golden := filepath.Join("testdata", tt.fileName)
        if *update {
            ioutil.WriteFile(golden, got, 0644)
        }
        want, err := ioutil.ReadFile(golden)
        if err != nil {
            t.Fatalf("open file %s failed: %v", tt.fileName, err)
        }
        if !bytes.Equal(got, want) {
            t.Errorf("want %s, got %s", string(want), string(got))
        }

    }
}
```
这个测试代码中，有一个名为 update 的变量以及它所控制的golden文件的预期结果数据采集过程。

```go
go test -v . -update
```

带有-update命令参数的go test命令仅在需要进行预期结果数据采集时才会执行，尤其是在因数据生成逻辑或类型结构定义发生变化，需要重新采集预期结果数据时。采用golden文件惯用法后，要格外注意在每次重新采集预期结果后，对golden文件中的数据进行正确性检查，否则很容易出现预期结果数据不正确，但测试依然通过的情况。

### 1.6 fake/stub/mock
测试过程中，除了对外部文件数据的依赖之外，还会经常面对被测代码对外部业务组件或服务的依赖。我们需要为这些被测代码提供其依赖的外部组件或服务的替身。替身概念出自于测试驱动编程，xUnit家族框架总结出多种替身，比如fake、stub、mock等。这些概念及其应用模式被汇集在[xUnit Test Patterns](https://book.douban.com/subject/1859393/)一书中。接下来我们就来看看这些替身在 go 单元测试中的应用。

#### fake
fake 实现的替身不具备在测试前对返回结果进行预设置的能力，我们看下面这个例子:

```go
type mailClient struct {
	mlr mailer.Mailer
}

type Mailer interface {
	SendMail(subject, destination, body string) error
}

```

mailClient 的实现依赖 mailer.Mailer 接口，生产环境中用于发送邮件，单元测试中不可能真的准备一个邮件服务。我们可以 fake 出 Mailer 接口两个简化版的实现：fakeOkMailer和fakeFailMailer，前者代表发送成功，后者代表发送失败。

```go
type fakeOkMailer struct{}

func (m *fakeOkMailer) SendMail(subject string, dest string, body string) error {
	return nil
}

func TestComposeAndSendOk(t *testing.T) {
	m := &fakeOkMailer{}
	mc := mailclient.New(m)
	_, err := mc.ComposeAndSend("hello, fake test", []string{"xxx@example.com"}, "the test body")
	if err != nil {
		t.Errorf("want nil, got %v", err)
	}
}

type fakeFailMailer struct{}

func (m *fakeFailMailer) SendMail(subject string, dest string, body string) error {
	return fmt.Errorf("can not reach the mail server of dest [%s]", dest)
}

func TestComposeAndSendFail(t *testing.T) {
	m := &fakeFailMailer{}
	mc := mailclient.New(m)
	_, err := mc.ComposeAndSend("hello, fake test", []string{"xxx@example.com"}, "the test body")
	if err == nil {
		t.Errorf("want non-nil, got nil")
	}
}
```

使用fake替身进行测试的最常见理由是在测试环境无法构造被测代码所依赖的外部组件或服务，或者这些组件/服务有副作用。但是 fake 替身不具备在测试前对返回结果进行预设置的能力。如果非要说成功和失败也是预设置的，那么fake替身的预设置能力也仅限于设置单一的返回值，即无论调用多少次，传入什么参数，返回值都是一个。

#### stub
stub也是一种替身概念，和fake替身相比，stub替身增强了对替身返回结果的间接控制能力，这种控制可以通过测试前对调用结果预设置来实现。不过，stub替身通常仅针对计划之内的结果进行设置，对计划之外的请求也无能为力。

在GitHub上有一个名为[gostub](https://github.com/prashantv/gostub)的第三方包可以用于简化stub替身的管理和编写。下面是一个使用的示例:

```go
func TestComposeAndSendWithSign(t *testing.T) {
    sender := "tonybai@example.com"
    timestamp := "Mon, 04 May 2020 11:46:12 CST"

    stubs := gostub.Stub(&getSign, func(sender string) string {
        selfSignTxt := senderSigns[sender]
        return selfSignTxt + "\n" + timestamp
    })
    defer stubs.Reset()
    ...
}
```

#### mock
和fake、stub替身相比，mock替身更为强大：它除了能提供测试前的**预设置返回结果**能力之外，还可以对mock替身对象在测试过程中的行为进行观察和验证。不过相比于前两种替身形式，mock存在应用局限（尤指在Go中）:
1. 和前两种替身相比，mock的应用范围要窄很多，只用于实现某接口的实现类型的替身。
2. 一般需要通过第三方框架实现mock替身。Go官方维护了一个mock框架——[gomock](https://github.com/golang/mock)，该框架通过代码生成的方式生成实现某接口的替身类型。

gomock是一个通用的mock框架，社区还有一些专用的mock框架可用于快速创建mock替身，比如：[go-sqlmock](https://github.com/DATA-DOG/go-sqlmock)专门用于创建sql/driver包中的Driver接口实现的mock替身，可以帮助Gopher简单、快速地建立起对数据库操作相关方法的单元测试。

mock 一般实现起来，都需要借助语言本身提供的反射能力，用法比较复杂，常规的单元测试中不建议使用。

#### 总结
我们更多在包内测试应用上述替身概念辅助测试，这就意味着此类测试与被测代码是实现级别耦合的，这样的测试健壮性较差，一旦被测代码内部逻辑有变化，测试极容易失败。通过fake、stub、mock等概念实现的替身参与的测试毕竟是在一个虚拟的“沙箱”环境中，不能代替与真实依赖连接的测试，因此，在集成测试或系统测试等使用真实外部组件或服务的测试阶段，务必包含与真实依赖的联测用例。

## 2. go-fuzz 模糊测试
暂略
