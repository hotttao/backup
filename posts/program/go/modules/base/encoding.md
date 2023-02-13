---
weight: 1
title: "go 数据格式转换"
date: 2021-06-03T22:00:00+08:00
lastmod: 2021-06-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 数据格式转换 json/yaml/ini"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. json

## 2. yaml

## 3. ini


## 4. binary
标准库提供的binary包直接读写抽象数据类型实例。binary 只支持采用定长表示的抽象数据类型。

## 5. gob
gob包也是Go标准库提供的一个序列化/反序列化方案，和JSON、XML等序列化/反序列化方案不同，它的API直接支持读写实现了io.Reader和io.Writer接口的实例。

gob包支持对任意抽象数据类型实例的直接读写，唯一的约束是自定义结构体类型中的字段至少有一个是导出的（字段名首字母大写）。