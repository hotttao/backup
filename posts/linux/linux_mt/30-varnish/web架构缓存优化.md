---
weight: 1
title: 27.1 web架构缓存优化
date: '2018-10-16T22:10:00+08:00'
lastmod: '2018-10-16T22:10:00+08:00'
draft: false
author: 宋涛
authorLink: https://hotttao.github.io/
description: 27.1 web架构缓存优化
featuredImage: null
tags:
- 马哥 Linux
categories:
- Linux
lightgallery: true
toc:
  auto: false
---

web架构缓存优化

![HA](/images/linux_mt/linux_cache.jpg)
<!-- more -->

上一章我们学习了如何使用 keepalived 实现一个高可用集群，接下来我们来继续完善我们的 web 站点架构，本章我们来讲解另一个重要内容，web 站点的缓存系统。

计算机组件衔接中非常常见而且重要策略就是:
1. 两个环节连接起来不是很流畅，加中间层
2. 两个环节连接起来在性能上不匹配，加缓存

缓存之所以有效是因为我们的程序运行具有局部性特征：
1. 时间局部性：一个数据被访问过之后，可能很快会被再次访问到；
2. 空间局部性：一个数据被访问时，其周边的数据也有可能被访问到

局部性导致我们的站点存在"热区"，即一小部分内容在一段时间内会被多个用户多次访问，因此我们可以将这些热区数据缓存下来，从而能减少中间的处理过程和传输过程，提高响应用户的速度。

本章我们就来讲解 web 缓存中一种常见实现 varnish，内容包括:
1. web 站点架构演变
2. varnish 架构与安装配置
3. varnish 缓存策略配置
4. varnish 优化与进阶


## 1. Cache
"Cache is Key"，缓存是 web 架构中一个非常重要的组件，因此在学习 varnish 之前，我们必需先了解一下缓存，以及缓存如何影响着我们 web 架构的演变。本节内容包括:
1. 缓存的基本知识
2. web 架构缓存优化
3. http 协议的缓存机制

### 1.1 缓存基础
缓存之所以有效是因为我们的程序运行具有局部性特征：
1. 时间局部性：一个数据被访问过之后，可能很快会被再次访问到；
2. 空间局部性：一个数据被访问时，其周边的数据也有可能被访问到

局部性导致我们的站点存在"热区"，即一小部分内容在一段时间内会被多个用户多次访问，因此我们可以将这些热区数据缓存下来，从而能减少中间的处理过程和传输过程，提高响应用户的速度。

因此对于缓存有一些基础的必需理解的概念
1. 首先我们缓存的是热区数据而不是所有数据，所以缓存存在空间限制，当缓存空间耗尽时，会基于 LRU(最近最少使用) 算法来更新缓存
2. 缓存存在时效性，需要定期对过期缓存进行清理，因此通常只会对那些读多写少的内容进行缓存
3. 缓存的有效性使用**缓存命中率** hit/(hit+miss) 进行衡量，有两个衡量的指标
  - 页面命中率：基于页面数量进行衡量
  - 字节命中率：基于页面的体积进行衡量

### 1.2 缓存的分级结构
缓存存在多级结构，不同缓存级别下，有些缓存是公共的，有些缓存是私有的，公共缓存只能缓存多个用户之间可以共享的公共数据，因此我们需要在服务器指明数据是否可以被公共缓存缓存。通常
1. 私有数据：只能被私有缓存缓存(private，private cache)
2. 公共数据：可同时被公共和私有缓存进行缓存(public, public or private cache)

对于公共缓存，我们在设置缓存键时，应该尽量排除用户的私有信息，以提高缓存的命中率。因此非常有必要组织好缓存键，减少用户私有数据的参与。

### 1.3 缓存模式
缓存的实现分为两种模式
1. 代理缓存: 缓存服务器如果未能命中，缓存服务器自己需要去找后端服务器请求资源并反回给客户端，所以又称为递归缓存
2. 旁挂缓存: 缓存服务器未命中，需要客户端自己发送请求获取结果

memcached 就是典型的旁挂缓存，所有的 http 协议的缓存都是代理。web 缓存的两个重要开源实现是 squid, varnish，它们类似于 web 服务器的 httpd 和 nginx。

## 2. web 架构缓存优化
多看几次视频(34-1:17)

![web_frame.jpg](/images/linux_mt/web_frame.jpg)


## 3. HTTP 缓存控制
HTTP 协议在 1.1 增强了缓存控制机制，在 HTTP 协议的缓存控制中，服务器会会在响应报文中为资源"打标"，客户端则会根据"标记"来决定是否使用本地缓存以及如何请求。

