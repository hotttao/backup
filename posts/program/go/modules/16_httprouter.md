---
weight: 1
title: "httprouter"
date: 2021-06-06T22:00:00+08:00
lastmod: 2021-06-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "net/http Router 标准实现 httprouter"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. httprouter 简介
在 [go 网络库 net/http 的请求处理过程]({{< ref "posts/program/go/modules/16_net.md" >}}) 中我们了解了标准库 net/http 的请求处理流程。net/http 中提供了一个默认的路由实现 ServeMux，通过一个 map 能实现 url 到 handler 的映射，功能较为简单。第三方库 httprouter 已经成为事实上 router 的实现标准。大多数 web 框架的路由实现都是基于 httprouter，所以今天我们就来看看 httprouter 的实现。

httprouter 将 url 实现为了一个 Radix Tree。下面是从维基百科摘录的 Radix Tree 的示意图:

![By Claudio Rocchini - Own work, CC BY 2.5, https://commons.wikimedia.org/w/index.php?curid=2118795](/images/go/module/Patricia_trie.svg)

可以看到 Radix Tree 中每个节点包含的是一个长字符串，相比于每个树节点只包含一个字符的字典树树可以有效的压缩树的高度提高匹配效率。

### 1.1 httprouter 的结构

![gen by www.dumels.com](/images/go/module/httprouter_struct.png)

从 httprouter 生成的 UML 类图可以看到 httprouter 实现并不复杂，Router 实现了 net/http 标注库的 Handler 接口，而 node 就是 Radix Tree 节点的类型。

因为同一个 url 在一个 http 规范中会有多个方法，在 httprouter 中每一个方法都会对应一个单独的树。

```go
type Router struct {
    // 一个 http 方法对应一个 Radix Tree
    trees map[string]*node

	paramsPool sync.Pool
	maxParams  uint16
    ......
}
```

## 2. node 实现
```go
// nType 类型
const (
	static nodeType = iota // default
	root  // 根节点
	param // 参数节点，例如 :id
	catchAll // 通配符节点，例如 *anyid
)


type Handle func(http.ResponseWriter, *http.Request, Params)

// Param is a single URL parameter, consisting of a key and a value.
type Param struct {
	Key   string
	Value string
}

type node struct {
	path      string  // 节点包含的字符串
	indices   string
	wildChild bool
	nType     nodeType 
	priority  uint32
	children  []*node
	handle    Handle
}
```
在 node 的结构体中:
1. path: 表示节点包含的字符串
2. nType: 节点的类型
3. indices: 子节点索引，
   - 当子节点为非参数类型，即本节点的 wildChild 为 false 时，会将每个子节点的首字母放在该索引数组中
   - 如果子节点为参数节点，indices=""
4. wildCard: 如果一个节点的子节点有 param 节点，wildCard=True
5. handle: 当前节点对应的请求处理函数


