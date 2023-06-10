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
| 包路径        | 使用层次化的包路径，例如 `java.util`          | 使用简单的包路径，例如 `fmt`                                    |
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

在示例中，`com.example.myapp`是包的名称。包名通常使用小写字母，并以域名倒序的方式命名，以确保唯一性。

### 2.2 包的导入
**导入单个类：**

导入单个类允许在代码中直接使用该类，而无需使用完全限定的类名。以下是导入单个类的示例：

```java
import com.example.myapp.MyClass;
```

在示例中，`com.example.myapp.MyClass`是要导入的类。可以在代码中直接使用`MyClass`，而无需使用完全限定的类名。

**导入整个包：**

导入整个包允许在代码中使用该包中的所有类，而无需逐个导入。以下是导入整个包的示例：

```java
import com.example.myapp.*;
```

在示例中，`com.example.myapp.*`表示要导入`com.example.myapp`包中的所有类。可以在代码中直接使用该包中的类，而无需使用完全限定的类名。

**静态导入：**

静态导入用于导入类的静态成员（字段和方法），以便在代码中直接使用这些静态成员，而无需使用类名限定。以下是静态导入的示例：

```java
import static com.example.myapp.MyClass.myStaticField;
import static com.example.myapp.MyClass.myStaticMethod;
```

在示例中，`com.example.myapp.MyClass.myStaticField`和`com.example.myapp.MyClass.myStaticMethod`是要导入的静态成员。可以在代码中直接使用这些静态成员，而无需使用类名限定。

需要注意的是，导入语句通常位于Java源文件的顶部，位于包的声明之后。可以根据需要导入多个类或包，每个导入语句占据一行。

通过包的声明和导入机制，可以更好地组织和管理Java代码，并提高代码的可读性和可维护性。

## 3. 包的搜索路径
问: Java 包的搜索路径

Java的包搜索路径是由类加载器（ClassLoader）来管理的。类加载器按照特定的顺序搜索类文件和依赖的包。以下是Java包的搜索路径的一般规则：

1. 启动类加载器（Bootstrap ClassLoader）：负责加载Java核心类库，它是Java虚拟机的一部分，搜索路径包括`jre/lib`目录和`-Xbootclasspath`选项指定的路径。
2. 扩展类加载器（Extension ClassLoader）：负责加载Java扩展类库，搜索路径包括`jre/lib/ext`目录和`java.ext.dirs`系统属性指定的路径。
3. 应用类加载器（Application ClassLoader）：也称为系统类加载器，负责加载应用程序的类，搜索路径包括`classpath`指定的路径、当前工作目录和`java.class.path`系统属性指定的路径。
4. 自定义类加载器：开发人员可以自定义类加载器，通过继承`ClassLoader`类并重写相应方法来实现自定义的类加载逻辑。

注意，类加载器按照委派模型（Delegation Model）进行工作，即先由父类加载器尝试加载类，只有在父类加载器找不到类的情况下，才由子类加载器尝试加载类。除了类加载器的搜索路径，Java包的搜索路径还可以通过设置`CLASSPATH`环境变量来指定。`CLASSPATH`可以包含一个或多个目录和JAR文件的路径，用于搜索Java类和资源文件。

需要注意的是，具体的包搜索路径和类加载机制可能因为Java版本、开发工具或框架的不同而有所差异。在实际开发中，应根据具体情况配置正确的类路径和包搜索路径。

### 4. 包的初始化顺序
问: java 包的初始化顺序

在Java中，包的初始化顺序是按照以下顺序进行的：

1. 父包的初始化：如果包内有嵌套的子包，那么子包的初始化会在父包之后进行。
2. 静态变量和静态块的初始化：在包内的类中，静态变量和静态块的初始化按照它们在类中出现的顺序进行。静态变量会在类加载的过程中被初始化，而静态块会在类加载时执行。
3. 类的初始化：包内的类会按照它们在源代码中的顺序进行初始化。在类初始化过程中，会先初始化父类（如果有继承关系），然后再初始化子类。

需要注意的是，包级别的初始化顺序是由类加载器负责管理的，而不是由包本身控制的。类加载器根据类的依赖关系和访问顺序来确定类的加载和初始化顺序。

另外，包级别的初始化只会在第一次使用包内的类或静态成员时进行。如果没有使用包内的类或静态成员，那么包级别的初始化过程就不会触发。

