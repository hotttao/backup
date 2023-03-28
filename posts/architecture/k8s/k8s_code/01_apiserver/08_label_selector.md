---
weight: 1
title: "Lable Selector"
date: 2023-03-06T22:00:00+08:00
lastmod: 2023-03-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. Selector

List 方法: `func (e *Store) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error)` 接受 ListOptions 作为查询参数

## 1.1 ListOptions
ListOptions 的定义如下:

```go
// apimachinery/pkg/apis/meta/internalversion/types.go
type ListOptions struct {
	// 基于标签的选择器
	LabelSelector labels.Selector
	// 基于字段的选择器
	FieldSelector fields.Selector
	// 如果为true，则监视对此列表的更改
	Watch bool
	// allowWatchBookmarks请求使用类型为“BOOKMARK”的观察事件。
	// 不实现 bookmark 的服务器可能会忽略此标志，并且 bookmark 会在服务器自行决定时发送。
	// 客户端不应假定 bookmark 在任何特定间隔返回，也不能假定服务器将在会话期间发送任何BOOKMARK事件。
	// 如果这不是一个watch，则忽略此字段。
	// 如果在apiserver中未启用WatchBookmarks功能门，此字段将被忽略。
	AllowWatchBookmarks bool
	// resourceVersion设置对请求可以从中提供服务的资源版本施加约束。
	// 有关详细信息，请参见https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions。
	ResourceVersion string
	// resourceVersionMatch指定如何应用resourceVersion参数。只有当resourceVersion也被设置时，才能设置resourceVersionMatch。
    // "NotOlderThan"匹配的数据至少和所提供的resourceVersion一样新。“Exact”匹配所提供的精确resourceVersion中的数据
	ResourceVersionMatch metav1.ResourceVersionMatch

	// list/watch调用的超时时间。
	TimeoutSeconds *int64
	// Limit指定从服务器返回的结果的最大数量。服务器可能不支持所有资源类型上的此字段，但如果它支持并且有更多结果，则会在返回的列表对象上设置continue字段。
	Limit int64
	// Continue是服务器返回的令牌，它允许客户端通过指定限制从服务器检索结果的块。服务器可能会拒绝不识别的连续令牌的请求，并且如果令牌因为已过期而无法再使用，则会返回410错误。
	Continue string
}
```
labels.Selector 定义了标签和字段选择器

## 1.2 labels.Selector
labels.Selector 实现在 apimachinery/pkg/labels:

![label select](/images/k8s/k8s_use/label.png)
