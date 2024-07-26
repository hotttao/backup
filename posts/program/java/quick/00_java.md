---
weight: 1
title: "Java 简介"
date: 2023-05-01T22:00:00+08:00
lastmod: 2023-05-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Java 简介和 Java 中的基础术语"
featuredImage: 

tags: ["java 语法"]
categories: ["Java"]

lightgallery: true

toc:
  auto: false
---

## 1. Java 简介
在我们学习一门语言之前，有一些专业名词是需要我们了解的。对于 Java，有一下基本的专业术语:

| 术语 | 全称 | 解释 |
|-|-|-|  
| JDK | Java Development Kit | Java开发工具包,提供开发Java的工具 |
| JRE | Java Runtime Environment | Java运行时环境,包含JVM和类库 |
| JSR | Java Specification Requests | Java规范提案,描述新增功能的规范 |
| JCP | Java Community Process | 负责审核JSR的组织就是JCP |
| RI | Reference Implementation | 参考实现,JSR的试验性实现 |
| TCK | Technology Compatibility Kit | 兼容性测试套件,验证Java兼容性 |

```shell

  ┌─    ┌──────────────────────────────────┐
  │     │     Compiler, debugger, etc.     │
  │     └──────────────────────────────────┘
 JDK ┌─ ┌──────────────────────────────────┐
  │  │  │                                  │
  │ JRE │      JVM + Runtime Library       │
  │  │  │                                  │
  └─ └─ └──────────────────────────────────┘
        ┌───────┐┌───────┐┌───────┐┌───────┐
        │Windows││ Linux ││ macOS ││others │
        └───────┘└───────┘└───────┘└───────┘
```

- JDK是进行Java开发所需要的工具集合
- JRE提供了运行Java程序所需的JVM和基本类库
- JSR描述Java平台新增功能规范,由JCP制定  
- RI是对JSR规范的具体实现
- TCK用于验证Java实现对规范的兼容性

所以这些术语定义了Java平台各方面的标准、实现和验证处理。

## 2. Java 安装
```bash
# java 安装

# jdk 的目录结构
$ ll $JAVA_HOME/
总用量 44
drwxr-xr-x  9 root  root  4096  8月 22 20:48 .
drwxr-xr-x 18 root  root  4096  8月 23 21:49 ..
drwxr-xr-x  2 root  root  4096  8月 22 20:48 bin
drwxr-xr-x  5 root  root  4096  8月 22 20:48 conf
drwxr-xr-x  3 root  root  4096  8月 22 20:48 include
drwxr-xr-x  2 root  root  4096  8月 22 20:48 jmods
drwxr-xr-x 72 root  root  4096  8月 22 20:48 legal
drwxr-xr-x  5 root  root  4096  8月 22 20:48 lib
lrwxrwxrwx  1 10668 10668   23  6月 14 18:22 LICENSE -> legal/java.base/LICENSE
drwxr-xr-x  3 root  root  4096  8月 22 20:48 man
-rw-r--r--  1 10668 10668  290  6月 14 18:22 README
-rw-r--r--  1 10668 10668 1269  6月 14 18:22 release

```

| 目录 | 作用 |
|-|-|
| bin | 存放JDK的可执行文件 |
| lib | 存放JDK的库文件 |  
| jre | 存放JRE文件 |
| include | 存放C/C++的头文件 |
| src.zip | 源代码压缩包 |
| doc | 文档 | 

bin目录下常见程序:

| 程序 | 作用 |  
|-|-|
| javac | java编译器，把Java源码文件（以.java后缀结尾）编译为Java字节码文件（以.class后缀结尾）|
| java | java解释器，就是JVM，运行Java程序，就是启动JVM，然后让JVM执行指定的编译后的代码 |
| jar | 创建jar包的工具，用于把一组.class文件打包成一个.jar文件，便于发布； |
| javadoc | 生成doc文档，从Java源码中自动提取注释并生成文档； |
| javap | 反编译class文件 |
| jdb | 调试JAVA程序 |
| jps | 显示JVM进程状态 |
| jstat | 统计并输出进程信息 |
| jstack | 输出线程堆栈信息 |

### 2.1 运行一个 java 程序

```shell
# Java 11新增的一个功能，它可以直接运行一个单文件源码！
# 需要注意的是，在实际项目中，单个不依赖第三方库的Java源码是非常罕见的
$ javac Hello.java

# 运行 Hello 
$ ls
Hello.class	Hello.java
$ java Hello
Hello, world!
```

注意：给虚拟机传递的参数Hello是我们定义的类名，虚拟机自动查找对应的class文件并执行。jvm 如何搜索 class 文件有一套规则，后面会详述。

## 2. Java 中的命名规范
### 2.1 文件名
问: java 定义的文件名必须与 public 类一致么？

在Java中,源代码文件名与public类的命名并没有强制要求必须一致,尽管按照约定这样做通常是更好的实践。

Java的命名规则是:

- 一个Java源文件可以包含多个class,但**最多只能有一个public类**。
- 源文件名必须与public类名一致,用于标识这个唯一的public类。
- 对于非public类没有强制要求,可以随意命名,一般按照包名+类名命名。

例如源文件中:

```java
public class MyPublicClass {}

class MyNonPublicClass {}
```

正确的源文件名可以是:

- MyPublicClass.java
- MyPackage.MyNonPublicClass.java

文件名与public类名不一致也不会导致编译错误,但不符合Java约定俗成的命名规范,可能引起混乱,不建议这样做。

### 2.2 注释
Java有3种注释，第一种是单行注释，以双斜线开头，直到这一行的结尾结束：

```java
// 这是注释...
```
而多行注释以`/*`星号开头，以`*/`结束，可以有多行：

```java
/*
这是注释
blablabla...
这也是注释
*/
```
还有一种特殊的多行注释，以`/**开头`，以`*/`结束，如果有多行，每行通常以星号开头，这种特殊的多行注释需要写在类和方法的定义处，可以用于自动创建文档。

```java
/**
 * 可以用来自动创建文档的注释
 * 
 * @auther liaoxuefeng
 */
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
```
