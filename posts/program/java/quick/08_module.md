---
weight: 1
title: "Java 模块"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 如何定义和导入模块"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. 模块
问: 以表格的方式，对比 java 和 go 的包，并给出代码示例

下面是Java和Go两种语言的包特性的对比表格，包括导入方式、包路径、包可见性、包初始化、文档注释、版本管理、发布和共享、包的引用、包的测试。

| 特性           | Java                                       | Go                                                           |
|---------------|--------------------------------------------|--------------------------------------------------------------|
| 导入方式      | 使用 `import` 关键字导入包                    | 使用 `import` 关键字导入包                                      |
| 包路径        | 使用层次化的包路径，例如 `java.util` <br> Java文件对应的目录层次要和包的层次一致。        | 使用简单的包路径，例如 `fmt`                                    |
| 包可见性      | 使用关键字 `public`、`protected`、`private`等 | 使用首字母大小写来区分包的可见性                                |
| 包初始化      | 使用静态块和静态变量初始化包                 | 使用 `init` 函数进行包的初始化                                 |
| 文档注释      | 使用 Javadoc 注释生成包的文档                | 使用 `//` 或 `/* ... */` 注释来生成包的文档                    |
| 版本管理      | 使用 Maven 或 Gradle 进行版本管理            | 使用 Go Modules 进行版本管理                                   |
| 发布和共享    | 通过 Maven 中央仓库或其他私有仓库进行发布和共享 | 通过 Go Modules、GitHub 或其他仓库进行包的发布和共享           |
| 包的引用      | 使用全限定名引用其他包中的类或方法            | 使用包名直接引用其他包中的函数或变量                           |
| 包的测试      | 使用 JUnit 或其他测试框架进行单元测试         | 使用 Go 的内置测试工具或第三方测试框架进行单元测试             |

以下是Java和Go的代码示例：

在Java中导入包：

```java
import java.util.List;
import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>();
        // 使用java.util包中的ArrayList类和List接口
    }
}
```

在Go中导入包：
```go
import "fmt"

func main() {
    fmt.Println("Hello, world!")
    // 使用fmt包中的Println函数
}
```

定义Java包可见性：
```java
public class MyClass {
    public int publicVariable;
    protected int protectedVariable;
    private int privateVariable;
}
```

定义Go包可见性：
```go
package mypackage

var PublicVariable int
var protectedVariable int // Go中的小写字母开头表示包内可见
var privateVariable int   // Go中的小写字母开头表示包内可见
```

Java包初始化：
```java
public class MyPackage {
    static {
        System.out.println("Initializing MyPackage");
        // 进行包的初始化工作
    }
}
```

Go包初始化：
```go
package mypackage

func init() {
    fmt.Println("Initializing MyPackage")
    // 进行包的初始化工作
}
```

Java包的文档注释：
```java
/**
 * This is a package-level documentation comment.
 * It provides information about the package.
 */
package mypackage;
```

Go包的文档注释：


```go
/*
Package mypackage provides ...
*/
package mypackage
```

## 2. Java 包的声明和导入
问: Java 包的声明和导入

在Java中，包的声明和导入是用于组织和管理类和资源的重要机制。下面是Java中包的声明和导入的示例和说明：

### 2.1 包的声明

包的声明用于指定类所属的包。它必须是Java源文件的第一条非注释语句。以下是包的声明的示例：

```java
package com.example.myapp;
```

在示例中，`com.example.myapp`是包的名称。包名通常使用小写字母，并以域名倒序的方式命名，以确保唯一性。因为Java文件对应的目录层次要和包的层次一致，所以 Java 项目的对应目录结构如下:

```java
package_sample
└─ src
    ├─ com
    │  └─ example
    │        └─ myapp
    │             └─ Person.java
```

### 2.2 包的导入
在Java中，导入类有几种方式
1. 直接写出完整类名:
  - `mr.jun.Arrays arrays = new mr.jun.Arrays();`
  - 无需使用 import 导入，直接写出完整类名
2. 导入单个类
  - `import com.example.myapp.MyClass;`
  - 导入单个类允许在代码中直接使用该类，而无需使用完全限定的类名。如上，在代码中直接使用`MyClass`
3. 导入整个包
  - `import com.example.myapp.*;`
  - 导入整个包允许在代码中使用该包中的所有类，而无需逐个导入。如上，可以在代码中直接使用该包中的类
