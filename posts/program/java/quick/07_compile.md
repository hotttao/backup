---
weight: 1
title: "Java 编译执行"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 编译执行"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---


## 1. Java 程序的执行流程
1. java 命令用于执行已经编译完成的 Java 程序
2. javac 命令用于编译 Java 源代码文件为可执行的字节码文件

## 1.1 javac 
问: 以表格形式列出 javac 常用参数

以下是 `javac` 命令的常用参数列表：

| 参数                 | 描述                                                         |
|----------------------|--------------------------------------------------------------|
| `-d <目录>`          | 指定编译输出目录                                             |
| `-classpath <路径>`   | 指定类路径                                                   |
| `-sourcepath <路径>`  | 指定源文件路径                                               |
| `-encoding <编码>`    | 指定源文件编码                                               |
| `-g`                 | 生成调试信息                                                 |
| `-nowarn`            | 禁用警告                                                     |
| `-verbose`           | 显示编译过程详细信息                                         |
| `-source <版本>`     | 指定源代码兼容的Java版本                                     |
| `-target <版本>`     | 指定生成的类文件兼容的Java版本                               |
| `-help`              | 显示帮助信息                                                 |


## 1.2 java 
问: 以表格形式列出 java 命令 常用参数
以下是 `java` 命令的常用参数列表：

| 参数                 | 描述                                                         |
|----------------------|--------------------------------------------------------------|
| `<类名>`             | 指定要运行的主类                                             |
| `-classpath <路径>` <br> `-cp <路径>`  | 指定类路径                                 |
| `-D<属性>=<值>`      | 设置系统属性                                                 |
| `-Xmx<size>`         | 设置堆内存的最大值                                           |
| `-Xms<size>`         | 设置堆内存的初始大小                                         |
| `-Xss<size>`         | 设置线程堆栈大小                                             |
| `-verbose`           | 显示详细的类加载、垃圾回收等信息                             |
| `-version`           | 显示 Java 版本信息                                           |
| `-help`              | 显示帮助信息                                                 |

### 1.3 classpath
Java是编译型语言，源码文件是.java，而编译后的.class文件才是真正可以被JVM执行的字节码。因此，JVM需要知道，如果要加载一个abc.xyz.Hello的类，应该去哪搜索对应的Hello.class文件。classpath是JVM用到的一个环境变量，它用来指示JVM如何搜索class，他是一组目录的集合。

classpath的设定方法有两种：
1. 在系统环境变量中设置classpath环境变量，不推荐；
2. 在启动JVM时设置classpath变量，推荐。即java命令传入-classpath或-cp参数。
3. 没有设置系统环境变量，也没有传入-cp参数，那么JVM默认的classpath为.，即当前目录

假设有以下目录结构：
```
- myapp
  - src
    - com
      - example
        - MyApp.java
  - lib
    - commons-lang3.jar
```

`MyApp.java` 文件的内容如下：
```java
package com.example;

import org.apache.commons.lang3.StringUtils;

public class MyApp {
    public static void main(String[] args) {
        String message = "Hello, World!";
        String reversedMessage = StringUtils.reverse(message);
        System.out.println(reversedMessage);
    }
}
```

我们将当前目录 `myapp` 添加到Classpath中，可以使用以下命令编译和运行程序：
```
javac -cp .:lib/commons-lang3.jar src/com/example/MyApp.java
java -cp .:lib/commons-lang3.jar com.example.MyApp
```

在上面的命令中：
- `-cp .:lib/commons-lang3.jar` 指定了Classpath，`.` 表示当前目录，`lib/commons-lang3.jar` 表示第三方库 `commons-lang3.jar` 的路径。
- `javac` 命令使用Classpath来查找依赖的类，以编译 `MyApp.java`。
- `java` 命令使用Classpath来查找依赖的类，以运行 `MyApp` 类。

通过这样的设置，Java 将按照以下顺序搜索类文件：
1. 用户指定的Classpath：`.` 表示当前目录和 `lib/commons-lang3.jar`。
3. Java 核心库：JRE 的核心类库。
3. JVM根据classpath设置的目录下查找 com.example.MyApp，即**实际搜索文件必须位于 classpath 目录下的 com/example/MyApp.class**

### 1.4 jar 包
jar包可以把 package 组织的目录层级，以及各个目录下的所有文件（包括.class文件和其他文件）都打成一个jar文件，jar包实际上就是一个 zip 格式的压缩文件，而**jar包相当于目录**。如果我们要执行一个jar包的class，就可以把jar包放到classpath中。

jar包还可以包含一个特殊的/META-INF/MANIFEST.MF文件，MANIFEST.MF是纯文本，可以指定Main-Class和其它信息。JVM会自动读取这个MANIFEST.MF文件，如果存在Main-Class，我们就不必在命令行指定启动的类名，而是用更方便的命令：`java -jar hello.jar`。

构建工具，例如Maven，可以非常方便地创建jar包和 MANIFEST.MF文件。

### 1.5 class 文件版本
我们通常说的Java 8，Java 11，Java 17，是指JDK的版本，也就是JVM的版本，更确切地说，就是 java 这个程序的版本。每个版本的JVM，它能执行的class文件版本也不同。例如，Java 11对应的class文件版本是55，而Java 17对应的class文件版本是61。类似于交叉编译，我们也可以让高版本的 java 生成低版本 class 文件:

```java
// 方法一: --release 11表示源码兼容Java 11，编译的class输出版本为Java 11兼容，即class版本55。
javac --release 11 Main.java

// 方法二: --source指定源码版本，用参数--target指定输出class版本
// 如果使用Java 17的JDK编译，它会把源码视为Java 9兼容版本，并输出class为Java 11兼容版本
javac --source 9 --target 11 Main.java
```
