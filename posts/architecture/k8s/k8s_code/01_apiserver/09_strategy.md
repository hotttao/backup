---
weight: 1
title: "Daemonset Rest"
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

前面我们已经介绍了 API Server 数据访问层的抽象: Store、Rest、Strategy 之间的关系，比已经介绍了 Store 的实现。接下来我们就以 Daemonset 看看 Rest 和 Strategy。

## 1. Strategy
在详细介绍 Daemonset 实现之前，我们先来看看各种 Strategy 都定义了哪些操作:

```go
// apiserver/pkg/registry/generic/registry/store.go
type GenericStore interface {
	GetCreateStrategy() rest.RESTCreateStrategy
	GetUpdateStrategy() rest.RESTUpdateStrategy
	GetDeleteStrategy() rest.RESTDeleteStrategy
}
```

### 1.1 RESTCreateStrategy

```go
type ObjectTyper interface {
	// ObjectKinds returns the all possible group,version,kind of the provided object, true if
	// the object is unversioned, or an error if the object is not recognized
	// (IsNotRegisteredError will return true).
	ObjectKinds(Object) ([]schema.GroupVersionKind, bool, error)
	// Recognizes returns true if the scheme is able to handle the provided version and kind,
	// or more precisely that the provided version is a possible conversion or decoding
	// target.
	Recognizes(gvk schema.GroupVersionKind) bool
}


// RESTCreateStrategy定义了创建符合Kubernetes API约定的对象的最小验证、接受的输入和名称生成行为。
type RESTCreateStrategy interface {
    // ObjectTyper接口可以用于获取对象的GK(Group Kind)信息，可以用于反序列化
    runtime.ObjectTyper 
    // 当设置了标准的GenerateName字段时，名称生成器用于生成名称。名称生成器将在验证之前调用。
    names.NameGenerator
    // NamespaceScoped返回true，如果对象必须在命名空间内。
    NamespaceScoped() bool

    // 在创建之前PrepareForCreate被调用，以规范化对象。例如：删除不应持久化的字段、排序无序的列表字段等。
    // 这不应删除存在会被视为验证错误的字段。
    // 通常实现为类型检查和初始化或清除状态。
    // 清除状态是因为状态变化是内部的，一个API的外部调用者(用户)不应该在新创建的对象上设置初始状态。
    PrepareForCreate(ctx context.Context, obj runtime.Object)

    // 验证返回带有验证错误或nil的ErrorList。
    // Validate在对象中填充默认字段之后，在对象被持久化之前被调用。该方法不应改变对象。
    Validate(ctx context.Context, obj runtime.Object) field.ErrorList

    // WarningsOnCreate在填充对象中的默认字段并通过验证之后，Canonicalize调用之前，将警告返回给执行创建的客户端。
    // 此方法不得改变对象。
    //
    // 警告应简洁; 如果可能，请将警告限制在120个字符以内。
    // 不要在消息中包含“Warning:”前缀(客户端输出时会添加该前缀)。
    // 关于特定字段返回的警告应该格式化为"path.to.field: message"。例如: `spec.imagePullSecrets[0].name: invalid empty name ""`
    // 使用警告消息来描述客户端发出API请求时应纠正或意识到的问题。
    // 例如：
    // - 使用将在未来版本中停止工作的已弃用字段/标签/注释
    // - 使用已过时的字段/标签/注释是无效的
    // - 形式错误或无效的规范，阻止成功处理提交的对象，但由于兼容性原因而不被验证拒绝
    //
    // 不应为调用者无法解决的字段返回警告。
    // 例如，在子资源创建请求中不要警告spec字段。
    WarningsOnCreate(ctx context.Context, obj runtime.Object) []string

    // Canonicalize允许将对象变异为规范形式。这确保了操作这些对象的代码可以依赖于常见的形式，如比较。
    // 验证成功但对象未持久化之前调用Canonicalize。该方法可以改变对象。通常实现为类型检查或空方法。
    Canonicalize(obj runtime.Object)

}
```

### 1.2 RESTUpdateStrategy

