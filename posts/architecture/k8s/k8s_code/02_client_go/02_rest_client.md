---
weight: 1
title: "client-go RESTClient/ListWatch"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go 与 APIServer 的交互"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---
## 1. RESTClient
client-go 需要一个 http client 与 APIServer 交互并完成认证鉴权过程。这个 http client 被实现为 RESTClient。RESTClient 包含了如下基础的抽象:

![RESTClient UML 类图](/images/k8s/k8s_code/rest-client.svg)

从 UML 类图可以看到:
1. client-go.rest.Interface: 定义的 GVK 增删改查的接口
2. client-go.rest.ClientContentConfig: 指定对某个组下的某个版本中的资源访问
3. client-go.rest.RESTClient: 生成 Request 对象，实现了上面的 Interface 接口
4. client-go.rest.Request: 包含了 RESTClient，以及发送给 apiserver 的各种参数
5. client-go.rest.Result: 封装了请求对象和 API server 交互的结果，并提供反序列化得到相应资源对象的功能

而 ListWatch 就是利用闭包和 RESTClient 查询特定 k8s 资源对象而抽象出来的接口和方法，ListWatch 与 RESTClient 之间的关系是:
1. ListWatch 的初始化函数 NewListWatchFromClient 接收的 Getter 就是 RESTClient，Getter 接口的 Get 方法返回的就是一个 Request，NewListWatchFromClient 的其他参数都是传递给 Request 的查询参数
2. ListWatch 包含的就是两个闭包函数，这两个闭包函数最终调用的就是 Request 上的 Get 和 Watch 方法。

```go
// NewListWatchFromClient creates a new ListWatch from the specified client, resource, namespace and field selector.
func NewListWatchFromClient(c Getter, resource string, namespace string, fieldSelector fields.Selector) *ListWatch {
	optionsModifier := func(options *metav1.ListOptions) {
		options.FieldSelector = fieldSelector.String()
	}
	return NewFilteredListWatchFromClient(c, resource, namespace, optionsModifier)
}

// NewFilteredListWatchFromClient creates a new ListWatch from the specified client, resource, namespace, and option modifier.
// Option modifier is a function takes a ListOptions and modifies the consumed ListOptions. Provide customized modifier function
// to apply modification to ListOptions with a field selector, a label selector, or any other desired options.
func NewFilteredListWatchFromClient(c Getter, resource string, namespace string, optionsModifier func(options *metav1.ListOptions)) *ListWatch {
	listFunc := func(options metav1.ListOptions) (runtime.Object, error) {
		optionsModifier(&options)
		return c.Get().
			Namespace(namespace).
			Resource(resource).
			VersionedParams(&options, metav1.ParameterCodec).
			Do(context.TODO()).
			Get()
	}
	watchFunc := func(options metav1.ListOptions) (watch.Interface, error) {
		options.Watch = true
		optionsModifier(&options)
		return c.Get().
			Namespace(namespace).
			Resource(resource).
			VersionedParams(&options, metav1.ParameterCodec).
			Watch(context.TODO())
	}
	return &ListWatch{ListFunc: listFunc, WatchFunc: watchFunc}
}
```

下面我们来一一介绍上面这些对象。

## 2. client-go.rest.Interface