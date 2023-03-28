---
weight: 1
title: "API REST 实现"
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

## 1. API REST 抽象层次
### 1.1 Store、Rest、Strategy
前面我们介绍了 API Server 的数据访问层抽象，我们说到 k8s 将所有对 API 对象的操作都封装在 [Store](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/generic/registry/store.go#L96) 结构体中:
1. Store 对外实现了很多接口，包括 GET、WATCH... 这些接口是对 API 对象对外暴露的操作接口，下面称为操作的抽象
2. Store 对内接受了多个 Strategy 接口对象，包括 RESTCreateStrategy、RESTUpdateStrategy.. 这些 Strategy 就是如何操作一个 API 对象实现 CURD 的抽象，实现的抽象
3. 所有操作的抽象和实现的抽象(Strategy) 都定义在 [apiserver/pkg/registry/rest/](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/rest/)
4. 每一个 API 对象都会通过嵌入 Store 的方式自定义一个 Rest 结构体，并实现自己的 Strategy

以 daemonset 为例 Store、Rest、Strategy 的关系如下:

![daemonset 抽象](/images/k8s/k8s_use/daemonset_rest.png)

整个实现过程基本与 Store 注释描述的一致:
1. Store 实现了k8s.io/apiserver/pkg/registry/rest.StandardStorage 接口
2. Store 是可嵌入的，Store 预期用途是嵌入到每个 API 对象特定的 RESTStorage 实现中。
3. RESTStorage 为 API 对象提供 CRUD 语义，并使用 ResourceVersion 和语义，处理并发冲突。
4. RESTCreateStrategy、RESTUpdateStrategy 和 RESTDeleteStrategy 是所有 API 对象实现 CURD 操作的抽象

### 1.2 REST 操作抽象的接口
API REST 抽象的所有结构都定义在 [apiserver/pkg/registry/rest/](https://github.com/kubernetes/apiserver/blob/master/pkg/registry/rest/)，所有接口大体可以分成上面所说的两个部分:
1. StandardStorage 接口: API CURD 语义接口，API Server 通过这些接口，完成对 API 对象的增删改查
2. Strategy 接口: API 对象 CURD 如何实现的接口，需要为每个 API 对象实现这些接口

![StandardStorage 接口](/images/k8s/k8s_use/standard_storage.png)

![Strategy 接口](/images/k8s/k8s_use/strategy.png)

Strategy 最核心的是 RESTCreateStrategy、RESTUpdateStrategy、RESTDeleteStrategy 它们被统一在 GenericStore 下:

```go
// apiserver/pkg/registry/generic/registry/store.go
type GenericStore interface {
	GetCreateStrategy() rest.RESTCreateStrategy
	GetUpdateStrategy() rest.RESTUpdateStrategy
	GetDeleteStrategy() rest.RESTDeleteStrategy
}
```

## 1. Store
Store 定义在 apiserver/pkg/registry/generic/registry/store.go 中:

|范围|属性|作用|
|:---|:---|:---|
|一般属性|NewFunc|当请求单个对象时返回类型的新实例的函数，例如 curl GET /apis/group/version/namespaces/my-ns/myresource/name-of-object|
||NewListFunc|返回此注册表的类型的新列表；它是在列出资源时返回的类型，例如 curl GET /apis/group/version/namespaces/my-ns/myresource|
||DefaultQualifiedResource|资源的复数名称。如果上下文中没有请求信息，则使用此字段。有关详细信息，请参见qualifiedResourceFromContext。|
||SingularQualifiedResource|资源的单数名称。|
||KeyRootFunc|返回此资源的根etcd键；不应包含尾随“/”。这用于处理整个集合的操作（列出和观察）。KeyRootFunc和KeyFunc必须一起提供或全部不提供。|
||KeyFunc|返回集合中特定对象的键。调用Create/Update/Get/Delete时会调用KeyFunc。请注意，'namespace'可以从ctx中获取。KeyFunc和KeyRootFunc必须一起提供或全部不提供。|
||ObjectNameFunc|返回对象的名称或错误。|
||TTLFunc|返回应将对象持久化的TTL（存活时间）。现有参数是此操作的当前TTL或默认值。update参数指示是否针对现有对象执行此操作。使用TTL持久化的对象在TTL过期后将被逐出。|
||PredicateFunc|返回与提供的标签和字段对应的匹配程序。返回的SelectionPredicate应返回true，如果对象与给定的字段和标签选择器匹配。|
||EnableGarbageCollection|影响Update和Delete请求的处理。启用垃圾回收允许终结器 finalizers 在存储删除对象之前完成对该对象的最终化处理。如果任何存储启用了垃圾回收，则必须在kube-controller-manager中启用它。|
||DeleteCollectionWorkers|在单个DeleteCollection调用中的最大工作程序数。集合中项目的删除请求是并行发出的。|
||ReturnDeletedObject|决定 Store 是否返回被删除的对象。否则，返回一个通用的成功状态响应|
||ShouldDeleteDuringUpdate|是一个可选的函数，用于确定从现有对象更新到新对象是否应该导致删除。如果指定，除了标准的 finalizer、deletionTimestamp 和 deletionGracePeriodSeconds 检查外，还会进行检查。|
||TableConvertor |是一个可选接口，用于将项目或项目列表转换为表格输出。如果未设置，则使用默认值|
||Storage |是资源的底层存储接口。它被包装成一个“DryRunnableStorage”，它将直接传递或仅执行干运行。|
||StorageVersioner |根据对象的可能种类列表，在持久化到 etcd 之前输出对象将被转换为的 <group/version/kind>。如果 StorageVersioner 为 nil，则 apiserver 将在发现文档中将 storageVersionHash 设置为空|
||DestroyFunc |清理底层 Storage 使用的客户端，是可选的。如果设置了 DestroyFunc，则必须以线程安全的方式实现，并准备好被多次调用。|
|钩子函数|Decorator|是在对象从底层存储返回时执行的可选钩子。返回的对象可以是单个对象（例如Pod）或列表类型（例如PodList）。装饰器适用于位于存储之上的集成，应仅用于不适合存储该值的特定情况，因为它们无法被观察。|
||BeginUpdate |是一个可选的钩子，返回一个“类事务”的提交/回滚函数，该函数将在操作结束时但在 AfterUpdate 和 Decorator 之前被调用，并通过参数指示操作是否成功。如果此函数返回一个错误，则不会调用该函数。几乎没有人应该使用此钩子|
||BeginCreate|是一个可选挂钩，返回一个“事务-like”提交/还原函数，该函数将在操作结束时但在AfterCreate和Decorator之前调用，通过参数指示操作是否成功。如果返回错误，则不调用该函数。几乎没有人应该使用此挂钩。|
||AfterCreate|在创建资源之后并在其被装饰之前运行的进一步操作，可选。|
||AfterUpdate|实现了在资源更新后且在装饰之前运行的进一步操作，是可选的|
||AfterDelete|实现了在资源删除后且在装饰之前运行的进一步操作，是可选的。|
|Strategy|DeleteStrategy| 实现了删除期间的资源特定行为。|
||CreateStrategy|在创建期间实现特定于资源的行为的策略。|
||UpdateStrategy|实现了更新期间的资源特定行为。|
||ResetFieldsStrategy |提供了由策略重置的字段，这些字段不应由用户修改。|

```go
type Store struct {
	// NewFunc returns a new instance of the type this registry returns for a
	// GET of a single object, e.g.:
	//
	// curl GET /apis/group/version/namespaces/my-ns/myresource/name-of-object
	NewFunc func() runtime.Object

	// NewListFunc returns a new list of the type this registry; it is the
	// type returned when the resource is listed, e.g.:
	//
	// curl GET /apis/group/version/namespaces/my-ns/myresource
	NewListFunc func() runtime.Object

	// DefaultQualifiedResource is the pluralized name of the resource.
	// This field is used if there is no request info present in the context.
	// See qualifiedResourceFromContext for details.
	DefaultQualifiedResource schema.GroupResource

	// SingularQualifiedResource is the singular name of the resource.
	SingularQualifiedResource schema.GroupResource

	// KeyRootFunc returns the root etcd key for this resource; should not
	// include trailing "/".  This is used for operations that work on the
	// entire collection (listing and watching).
	//
	// KeyRootFunc and KeyFunc must be supplied together or not at all.
	KeyRootFunc func(ctx context.Context) string

	// KeyFunc returns the key for a specific object in the collection.
	// KeyFunc is called for Create/Update/Get/Delete. Note that 'namespace'
	// can be gotten from ctx.
	//
	// KeyFunc and KeyRootFunc must be supplied together or not at all.
	KeyFunc func(ctx context.Context, name string) (string, error)

	// ObjectNameFunc returns the name of an object or an error.
	ObjectNameFunc func(obj runtime.Object) (string, error)

	// TTLFunc returns the TTL (time to live) that objects should be persisted
	// with. The existing parameter is the current TTL or the default for this
	// operation. The update parameter indicates whether this is an operation
	// against an existing object.
	//
	// Objects that are persisted with a TTL are evicted once the TTL expires.
	TTLFunc func(obj runtime.Object, existing uint64, update bool) (uint64, error)

	// PredicateFunc returns a matcher corresponding to the provided labels
	// and fields. The SelectionPredicate returned should return true if the
	// object matches the given field and label selectors.
	PredicateFunc func(label labels.Selector, field fields.Selector) storage.SelectionPredicate

	// EnableGarbageCollection affects the handling of Update and Delete
	// requests. Enabling garbage collection allows finalizers to do work to
	// finalize this object before the store deletes it.
	//
	// If any store has garbage collection enabled, it must also be enabled in
	// the kube-controller-manager.
	EnableGarbageCollection bool

	// DeleteCollectionWorkers is the maximum number of workers in a single
	// DeleteCollection call. Delete requests for the items in a collection
	// are issued in parallel.
	DeleteCollectionWorkers int

	// Decorator is an optional exit hook on an object returned from the
	// underlying storage. The returned object could be an individual object
	// (e.g. Pod) or a list type (e.g. PodList). Decorator is intended for
	// integrations that are above storage and should only be used for
	// specific cases where storage of the value is not appropriate, since
	// they cannot be watched.
	Decorator func(runtime.Object)

	// CreateStrategy implements resource-specific behavior during creation.
	CreateStrategy rest.RESTCreateStrategy
	// BeginCreate is an optional hook that returns a "transaction-like"
	// commit/revert function which will be called at the end of the operation,
	// but before AfterCreate and Decorator, indicating via the argument
	// whether the operation succeeded.  If this returns an error, the function
	// is not called.  Almost nobody should use this hook.
	BeginCreate BeginCreateFunc
	// AfterCreate implements a further operation to run after a resource is
	// created and before it is decorated, optional.
	AfterCreate AfterCreateFunc

	// UpdateStrategy implements resource-specific behavior during updates.
	UpdateStrategy rest.RESTUpdateStrategy
	// BeginUpdate is an optional hook that returns a "transaction-like"
	// commit/revert function which will be called at the end of the operation,
	// but before AfterUpdate and Decorator, indicating via the argument
	// whether the operation succeeded.  If this returns an error, the function
	// is not called.  Almost nobody should use this hook.
	BeginUpdate BeginUpdateFunc
	// AfterUpdate implements a further operation to run after a resource is
	// updated and before it is decorated, optional.
	AfterUpdate AfterUpdateFunc

	// DeleteStrategy implements resource-specific behavior during deletion.
	DeleteStrategy rest.RESTDeleteStrategy
	// AfterDelete implements a further operation to run after a resource is
	// deleted and before it is decorated, optional.
	AfterDelete AfterDeleteFunc
	// ReturnDeletedObject determines whether the Store returns the object
	// that was deleted. Otherwise, return a generic success status response.
	ReturnDeletedObject bool
	// ShouldDeleteDuringUpdate is an optional function to determine whether
	// an update from existing to obj should result in a delete.
	// If specified, this is checked in addition to standard finalizer,
	// deletionTimestamp, and deletionGracePeriodSeconds checks.
	ShouldDeleteDuringUpdate func(ctx context.Context, key string, obj, existing runtime.Object) bool

	// TableConvertor is an optional interface for transforming items or lists
	// of items into tabular output. If unset, the default will be used.
	TableConvertor rest.TableConvertor

	// ResetFieldsStrategy provides the fields reset by the strategy that
	// should not be modified by the user.
	ResetFieldsStrategy rest.ResetFieldsStrategy

	// Storage is the interface for the underlying storage for the
	// resource. It is wrapped into a "DryRunnableStorage" that will
	// either pass-through or simply dry-run.
	Storage DryRunnableStorage
	// StorageVersioner outputs the <group/version/kind> an object will be
	// converted to before persisted in etcd, given a list of possible
	// kinds of the object.
	// If the StorageVersioner is nil, apiserver will leave the
	// storageVersionHash as empty in the discovery document.
	StorageVersioner runtime.GroupVersioner

	// DestroyFunc cleans up clients used by the underlying Storage; optional.
	// If set, DestroyFunc has to be implemented in thread-safe way and
	// be prepared for being called more than once.
	DestroyFunc func()
}

```

接下来我们以 Get、List、Create、Update、Delete 为例看看 Store 的实现。这几个函数的入参，都有一个 options 参数，他们分别定义在:
1. [ListOptions](https://github.com/kubernetes/apimachinery/blob/master/pkg/apis/meta/v1/types.go#L322)
1. [GetOptions](https://github.com/kubernetes/apimachinery/blob/master/pkg/apis/meta/v1/types.go#L454)
1. [CreateOptions](https://github.com/kubernetes/apimachinery/blob/master/pkg/apis/meta/v1/types.go#L550)
1. [UpdateOptions](https://github.com/kubernetes/apimachinery/blob/master/pkg/apis/meta/v1/types.go#L677)
1. [DeleteOptions](https://github.com/kubernetes/apimachinery/blob/master/pkg/apis/meta/v1/types.go#L494)

### 1.2 List 

```go
func (e *Store) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	label := labels.Everything()
	if options != nil && options.LabelSelector != nil {
		label = options.LabelSelector
	}
	field := fields.Everything()
	if options != nil && options.FieldSelector != nil {
		field = options.FieldSelector
	}
	out, err := e.ListPredicate(ctx, e.PredicateFunc(label, field), options)
	if err != nil {
		return nil, err
	}
	if e.Decorator != nil {
		e.Decorator(out)
	}
	return out, nil
}


func (e *Store) ListPredicate(ctx context.Context, p storage.SelectionPredicate, options *metainternalversion.ListOptions) (runtime.Object, error) {
	if options == nil {
		// By default we should serve the request from etcd.
		options = &metainternalversion.ListOptions{ResourceVersion: ""}
	}
	p.Limit = options.Limit
	p.Continue = options.Continue
	list := e.NewListFunc()
	// qualifiedResourceFromContext尝试从上下文的请求信息中检索GroupResource。
	// 如果上下文没有请求信息，则使用DefaultQualifiedResource。
	qualifiedResource := e.qualifiedResourceFromContext(ctx)
	storageOpts := storage.ListOptions{
		ResourceVersion:      options.ResourceVersion,
		ResourceVersionMatch: options.ResourceVersionMatch,
		Predicate:            p,
		Recursive:            true,
	}
	// 从 field selector 中提取 key 名称
	if name, ok := p.MatchesSingle(); ok {
		if key, err := e.KeyFunc(ctx, name); err == nil {
			storageOpts.Recursive = false
			err := e.Storage.GetList(ctx, key, storageOpts, list)
			return list, storeerr.InterpretListError(err, qualifiedResource)
		}
		// if we cannot extract a key based on the current context, the optimization is skipped
	}

	err := e.Storage.GetList(ctx, e.KeyRootFunc(ctx), storageOpts, list)
	return list, storeerr.InterpretListError(err, qualifiedResource)
}
```

### 1.3 Create
Create根据对象中的唯一键插入一个新项。注意，注册表可能会改变输入对象(例如在策略钩子中)。调用此方法的测试如果希望能够检查输入和输出对象的差异，则可能需要调用DeepCopy。

```go
func (e *Store) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	var finishCreate FinishFunc = finishNothing
	// 1. 初始化创建的新对象的元数据
	// Init metadata as early as possible.
	if objectMeta, err := meta.Accessor(obj); err != nil {
		return nil, err
	} else {
		rest.FillObjectMetaSystemFields(objectMeta)
		if len(objectMeta.GetGenerateName()) > 0 && len(objectMeta.GetName()) == 0 {
			objectMeta.SetName(e.CreateStrategy.GenerateName(objectMeta.GetGenerateName()))
		}
	}
	// 2. BeginCreate 钩子函数
	if e.BeginCreate != nil {
		fn, err := e.BeginCreate(ctx, obj, options)
		if err != nil {
			return nil, err
		}
		finishCreate = fn
		defer func() {
			finishCreate(ctx, false)
		}()
	}
	// BeforeCreate确保在创建时对所有资源执行通用操作。
	// 只返回可以转换为api.Status的错误。它调用PrepareForCreate，然后调用Validate。如果需要创建该对象，则返回nil。
	if err := rest.BeforeCreate(e.CreateStrategy, ctx, obj); err != nil {
		return nil, err
	}
	// at this point we have a fully formed object.  It is time to call the validators that the apiserver
	// handling chain wants to enforce.
	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}

	name, err := e.ObjectNameFunc(obj)
	if err != nil {
		return nil, err
	}
	key, err := e.KeyFunc(ctx, name)
	if err != nil {
		return nil, err
	}
	qualifiedResource := e.qualifiedResourceFromContext(ctx)
	ttl, err := e.calculateTTL(obj, 0, false)
	if err != nil {
		return nil, err
	}
	out := e.NewFunc()
	// 调用底层存储保存数据
	if err := e.Storage.Create(ctx, key, obj, out, ttl, dryrun.IsDryRun(options.DryRun)); err != nil {
		err = storeerr.InterpretCreateError(err, qualifiedResource, name)
		err = rest.CheckGeneratedNameError(ctx, e.CreateStrategy, err, obj)
		if !apierrors.IsAlreadyExists(err) {
			return nil, err
		}
		if errGet := e.Storage.Get(ctx, key, storage.GetOptions{}, out); errGet != nil {
			return nil, err
		}
		accessor, errGetAcc := meta.Accessor(out)
		if errGetAcc != nil {
			return nil, err
		}
		if accessor.GetDeletionTimestamp() != nil {
			msg := &err.(*apierrors.StatusError).ErrStatus.Message
			*msg = fmt.Sprintf("object is being deleted: %s", *msg)
		}
		return nil, err
	}
	// The operation has succeeded.  Call the finish function if there is one,
	// and then make sure the defer doesn't call it again.
	// 调用钩子函数
	fn := finishCreate
	finishCreate = finishNothing
	fn(ctx, true)

	if e.AfterCreate != nil {
		e.AfterCreate(out, options)
	}
	if e.Decorator != nil {
		e.Decorator(out)
	}
	return out, nil
}
```

### 1.4 Update

```go
// Update执行对象的原子更新和设置。返回更新的结果或错误。
// 如果允许在更新时创建，则将执行创建流。bool值连同对象和任何错误一起返回，以指示对象的创建。
func (e *Store) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	key, err := e.KeyFunc(ctx, name)
	if err != nil {
		return nil, false, err
	}

	var (
		creatingObj runtime.Object
		creating    = false
	)

	qualifiedResource := e.qualifiedResourceFromContext(ctx)
	storagePreconditions := &storage.Preconditions{}
	if preconditions := objInfo.Preconditions(); preconditions != nil {
		storagePreconditions.UID = preconditions.UID
		storagePreconditions.ResourceVersion = preconditions.ResourceVersion
	}

	out := e.NewFunc()
	// deleteObj is only used in case a deletion is carried out
	var deleteObj runtime.Object
	err = e.Storage.GuaranteedUpdate(ctx, key, out, true, storagePreconditions, func(existing runtime.Object, res storage.ResponseMeta) (runtime.Object, *uint64, error) {
		existingResourceVersion, err := e.Storage.Versioner().ObjectResourceVersion(existing)
		if err != nil {
			return nil, nil, err
		}
		if existingResourceVersion == 0 {
			if !e.UpdateStrategy.AllowCreateOnUpdate() && !forceAllowCreate {
				return nil, nil, apierrors.NewNotFound(qualifiedResource, name)
			}
		}

		// Given the existing object, get the new object
		obj, err := objInfo.UpdatedObject(ctx, existing)
		if err != nil {
			return nil, nil, err
		}

		// 如果AllowUnconditionalUpdate()为true，并且用户指定的对象没有资源版本，则用最新版本填充它。
		// 否则，检查用户指定的版本是否与最新存储对象的版本匹配。
		// If AllowUnconditionalUpdate() is true and the object specified by
		// the user does not have a resource version, then we populate it with
		// the latest version. Else, we check that the version specified by
		// the user matches the version of latest storage object.
		newResourceVersion, err := e.Storage.Versioner().ObjectResourceVersion(obj)
		if err != nil {
			return nil, nil, err
		}
		doUnconditionalUpdate := newResourceVersion == 0 && e.UpdateStrategy.AllowUnconditionalUpdate()

		// 执行创建逻辑
		if existingResourceVersion == 0 {
			// Init metadata as early as possible.
			if objectMeta, err := meta.Accessor(obj); err != nil {
				return nil, nil, err
			} else {
				rest.FillObjectMetaSystemFields(objectMeta)
			}

			var finishCreate FinishFunc = finishNothing

			if e.BeginCreate != nil {
				fn, err := e.BeginCreate(ctx, obj, newCreateOptionsFromUpdateOptions(options))
				if err != nil {
					return nil, nil, err
				}
				finishCreate = fn
				defer func() {
					finishCreate(ctx, false)
				}()
			}

			creating = true
			creatingObj = obj
			if err := rest.BeforeCreate(e.CreateStrategy, ctx, obj); err != nil {
				return nil, nil, err
			}
			// at this point we have a fully formed object.  It is time to call the validators that the apiserver
			// handling chain wants to enforce.
			if createValidation != nil {
				if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
					return nil, nil, err
				}
			}
			ttl, err := e.calculateTTL(obj, 0, false)
			if err != nil {
				return nil, nil, err
			}

			// The operation has succeeded.  Call the finish function if there is one,
			// and then make sure the defer doesn't call it again.
			fn := finishCreate
			finishCreate = finishNothing
			fn(ctx, true)

			return obj, &ttl, nil
		}
		// 执行更新逻辑
		creating = false
		creatingObj = nil
		if doUnconditionalUpdate {
			// Update the object's resource version to match the latest
			// storage object's resource version.
			err = e.Storage.Versioner().UpdateObject(obj, res.ResourceVersion)
			if err != nil {
				return nil, nil, err
			}
		} else {
			// Check if the object's resource version matches the latest
			// resource version.
			if newResourceVersion == 0 {
				// TODO: The Invalid error should have a field for Resource.
				// After that field is added, we should fill the Resource and
				// leave the Kind field empty. See the discussion in #18526.
				qualifiedKind := schema.GroupKind{Group: qualifiedResource.Group, Kind: qualifiedResource.Resource}
				fieldErrList := field.ErrorList{field.Invalid(field.NewPath("metadata").Child("resourceVersion"), newResourceVersion, "must be specified for an update")}
				return nil, nil, apierrors.NewInvalid(qualifiedKind, name, fieldErrList)
			}
			if newResourceVersion != existingResourceVersion {
				return nil, nil, apierrors.NewConflict(qualifiedResource, name, fmt.Errorf(OptimisticLockErrorMsg))
			}
		}

		var finishUpdate FinishFunc = finishNothing

		if e.BeginUpdate != nil {
			fn, err := e.BeginUpdate(ctx, obj, existing, options)
			if err != nil {
				return nil, nil, err
			}
			finishUpdate = fn
			defer func() {
				finishUpdate(ctx, false)
			}()
		}

		if err := rest.BeforeUpdate(e.UpdateStrategy, ctx, obj, existing); err != nil {
			return nil, nil, err
		}
		// at this point we have a fully formed object.  It is time to call the validators that the apiserver
		// handling chain wants to enforce.
		if updateValidation != nil {
			if err := updateValidation(ctx, obj.DeepCopyObject(), existing.DeepCopyObject()); err != nil {
				return nil, nil, err
			}
		}

		// ShouldDeleteDuringUpdate是默认函数，用于检查在更新过程中是否应该删除对象。
		// 它检查新对象是否没有终结器，现有对象的deletionTimestamp已设置，现有对象的deletionGracePeriodSeconds是否为0或nil
		// Check the default delete-during-update conditions, and store-specific conditions if provided
		if ShouldDeleteDuringUpdate(ctx, key, obj, existing) &&
			(e.ShouldDeleteDuringUpdate == nil || e.ShouldDeleteDuringUpdate(ctx, key, obj, existing)) {
			deleteObj = obj
			return nil, nil, errEmptiedFinalizers
		}
		ttl, err := e.calculateTTL(obj, res.TTL, true)
		if err != nil {
			return nil, nil, err
		}

		// The operation has succeeded.  Call the finish function if there is one,
		// and then make sure the defer doesn't call it again.
		fn := finishUpdate
		finishUpdate = finishNothing
		fn(ctx, true)

		if int64(ttl) != res.TTL {
			return obj, &ttl, nil
		}
		return obj, nil, nil
	}, dryrun.IsDryRun(options.DryRun), nil)

	if err != nil {
		// delete the object
		if err == errEmptiedFinalizers {
			return e.deleteWithoutFinalizers(ctx, name, key, deleteObj, storagePreconditions, newDeleteOptionsFromUpdateOptions(options))
		}
		if creating {
			err = storeerr.InterpretCreateError(err, qualifiedResource, name)
			err = rest.CheckGeneratedNameError(ctx, e.CreateStrategy, err, creatingObj)
		} else {
			err = storeerr.InterpretUpdateError(err, qualifiedResource, name)
		}
		return nil, false, err
	}

	if creating {
		if e.AfterCreate != nil {
			e.AfterCreate(out, newCreateOptionsFromUpdateOptions(options))
		}
	} else {
		if e.AfterUpdate != nil {
			e.AfterUpdate(out, options)
		}
	}
	if e.Decorator != nil {
		e.Decorator(out)
	}
	return out, creating, nil
}
```
### 1.5 Delete
Graceful 删除逻辑

### 1.6 Store 中的钩子函数
在 Kubernetes 的 Store 中，对象的创建、更新和删除会涉及到一系列的钩子函数，这些钩子函数可以对对象的行为进行定制化处理。这些钩子函数包括：

1. BeforeCreate：在对象创建之前执行，用于对对象进行一些额外的处理或者校验。
2. AfterCreate：在对象创建之后执行，用于对对象进行一些后续的操作或者通知。
3. BeforeUpdate：在对象更新之前执行，用于对对象进行一些额外的处理或者校验。
4. AfterUpdate：在对象更新之后执行，用于对对象进行一些后续的操作或者通知。
6. BeforeDelete：在对象删除之前执行，用于对对象进行一些额外的处理或者校验。
7. AfterDelete：在对象删除之后执行，用于对对象进行一些后续的操作或者通知。

Decorator 和 BeginCreate 都是 Store 中的可选钩子函数，其执行位置与其他钩子函数的执行位置不同。

在创建资源时，钩子函数的执行顺序如下：

1. 序列化请求体
2. 验证请求体
3. 调用 Store.Create() 方法
4. 执行 BeginCreate 钩子函数
5. 执行 CreateStrategy.PrepareForCreate() 方法，对要创建的对象进行预处理
6. 执行 CreateStrategy.Create() 方法，创建对象
7. 执行 AfterCreate 钩子函数
8. 执行 Decorator 钩子函数