总之，在Java中，包的初始化顺序是按照父包优先、静态变量和静态块优先、类的初始化按照类的出现顺序进行的。这个初始化顺序可以帮助我们理解和控制包内的类和静态成员的初始化过程。


## 5. 依赖管理 Maven

### 5.1 Maven 简介
[Maven 入门](https://www.runoob.com/maven/maven-tutorial.html)

### 5.2 Maven 常用命令
以下是一些常用的Maven命令，以表格形式列出它们的功能：

| 命令                    | 功能                                 |
|------------------------|--------------------------------------|
| `mvn clean`            | 清理项目，删除生成的目录和文件。         |
| `mvn compile`          | 编译项目的源代码。                     |
| `mvn test`             | 运行项目的单元测试。                   |
| `mvn package`          | 打包项目，生成可部署的构建结果。         |
| `mvn install`          | 安装项目构建结果到本地Maven仓库。        |
| `mvn dependency:tree`  | 显示项目的依赖树，包括所有传递依赖。     |
| `mvn clean install`    | 清理项目并重新构建并安装。               |
| `mvn clean package`    | 清理项目并重新构建并打包。               |
| `mvn clean test`       | 清理项目并重新构建并运行单元测试。        |
| `mvn clean compile`    | 清理项目并重新编译。                     |
| `mvn clean deploy`     | 清理项目并部署构建结果到远程仓库。        |
| `mvn clean site`       | 清理项目并生成项目的站点文档。           |


### 5.3 依赖调节
在Java中，您可以使用构建工具（如Maven、Gradle）来调整项目的依赖关系，以满足您的需求。依赖调节（Dependency Management）是通过管理和配置项目的依赖项来解决依赖冲突、版本问题和构建需求的过程。

下面是一些常见的依赖调节技术：

1. 依赖版本管理：您可以在项目的构建文件（如pom.xml或build.gradle）中指定依赖项的版本号，以确保使用特定的依赖版本。这有助于避免不必要的依赖冲突和版本不一致。
2. 依赖范围管理：您可以使用依赖范围（如compile、provided、runtime、test等）来控制依赖项在不同环境下的引入。例如，某些依赖项只在编译时需要，而在运行时不需要。
3. 强制依赖解析：您可以使用构建工具的强制依赖解析功能，确保所有依赖项都被正确解析和引入。这有助于解决依赖冲突和版本不一致的问题。
4. 依赖排除：如前面所提到的，您可以排除某些依赖的特定传递依赖关系，以避免引入不需要的依赖项。
5. 依赖分析工具：使用依赖分析工具可以帮助您识别项目中的依赖关系、版本冲突和潜在的问题。这些工具可以生成依赖关系图、冲突报告等，帮助您进行依赖调节和管理。

#### maven 依赖版本管理
在Maven中，依赖版本管理是通过指定依赖项的版本号来管理项目的依赖关系。通过明确指定依赖的版本，可以确保在构建过程中使用特定的依赖版本，避免依赖冲突和版本不一致的问题。

以下是一些常见的 Maven 依赖版本管理的技术和实践：

1. 显式声明版本：在项目的 pom.xml 文件中，您可以明确指定每个依赖项的版本号，使用 `<version>` 元素进行声明。例如：
   ```xml
   <dependencies>
     <dependency>
       <groupId>com.example</groupId>
       <artifactId>my-library</artifactId>
       <version>1.0.0</version>
     </dependency>
   </dependencies>
   ```

2. 使用属性定义版本：您可以在 pom.xml 文件的 `<properties>` 部分定义属性，并在依赖项中使用这些属性作为版本号。这样可以集中管理依赖版本，方便统一升级或切换版本。例如：
   ```xml
   <properties>
     <my-library.version>1.0.0</my-library.version>
   </properties>

   <dependencies>
     <dependency>
       <groupId>com.example</groupId>
       <artifactId>my-library</artifactId>
       <version>${my-library.version}</version>
     </dependency>
   </dependencies>
   ```

3. 使用依赖管理部分：在 Maven 的父项目中，您可以使用 `<dependencyManagement>` 元素来集中管理子项目的依赖版本。子项目只需指定依赖的坐标（groupId、artifactId），而版本号从父项目继承。这样可以确保子项目使用相同的依赖版本。例如：
   ```xml
   <dependencyManagement>
     <dependencies>
       <dependency>
         <groupId>com.example</groupId>
         <artifactId>my-library</artifactId>
         <version>1.0.0</version>
       </dependency>
     </dependencies>
   </dependencyManagement>
   ```

通过以上的版本管理技术，您可以更加灵活地管理和控制项目的依赖版本，确保项目构建过程的稳定性和一致性。

希望以上信息对您有所帮助。如有任何进一步的问题，请随时提问。

#### Maven 依赖范围管理
Maven通过依赖范围（Dependency Scope）来管理项目的依赖关系。依赖范围指定了在不同阶段如何使用依赖项。以下是Maven中常见的依赖范围及其含义：

| 依赖范围      | 描述                                                         |
|---------------|--------------------------------------------------------------|
| compile       | 默认范围，适用于编译、测试和运行阶段。                           |
| provided      | 编译和测试阶段使用，运行阶段由容器或环境提供。                   |
| runtime       | 编译阶段不需要，测试和运行阶段需要。                             |
| test          | 只在测试阶段使用，不会被打包或发布。                            |
| system        | 类似于provided范围，但需要显式指定依赖的路径或坐标。              |
| import        | 仅用于管理POM之间的依赖关系，不会添加到实际构建路径中。           |

下面是对每个依赖范围的详细说明：

1. compile：默认范围，适用于编译、测试和运行阶段。依赖项将在编译、测试和运行时的类路径中可用。
2. provided：适用于编译和测试阶段，但在运行时由容器或环境提供。比如，Java EE容器通常提供了Servlet API和JSP API，因此可以将这些依赖项设置为provided范围。
3. runtime：在编译阶段不需要，但在测试和运行时需要。例如，数据库驱动程序通常在运行时才需要。
4. test：只在测试阶段使用，不会被打包或发布。这些依赖项用于编写和运行单元测试。
5. system：类似于provided范围，但需要显式指定依赖的路径或坐标。这种范围使您能够在本地文件系统上指定依赖项，但是它不推荐使用，因为它会使构建不可移植。
6. import：仅用于管理POM之间的依赖关系，不会添加到实际构建路径中。这种范围用于导入其他模块的依赖关系，它将继承其他模块的依赖范围。

在Maven的POM文件中，您可以通过在`<dependency>`元素中使用`<scope>`元素来指定依赖范围。例如：
```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-library</artifactId>
    <version>1.0.0</version>
    <scope>compile</scope>
</dependency>
```
在上述示例中，`<dependency>`元素定义了一个编译时范围的依赖项。


#### Maven 父 pom
在Maven中，父POM（Parent POM）是一个用于管理多个子项目的POM文件。父POM定义了一组共享的配置和依赖项，供子项目继承和使用。子项目可以通过继承父POM来共享父POM中定义的构建配置、插件配置、依赖管理等。

父POM的主要作用是：

1. 统一管理配置：通过父POM，可以将一组共享的配置信息集中管理，避免在每个子项目中重复配置相同的内容。
2. 管理依赖项：父POM可以定义一组共享的依赖项及其版本号，子项目可以继承并使用这些依赖项，避免每个子项目都单独定义依赖项。
3. 统一管理插件：父POM可以配置一组共享的插件，子项目可以继承并使用这些插件，确保插件版本和配置的一致性。
4. 定义构建配置：父POM可以定义一些通用的构建配置，如编译参数、资源过滤等，子项目可以继承这些配置。

父POM通常以一个独立的Maven项目存在，子项目通过在其POM文件中使用`<parent>`元素来引用父POM。例如：
```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>my-parent</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>
    ...
</project>
```
在子项目的POM文件中，使用`<parent>`元素指定父POM的坐标信息：
```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>my-parent</artifactId>
        <version>1.0.0</version>
    </parent>
    <groupId>com.example</groupId>
    <artifactId>my-child</artifactId>
    <version>1.0.0</version>
    ...
</project>
```
通过继承父POM，子项目可以继承父POM中定义的配置和依赖项，同时可以覆盖和定制这些配置。

需要注意的是，父POM不一定需要是本地项目中的文件，它可以是一个远程仓库中的POM文件。在Maven的构建过程中，首先会尝试在本地仓库中查找父POM，如果没有找到则从远程仓库下载。

希望以上信息对您有所帮助。如有任何进一步的问题，请随时提问。