```go
// RESTUpdateStrategy 定义了更新符合 Kubernetes API 约定的对象所需的最小验证、接受的输入和名称生成行为。
// 一个资源可能有多个 UpdateStrategies，具体取决于使用的调用模式。
type RESTUpdateStrategy interface {
    runtime.ObjectTyper
    // NamespaceScoped 如果对象必须在命名空间中，则返回 true。
    NamespaceScoped() bool
    // AllowCreateOnUpdate 如果可以通过 PUT 创建对象，则返回 true。
    AllowCreateOnUpdate() bool
    // PrepareForUpdate 在验证之前在更新时调用以规范化对象。例如：删除不需要持久化的字段、对不受排序影响的列表字段进行排序等。
    // 这不应删除其存在将被视为验证错误的字段。
    PrepareForUpdate(ctx context.Context, obj, old runtime.Object)
    // ValidateUpdate 在默认字段填充到对象中并持久化对象之前调用。此方法不应更改对象。
    ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList
    // WarningsOnUpdate 返回更新的客户端的警告。
    // 在填充对象的默认字段并通过 ValidateUpdate 后调用，在 Canonicalize 被调用之前，并且在对象持久化之前被调用。此方法不得更改任何对象。
    WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string
    // Canonicalize 允许将对象变为规范形式。这确保操作这些对象的代码可以依赖于常见的形式，如比较。
    // Canonicalize 在验证成功但对象尚未持久化时调用。此方法可能会更改对象。
    Canonicalize(obj runtime.Object)
    // AllowUnconditionalUpdate 如果可以在对象中没有指定资源版本的情况下无条件地进行更新，则返回 true。
    AllowUnconditionalUpdate() bool
}
```

### 1.3 RESTDeleteStrategy

```go
type RESTDeleteStrategy interface {
	runtime.ObjectTyper
}
```

## 2. Daemonset REST 实现
API 对象 Strategy 和 REST 都定义在 `kubernetes/pkg/registry/apps/${group}/${kind}/` 目录内，以 daemonset 为例
1. Strategy 定义: `kubernetes/pkg/registry/apps/daemonset/strategy.go`
2. REST 定义: `kubernetes/pkg/registry/apps/daemonset/storage/storage.go`

![daemonset REST 实现](/images/k8s/k8s_use/rest_storage.png)

### 2.1 REST
Daemonset REST 在实现基本就是直接继承 Store 实现的各种方法

```go
// pkg/registry/apps/daemonset/storage/storage.go
// REST implements a RESTStorage for DaemonSets
type REST struct {
	*genericregistry.Store
}

// NewREST returns a RESTStorage object that will work against DaemonSets.
func NewREST(optsGetter generic.RESTOptionsGetter) (*REST, *StatusREST, error) {
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &apps.DaemonSet{} },
		NewListFunc:               func() runtime.Object { return &apps.DaemonSetList{} },
		DefaultQualifiedResource:  apps.Resource("daemonsets"),
		SingularQualifiedResource: apps.Resource("daemonset"),

		CreateStrategy:      daemonset.Strategy,
		UpdateStrategy:      daemonset.Strategy,
		DeleteStrategy:      daemonset.Strategy,
		ResetFieldsStrategy: daemonset.Strategy,

		TableConvertor: printerstorage.TableConvertor{TableGenerator: printers.NewTableGenerator().With(printersinternal.AddHandlers)},
	}
	options := &generic.StoreOptions{RESTOptions: optsGetter}
	if err := store.CompleteWithOptions(options); err != nil {
		return nil, nil, err
	}

	statusStore := *store
	statusStore.UpdateStrategy = daemonset.StatusStrategy
	statusStore.ResetFieldsStrategy = daemonset.StatusStrategy

	return &REST{store}, &StatusREST{store: &statusStore}, nil
}
```

### 1.2 Strategy
daemonSetStrategy 实现了所有 Strategy 接口定义的方法:

```go
// daemonSetStrategy implements verification logic for daemon sets.
type daemonSetStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

// Strategy is the default logic that applies when creating and updating DaemonSet objects.
var Strategy = daemonSetStrategy{legacyscheme.Scheme, names.SimpleNameGenerator}


func (daemonSetStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	newDaemonSet := obj.(*apps.DaemonSet)
	oldDaemonSet := old.(*apps.DaemonSet)
	newDaemonSet.Spec = oldDaemonSet.Spec
}
```

## 2. API 对象 REST 实现定义位置
|代码位置|作用|
|:---|:---|
|kubernetes/pkg/registry|负责k8s内置的资源对象存储逻辑实现|
|kubenetes/staging/src/k8s.io/apiextensions-apiserver/pkg/registry|负责crd和cr资源对象存储逻辑实现|
|kubenetes/staging/src/k8s.io/kube-aggregator/pkg/registry|负责APIService资源对象的存储和实现|