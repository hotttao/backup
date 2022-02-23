---
weight: 1
title: "配置管理神 Viper"
date: 2021-06-21T22:00:00+08:00
lastmod: 2021-06-21T22:00:00+08:00
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


## 1. Viper 简介
Viper 是适用于Go应用程序的完整配置解决方案。可以处理所有类型的配置需求和格式。作为配置管理器，Viper 按照如下的从高到低的优先级加载配置:
1. 代码显示调用Set设置值
2. 命令行参数（flag）
3. 环境变量
4. 配置文件
5. key/value存储
6. 默认值

Viper支持JSON、TOML、YAML、HCL、envfile和Java properties格式的配置文件。Viper可以搜索多个路径，但是 Viper 不默认任何配置搜索路径，将默认决策留给应用程序。下面是一个如何使用Viper搜索和读取配置文件的示例。

```python
# 1. 设置默认值
viper.SetDefault("LayoutDir", "layouts")
viper.SetDefault("Taxonomies", map[string]string{"tag": "tags", "category": "categories"})


```