4. 静态导入
  - `import static com.example.myapp.MyClass.myStaticField;`
  - `import static com.example.myapp.MyClass.myStaticMethod;`
  - 静态导入用于导入类的静态成员（字段和方法），以便在代码中直接使用这些静态成员，而无需使用类名限定。如上，可以在代码中直接使用 myStaticMethod、myStaticField
5. 默认导入:
  - Java默认会自动导入一些常用的类，如`java.lang`包中的类

导入语句通常位于Java源文件的顶部，位于包的声明之后。可以根据需要导入多个类或包，每个导入语句占据一行。

如果类的完整路径未指定，只是使用类名来引用类，则编译器将按照下述优先级从高到低的顺序搜索类:

1. 在当前包中的类具有最高优先级。如果当前包中存在相同名称的类，它将被优先使用。
2. 导入的特定类具有次高优先级。如果已经导入了一个特定的类，它将被优先使用。
3. 导入的整个包具有最低优先级。如果存在多个导入的包中都有相同名称的类，编译器将无法确定使用哪个类，此时需要使用完整的类路径来引用特定的类。
4. 查找java.lang包是否包含这个class

如果按照上面的规则还无法确定类名，则编译报错。因此，编写class的时候，编译器会自动帮我们做两个import动作：

1. 默认自动import当前package的其他class；
2. 默认自动import java.lang.*

## 3. 包的搜索路径
问: Java 包的搜索路径

Java的包搜索路径是由类加载器（ClassLoader）来管理的。类加载器按照特定的顺序搜索类文件和依赖的包。以下是Java包的搜索路径的一般规则：

1. 启动类加载器（Bootstrap ClassLoader）：负责加载Java核心类库，它是Java虚拟机的一部分，搜索路径包括`jre/lib`目录和`-Xbootclasspath`选项指定的路径。
2. 扩展类加载器（Extension ClassLoader）：负责加载Java扩展类库，搜索路径包括`jre/lib/ext`目录和`java.ext.dirs`系统属性指定的路径。
3. 应用类加载器（Application ClassLoader）：也称为系统类加载器，负责加载应用程序的类，搜索路径包括`classpath`指定的路径、当前工作目录和`java.class.path`系统属性指定的路径。
4. 自定义类加载器：开发人员可以自定义类加载器，通过继承`ClassLoader`类并重写相应方法来实现自定义的类加载逻辑。

注意，类加载器按照委派模型（Delegation Model）进行工作，即先由父类加载器尝试加载类，只有在父类加载器找不到类的情况下，才由子类加载器尝试加载类。

### 3.1 classpath
classpath的设定方法有两种：
1. 在系统环境变量中设置 CLASSPATH 环境变量，不推荐；
2. 在启动JVM时设置classpath变量，推荐。即给java命令传入`-classpath`或`-cp`参数

```shell
java -classpath .;C:\work\project1\bin;C:\shared abc.xyz.Hello
java -cp .;C:\work\project1\bin;C:\shared abc.xyz.Hello
```

### 4. 编译与运行
假设我们创建了如下的目录结构：
1. bin目录用于存放编译后的class文件
2. src目录按包结构存放Java源码
```
work
├── bin
└── src
    └── com
        └── itranswarp
            ├── sample
            │   └── Main.java
            └── world
                └── Person.java
```

### 4.1 编译
编译src目录下的所有Java文件：

```shell
cd work
# -d指定输出的class文件存放bin目录，
# src/**/*.java表示src目录下的所有.java文件，包括任意深度的子目录
# Windows不支持**，必须依次列出所有.java文件
javac -d ./bin src/**/*.java
```

编译后结果如下:

```shell
bin
└── com
    └── itranswarp
        ├── sample
        │   └── Main.class
        └── world
            └── Person.class
```

### 4.2 运行
编译后，可以直接运行class文件:

```shell
cd work
java -cp bin com.itranswarp.sample.Main 
```

## 5. jar 包
jar包可以把 package 组织的目录层级，以及各个目录下的所有文件（包括.class文件和其他文件）都打成一个jar文件，jar包实际上就是一个 zip 格式的压缩文件，而**jar包相当于目录**。如果我们要执行一个jar包的class，就可以把jar包放到classpath中。

如何创建jar包？以上面编译结果为例，对bin目录，生成 zip 压缩包。然后，把后缀从.zip改为.jar，一个jar包就创建成功。压缩包内的目录结构，就是 java 搜索类的目录结构。

