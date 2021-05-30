---
title: 4. API 接口服务
date: 2021-03-05
categories:
    - 运维
tags:
	- Openstack
---

搞 Openstack 开发的大多数应该都或多或少都熟悉 Python 的 Web 开发。所以今天我们就花一节时间来讲讲 Nova 里面 API 接口服务。
<!-- more -->

## 1. WSGI
熟悉 Web 开发的同学，应该都知道后端 Web 应用分成两个部分:
1. Web 服务器: Nginx 和 Apache，负责 HTTP 协议的解析
2. Web 开发框架: 以 Python 为例就是 flask、Django，提供动态的网页内容

Web 服务如何把解析的 HTTP 请求数据给 Web 框架，以及如何从 Web 框架接受响应内容呢？这就是 WSGI 协议规范所约定的事情。Web服务器网关接口（Python Web Server Gateway Interface，缩写为WSGI）是为Python语言定义的Web服务器和Web应用程序或框架之间的一种简单而通用的接口。

### 1.1. WSGI 接口
WSGI 约定的是一个如下的接口:

```python
class App:
    def __call__(self, environ: dict, start_response: t.Callable) -> t.Any:
        return body


def start_response(status: str, headers: List[Tuple[str, str]], exc_info: Optional[_OptExcInfo]) : 
    pass
```

Web 框架是一个可调用对象，其接受两个参数:
1. environ: 字典对象，包含了 http 请求被解析后的所有数据
2. start_response: 也是一个可调用对象，用于为 http 响应添加状态码和请求头信息

Web 框架被调用后，返回值作为 body，连同 start_response 写入的响应状态码和响应头信息返回给 Web 服务器用作 HTTP 请求的响应。

Flask 和 Openstack 里面的 Web 服务本质上也是类似的，只不过一个完整的 Web 服务需要能同时处理多个不同的请求，并解决权限控制、流控等多种管理需求。因此它们都需要解决并发和路由的问题。在这些 Web 框架中都有类似的抽象:
1. 路由
2. 中间件
3. 请求处理函数
4. ....

## 2. paste.deploy
paste.deploy 用来配置和管理WSGI 应用，Nova 正是使用这个库来对 API 服务尽心配置和管理，因此我们有必要先对它有一定了解。


## 3. Nova API 的管理
Nova 的代码中有多个 wsgi.py(注这里的nova/ 指的是 nova/nova/):
1. nova/wsgi.py
2. nova/api/wsgi.py
3. nova/api/openstack/wsgi.py

为了厘清他们之间的关系，我画出它们的 UML 类图，如下图 4.1 所示:

