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

## 1.1 java 
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