jar包还可以包含一个特殊的/META-INF/MANIFEST.MF文件，MANIFEST.MF是纯文本，可以指定Main-Class和其它信息。JVM会自动读取这个MANIFEST.MF文件，如果存在Main-Class，我们就不必在命令行指定启动的类名，而是用更方便的命令：`java -jar hello.jar`。构建工具，例如Maven，可以非常方便地创建jar包和 MANIFEST.MF文件。

### 5. 包的初始化顺序
问: java 包的初始化顺序

在Java中，包的初始化顺序是按照以下顺序进行的：

1. 父包的初始化：如果包内有嵌套的子包，那么子包的初始化会在父包之后进行。
2. 静态变量和静态块的初始化：在包内的类中，静态变量和静态块的初始化按照它们在类中出现的顺序进行。静态变量会在类加载的过程中被初始化，而静态块会在类加载时执行。
3. 类的初始化：包内的类会按照它们在源代码中的顺序进行初始化。在类初始化过程中，会先初始化父类（如果有继承关系），然后再初始化子类。

需要注意的是，包级别的初始化顺序是由类加载器负责管理的，而不是由包本身控制的。类加载器根据类的依赖关系和访问顺序来确定类的加载和初始化顺序。

另外，包级别的初始化只会在第一次使用包内的类或静态成员时进行。如果没有使用包内的类或静态成员，那么包级别的初始化过程就不会触发。

总之，在Java中，包的初始化顺序是按照父包优先、静态变量和静态块优先、类的初始化按照类的出现顺序进行的。这个初始化顺序可以帮助我们理解和控制包内的类和静态成员的初始化过程。


## 6. 模块
从前面可知，jar 包只是 class 的压缩包，并不包含任何 jar 包之前的依赖关系。

### 6.1 编写模块

```shell
oop-module
├── bin
├── build.sh
└── src
    ├── com
    │   └── itranswarp
    │       └── sample
    │           ├── Greeting.java
    │           └── Main.java
    └── module-info.java
```

module-info.java这个文件，这就是模块的描述文件:

```java
module hello.world {
	requires java.base; // 可不写，任何模块都会自动引入java.base
	requires java.xml;
}
```

当我们使用模块声明了依赖关系后，才能使用引入的模块。

### 6.2 编译运行

```shell
cd oop-module
javac -d bin src/module-info.java src/com/itranswarp/sample/*.java
tree .
  oop-module
  ├── bin
  │   ├── com
  │   │   └── itranswarp
  │   │       └── sample
  │   │           ├── Greeting.class
  │   │           └── Main.class
  │   └── module-info.class
  └── src
      ├── com
      │   └── itranswarp
      │       └── sample
      │           ├── Greeting.java
      │           └── Main.java
      └── module-info.java

# 生成 jar 包
jar --create --file hello.jar --main-class com.itranswarp.sample.Main -C bin .
# 生成 jmod
jmod create --class-path hello.jar hello.jmod
# 运行 jmod
java --module-path hello.jar --module hello.world
```

### 6.3 生成 jre
为了表明Java模块化的决心，从Java 9开始，原有的Java标准库已经由一个单一巨大的rt.jar分拆成了几十个模块，这些模块以.jmod扩展名标识，可以在$JAVA_HOME/jmods目录下找到它们：
- java.base.jmod
- java.compiler.jmod
- java.datatransfer.jmod
- java.desktop.jmod
- ...

因为 jire 已经按照模块进行了拆分，所以我们发布一个 java  应用程序已经不需要下载一个完整的 jra。只需要“复制”一份JRE，但只带上用到的模块。为此，JDK提供了jlink命令:

```shell
jlink --module-path hello.jmod --add-modules java.base,java.xml,hello.world --output jre/

# 运行程序
jre/bin/java --module hello.world
```

### 6.4 访问权限
Java的class访问权限分为public、protected、private和默认的包访问权限。引入模块后，这些访问权限的规则就要稍微做些调整。确切地说，class的这些访问权限只在一个模块内有效，模块和模块之间，例如，a模块要访问b模块的某个class，必要条件是b模块明确地导出了可以访问的包。

```java
module java.xml {
    exports java.xml;
    exports javax.xml.catalog;
    exports javax.xml.datatype;
    ...
}
```