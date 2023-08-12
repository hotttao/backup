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


### 1.3 class 文件版本
我们通常说的Java 8，Java 11，Java 17，是指JDK的版本，也就是JVM的版本，更确切地说，就是 java 这个程序的版本。每个版本的JVM，它能执行的class文件版本也不同。例如，Java 11对应的class文件版本是55，而Java 17对应的class文件版本是61。类似于交叉编译，我们也可以让高版本的 java 生成低版本 class 文件:

```java
// 方法一: --release 11表示源码兼容Java 11，编译的class输出版本为Java 11兼容，即class版本55。
javac --release 11 Main.java

// 方法二: --source指定源码版本，用参数--target指定输出class版本
// 如果使用Java 17的JDK编译，它会把源码视为Java 9兼容版本，并输出class为Java 11兼容版本
javac --source 9 --target 11 Main.java
```

## 2. Java 虚拟机的参数
下表列出了 Java 虚拟机（JVM）常用的一些 `-XX` 参数及其功能：

| 参数                      | 功能                                               |
|---------------------------|----------------------------------------------------|
| `-XX:+UseSerialGC`        | 启用串行垃圾回收器                                 |
| `-XX:+UseParallelGC`      | 启用并行垃圾回收器                                 |
| `-XX:+UseConcMarkSweepGC` | 启用并发标记-清除垃圾回收器                         |
| `-XX:+UseG1GC`            | 启用 G1 垃圾回收器                                 |
| `-XX:MaxGCPauseMillis`    | 设置垃圾回收的最大停顿时间（毫秒）                   |
| `-XX:ParallelGCThreads`   | 设置并行垃圾回收线程数                               |
| `-XX:ConcGCThreads`       | 设置并发垃圾回收线程数                               |
| `-XX:MaxHeapSize`         | 设置最大堆内存大小                                  |
| `-XX:InitialHeapSize`     | 设置初始堆内存大小                                  |
| `-XX:MetaspaceSize`       | 设置元空间大小                                     |
| `-XX:MaxMetaspaceSize`    | 设置最大元空间大小                                 |
| `-XX:SurvivorRatio`       | 设置 Eden 区与 Survivor 区的大小比例                |
| `-XX:NewRatio`            | 设置年轻代与老年代的大小比例                        |
| `-XX:MaxTenuringThreshold`| 设置对象进入老年代的年龄阈值                         |
| `-XX:CompileThreshold`    | 设置方法即时编译的触发阈值                           |
| `-XX:+HeapDumpOnOutOfMemoryError` | 内存溢出时生成堆转储文件                   |
| `-XX:HeapDumpPath`        | 设置堆转储文件的路径                               |
| `-XX:+PrintGCDetails`     | 打印详细的垃圾回收日志                             |
| `-XX:+PrintGCDateStamps`  | 打印垃圾回收日志的时间戳                           |
| `-XX:+PrintCommandLineFlags` | 打印命令行参数信息                               |
| `-XX:+UnlockExperimentalVMOptions` | 解锁实验性的虚拟机选项                    |
| `-XX:+UseCompressedOops`  | 启用压缩指针（适用于64位 JVM）                      |
| `-XX:+UseStringDeduplication` | 启用字符串去重（JDK 8u20及更高版本）             |
| `-XX:+ShowCodeDetailsInExceptionMessages` | 在异常信息中显示源代码详细信息                      |
| `-XX:-OmitStackTraceInFastThrow`         | 在快速异常抛出时不省略堆栈跟踪信息                   |

`-XX:+ShowCodeDetailsInExceptionMessages` 参数用于在异常信息中显示源代码的详细信息，包括源文件名、行号和方法名。这对于定位和调试异常非常有用，可以提供更多关于异常发生位置的上下文信息。

`-XX:-OmitStackTraceInFastThrow` 参数用于禁止在快速异常抛出时省略堆栈跟踪信息。默认情况下，在某些情况下，当 JVM 认为异常的堆栈跟踪信息对性能没有影响时，会省略部分堆栈跟踪信息以提高性能。通过禁用此参数，可以确保在快速异常抛出时也会包含完整的堆栈跟踪信息。
