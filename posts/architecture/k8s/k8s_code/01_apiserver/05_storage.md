---
weight: 1
title: "数据访问层抽象"
date: 2023-03-05T22:00:00+08:00
lastmod: 2023-03-05T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---
## 1. API Server 的数据访问层
前面我们介绍了 API 对象的各种元数据如何注册到 Schema，API Server 提供了各种 API 对象的 RESTful 接口，API 对象数据最终需要保存至 etcd 中。为了完成整个步骤，k8s 抽象出了如下接口:
1. 后端存储的抽象
2. 操作 API 对象的抽象

![storage 抽象](/images/k8s/k8s_use/storage.png)

### 1.1 后端存储的抽象
后端存储的抽象:
1. Interface:
    - 位置: apiserver/pkg/storage/interfaces.go
    - 作用: 将所有需要对后端存储执行的操作抽象成了一个 Interface 接口，要想为 k8s 接入新的存储系统，需要实现这个接口
2. etcd3 struct store:
    - 位置: apiserver/pkg/storage/etcd3/store.go
    - 作用: Interface 的 etcd3 实现，etcd3 是 k8s 默认唯一支持的存储系统
3. struct DryRunnableStorage:
    - 位置: apiserver/pkg/registry/generic/registry/dryrun.go
    - 作用: 在 Interface 上包装了一层，如果传入 dryrun 参数，会跳过实际的存储过程

```go

// 3. DryRunnableStorage
type DryRunnableStorage struct {
	Storage storage.Interface
	Codec   runtime.Codec
}

func (s *DryRunnableStorage) Versioner() storage.Versioner {
	return s.Storage.Versioner()
}

func (s *DryRunnableStorage) Create(ctx context.Context, key string, obj, out runtime.Object, ttl uint64, dryRun bool) error {
	if dryRun {
		if err := s.Storage.Get(ctx, key, storage.GetOptions{}, out); err == nil {
			return storage.NewKeyExistsError(key, 0)
		}
		return s.copyInto(obj, out)
	}
	return s.Storage.Create(ctx, key, obj, out, ttl)
}
```

### 1.2 API 对象操作
k8s 将所有对 API 对象的操作都封装在 [Store](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/generic/registry/store.go#L96) 结构体中:
1. Store 对外实现了很多接口，包括 GET、WATCH... 这些接口是对 API 对象对外暴露的操作接口
2. Store 对内接受了多个 Strategy 接口对象，包括 RESTCreateStrategy、RESTUpdateStrategy.. 这些 Strategy 就是如何操作一个 API 对象的抽象
3. 所有API对象支持的操作接口，以及操作它们的接口都定义在 [apiserver/pkg/registry/rest/](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/rest/)

```go
type Store struct {
	Decorator func(runtime.Object)
	CreateStrategy rest.RESTCreateStrategy
	UpdateStrategy rest.RESTUpdateStrategy
	DeleteStrategy rest.RESTDeleteStrategy
	ResetFieldsStrategy rest.ResetFieldsStrategy
	Storage DryRunnableStorage
	StorageVersioner runtime.GroupVersioner
}
```

每一个 API 对象都会通过嵌入 Store 的方式自定义一个 Rest 结构体，并实现自己的 Strategy，以 daemonset 为例 Store、Rest、Strategy 的关系如下:

![daemonset 抽象](/images/k8s/k8s_use/daemonset_rest.png)

```go
type REST struct {
    // 1. 嵌入 Store 对象
	*genericregistry.Store
}

// NewREST 返回的就是可以操作 DaemonSets 的后端存储抽象
// NewREST returns a RESTStorage object that will work against DaemonSets.
func NewREST(optsGetter generic.RESTOptionsGetter) (*REST, *StatusREST, error) {
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &apps.DaemonSet{} },
		NewListFunc:               func() runtime.Object { return &apps.DaemonSetList{} },
		DefaultQualifiedResource:  apps.Resource("daemonsets"),
		SingularQualifiedResource: apps.Resource("daemonset"),
        // 2. daemonset 自己的 Strategy 实现
		CreateStrategy:      daemonset.Strategy,
		UpdateStrategy:      daemonset.Strategy,
		DeleteStrategy:      daemonset.Strategy,
		ResetFieldsStrategy: daemonset.Strategy,

		TableConvertor: printerstorage.TableConvertor{TableGenerator: printers.NewTableGenerator().With(printersinternal.AddHandlers)},
	}
```

### 1.3 kubernetes 数据访问层总结
kubernetes 整个数据访问层组成总结如下:

|模块|文件|作用|
|:---|:---|:---|
|apiserver/pkg/storage/|interfaces.go|后端存储的 Interface 接口|
||etcd3/store.go|etcd3 的 Interface 实现|
|apiserver/pkg/registry/generic/|registry/dryrun.go|Interface 装饰器，可以跳过实际的存储过程|
||registry/store.go|数据访问层的实现，Store + Strategy|
|apiserver/pkg/registry/rest/|rest.go|定义 API 对象对外暴露操作|
||update.go|定义操作 API 对象的接口，各种 Strategy 接口定义|
||create.go||
||delete.go||
|kubernetes/pkg/registry/apps/|daemonset/strategy.go|daemonset Strategy 实现|
|kubernetes/pkg/registry/apps/|daemonset/storage/storage.go|daemonset Rest 实现|