### 3.1 响应报文的缓存控制
响应报文中有两种缓存控制机制
1. 过期时间机制
  - `Expires`:
    - 作用: HTTP/1.0 使用，表示缓存的过期的绝对时间，在缓存未到期之前客户端会直接使用本地缓存不会发起请求
    - 缺陷: 可能由于时区或系统时间问题而提前失效
  - `Cache-Control: maxage=`:
    - 作用: HTTP/1.1 可用表示缓存有效时长
    - 说明: `Cache-Control` 是缓存控制的专用首部，`maxage` 只是其使用方式之一
2. 条件式请求机制
  - `Last-Modified`:
    - 作用: 文件的最近一次修改时间戳，请求报文使用 `If-Modified-Since` 首部配合使用
    - 局限: `Last-Modified` 记录的最小单位是秒，如果响应的内容在 1s 内更新了好几次，此首部是无法反映的
  - `Etag`:
    - 作用: 基于文件的校验码来判别，请求报文使用 `If-None-Match` 首部配合使用


```
# 响应报文中的缓存控制首部信息示例
Expires:Thu, 13 Aug 2026 02:05:12 GMT        # 有效的绝对时间
Cache-Control:max-age=315360000              # 有效时长
ETag:"1ec5-502264e2ae4c0"                    # 内容校验码
Last-Modified:Wed, 03 Sep 2014 10:00:27 GMT  # 文件最近一次修改时间
```

### 3.2 条件式请求首部
对于时间控制机制，客户端会自动根据 `Expires` 和 `Cache-Control` 来判断缓存是否过期，只有缓存过期时客户端才会发起新的请求。

对于条件式请求机制，用户会根据 `Last-Modified` 或 `Etag` 发起条件式请求
1. `Last-Modified` 对应的条件式请求首部包括:
  - `If-Modified-Since`：从指定时间开始，内容是否发生变更
  - `If-Unmodified-Since`
2. `Etag` 对应的条件式请求首部:
  - `If-Match`: 当前缓存资源的 `Etag` 是否与服务器资源的 `Etag` 相同
  - `If-None-Match`:

以 Etag 为例，条件式请求的整个过程如下:
1. 第一次客户端请求时，服务器会在响应报文的附加 `Etag` 首部，其值是响应内容的哈希值
2. 客户端需要再次获取同一资源时，将发起条件式请求，请求中 `If-Match` 首部字段的值就是第一响应的 `Etag` 首部字段的值
1. 服务器会将请求报文中的 `Etag` 值与当前资源进行比较
3. 如果原始内容未改变，则仅响应首部（不附带body部分），响应码304 （Not Modified）
2. 如果原始内容发生改变，则正常响应，响应码200；
4. 如果原始内容消失，则响应404，此时缓存中的cache object也应该被删除；


### 3.3 缓存过程
通常情况下，http 的缓存的过期时间和条件式请求会结合使用，客户端接收到响应之后，在过期时间到期之前都会是使用本地缓存，缓存到期之后才会发送条件式请求。这样过期时间机制减少了发送请求的次数，条件式请求减少了传输内容。可以最大程度上提升传输速率。

## 4. http Cache-Control 首部值
http 头中的 Cache-Control 首部有特殊作用
1. 请求报文中用于通知缓存服务如何使用缓存响应请求
    - `no-cache`:（不要缓存的实体，要求现在从WEB服务器去取）
    - `max-age`：（只接受 Age 值小于 max-age 值，并且没有过期的对象）
    - `max-stale`：（可以接受过去的对象，但是过期时间必须小于 max-stale 值）
    - `min-fresh`：（接受其新鲜生命期大于其当前 Age 跟 min-fresh 值之和的缓存对象）
2. 响应报文中用于通知缓存服务器如何存储上级服务器响应的内容
    - `public`: (可以用 Cached 内容回应任何用户)
    - `private`:（只能用缓存内容回应先前请求该内容的那个用户）
    - `no-cache`: 可缓存，但响应给客户端之前需要revalidation，即必须发出条件式请求进行缓存有效性验正
    - `max-age`：（本响应包含的对象的过期时间）
    - `no-store`: 不允许存储响应内容于缓存中

```

# http 协议缓存控制指令
Cache-Control  = "Cache-Control" ":" 1#cache-directive
    cache-directive = cache-request-directive
        | cache-response-directive
    cache-request-directive =
          "no-cache"                          
        | "no-store" (backup)                          
        | "max-age" "=" delta-seconds        
        | "max-stale" [ "=" delta-seconds ]  
        | "min-fresh" "=" delta-seconds      
        | "no-transform"                      
        | "only-if-cached"                  
        | cache-extension                  
    cache-response-directive =
          "public"                              
        | "private" [ "=" <"> 1#field-name <"> ]
        | "no-cache" [ "=" <"> 1#field-name <"> ]
        | "no-store"                            
        | "no-transform"                        
        | "must-revalidate"                    
        | "proxy-revalidate"                    
        | "max-age" "=" delta-seconds            
        | "s-maxage" "=" delta-seconds          
        | cache-extension
```
