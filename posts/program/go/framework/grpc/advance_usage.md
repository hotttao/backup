---
weight: 1
title: "grpc 用法进阶"
date: 2021-06-24T22:00:00+08:00
lastmod: 2021-06-24T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "grpc 用法进阶，包括元数据获取、拦截器、认证"
featuredImage: 

tags: ["go 框架"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

作为一个完整的框架 grpc，grpc 有一些进阶用法，核心包括如下几个:
1. 认证，包括证书认证，以及对每个方法进行的 token 认证
2. 拦截器，类似于中间件，支持非业务的统一控制逻辑，包括异常处理、调用链追踪
3. Protobuf的扩展选项特性，实现自定义插件
4. 反射服务

下面我们一一介绍

## 1. 证书认证

## 2. Token 认证

## 3. 拦截器

## 4. Protobuf的扩展选项特性

## 5. 反射服务