---
weight: 1
title: "etcd3 存储实现"
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

上一节我们介绍了 k8s 数据访问层抽象，也介绍了 etcd3 store 数据结构包含的成员变量。有了上面的基础，我们就可以阅读 etcd3 的实现了。这里我们重点关注 etcd3 实现的 Get、Watch、GuaranteedUpdate 三个方法。

## 1. etcd3 实现
### 1.1 Get

Get 方法比较简单，就是通过 etcd3 的客户端查询给定 key 的数据，并解码。Get 有两个控制参数:

```go
type GetOptions struct {
	// IgnoreNotFound确定如果没有找到请求的对象将返回什么。如果为true，则返回一个0对象。如果为false，则返回错误。
	IgnoreNotFound bool
	// ResourceVersion 提供了一个资源版本约束，作为“不大于”约束应用于get操作:结果包含的数据至少与所提供的ResourceVersion一样新。
    // 最好使用最新的可用数据，但也可以提供不超过这个ResourceVersion的任何数据。
	ResourceVersion string
}
```

Get 方法具体实现如下:

```go
// Get implements storage.Interface.Get.
func (s *store) Get(ctx context.Context, key string, opts storage.GetOptions, out runtime.Object) error {
	// 1. key 标准化
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return err
	}
	startTime := time.Now()
	getResp, err := s.client.KV.Get(ctx, preparedKey)
	metrics.RecordEtcdRequestLatency("get", s.groupResourceString, startTime)
	if err != nil {
		return err
	}
	// 2. 当提供的 minimumResourceVersion 大于存储中可用的最近的 actualRevision 时，返回“too large resource”版本错误。
    // 
	if err = s.validateMinimumResourceVersion(opts.ResourceVersion, uint64(getResp.Header.Revision)); err != nil {
		return err
	}

	if len(getResp.Kvs) == 0 {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(out)
		}
		return storage.NewKeyNotFoundError(preparedKey, 0)
	}
	kv := getResp.Kvs[0]

	data, _, err := s.transformer.TransformFromStorage(ctx, kv.Value, authenticatedDataString(preparedKey))
	if err != nil {
		return storage.NewInternalError(err.Error())
	}
	// 3. 解码数据
	err = decode(s.codec, s.versioner, data, out, kv.ModRevision)
	if err != nil {
		recordDecodeError(s.groupResourceString, preparedKey)
		return err
	}
	return nil
}
```

### 1.2 GuaranteedUpdate
GuaranteedUpdate 会使用 etcd 事务(CAS) 操作不断尝试更新数据，直至数据更新到 etcd。整体比较复杂，包含了很多错误检查逻辑。

```go
// GuaranteedUpdate implements storage.Interface.GuaranteedUpdate.
func (s *store) GuaranteedUpdate(
	ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool,
	preconditions *storage.Preconditions, tryUpdate storage.UpdateFunc, cachedExistingObject runtime.Object) error {
	// 1. key 标准化
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return err
	}
	ctx, span := tracing.Start(ctx, "GuaranteedUpdate etcd3",
		attribute.String("audit-id", audit.GetAuditIDTruncated(ctx)),
		attribute.String("key", key),
		attribute.String("type", getTypeName(destination)),
		attribute.String("resource", s.groupResourceString))
	defer span.End(500 * time.Millisecond)

	v, err := conversion.EnforcePtr(destination)
	if err != nil {
		return fmt.Errorf("unable to convert output object to pointer: %v", err)
	}
	// 2. 解析 key 当前的数据，返回的是 objState 对象
	// objState 包含了 decode 后的结果数据，解析前的原始数据，etcd 返回的 metadata 数据
	getCurrentState := func() (*objState, error) {
		startTime := time.Now()
		getResp, err := s.client.KV.Get(ctx, preparedKey)
		metrics.RecordEtcdRequestLatency("get", s.groupResourceString, startTime)
		if err != nil {
			return nil, err
		}
		return s.getState(ctx, getResp, preparedKey, v, ignoreNotFound)
	}

	var origState *objState
	var origStateIsCurrent bool
	// 从传入的缓存对象中，解析出 objState
	if cachedExistingObject != nil {
		origState, err = s.getStateFromObject(cachedExistingObject)
	} else {
		origState, err = getCurrentState()
		origStateIsCurrent = true
	}
	if err != nil {
		return err
	}
	span.AddEvent("initial value restored")

	transformContext := authenticatedDataString(preparedKey)
	for {
		// 执行更新前检查
		if err := preconditions.Check(preparedKey, origState.obj); err != nil {
			// If our data is already up to date, return the error
			if origStateIsCurrent {
				return err
			}

			// It's possible we were working with stale data
			// Actually fetch
			origState, err = getCurrentState()
			if err != nil {
				return err
			}
			origStateIsCurrent = true
			// Retry
			continue
		}
		// 获取更新后的数据
		ret, ttl, err := s.updateState(origState, tryUpdate)
		if err != nil {
			// If our data is already up to date, return the error
			if origStateIsCurrent {
				return err
			}

			// It's possible we were working with stale data
			// Remember the revision of the potentially stale data and the resulting update error
			// 缓存的数据版本
			cachedRev := origState.rev
			cachedUpdateErr := err

			// Actually fetch
			origState, err = getCurrentState()
			if err != nil {
				return err
			}
			origStateIsCurrent = true

			// 前面已经判断了，cachedRev 当前不可能是从 etcd 获取的最新数据
			// 如果缓存的数据版本跟从 etcd 获取的最新数据是同一个版本，继续尝试已经没有意义
			// it turns out our cached data was not stale, return the error
			if cachedRev == origState.rev {
				return cachedUpdateErr
			}

			// Retry
			continue
		}

		span.AddEvent("About to Encode")
		data, err := runtime.Encode(s.codec, ret)
		if err != nil {
			span.AddEvent("Encode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
			return err
		}
		span.AddEvent("Encode succeeded", attribute.Int("len", len(data)))
		if !origState.stale && bytes.Equal(data, origState.data) {
			// 要更新的数据已经发送到 etcd，etcd 正处于同步的过程中
			// if we skipped the original Get in this loop, we must refresh from
			// etcd in order to be sure the data in the store is equivalent to
			// our desired serialization
			if !origStateIsCurrent {
				origState, err = getCurrentState()
				if err != nil {
					return err
				}
				origStateIsCurrent = true
				// etcd 最新数据域与要更新的数据不一致，重新开启新一轮的循环，尝试写入数据
				if !bytes.Equal(data, origState.data) {
					// original data changed, restart loop
					continue
				}
			}
			// 到这里 origState 已经是 etcd 的最新数据了，并且最新数据与我们要写入的数据也是一样的，但是数据还未达成共识，说明数据已经写入
			// recheck that the data from etcd is not stale before short-circuiting a write
			if !origState.stale {
				err = decode(s.codec, s.versioner, origState.data, destination, origState.rev)
				if err != nil {
					recordDecodeError(s.groupResourceString, preparedKey)
					return err
				}
				// 如果解码不发生错误，可以正常返回了
				return nil
			}
		}

		newData, err := s.transformer.TransformToStorage(ctx, data, transformContext)
		if err != nil {
			span.AddEvent("TransformToStorage failed", attribute.String("err", err.Error()))
			return storage.NewInternalError(err.Error())
		}
		span.AddEvent("TransformToStorage succeeded")

		opts, err := s.ttlOpts(ctx, int64(ttl))
		if err != nil {
			return err
		}
		span.AddEvent("Transaction prepared")

		startTime := time.Now()
		// 使用 CAS 更新数据
		txnResp, err := s.client.KV.Txn(ctx).If(
			clientv3.Compare(clientv3.ModRevision(preparedKey), "=", origState.rev),
		).Then(
			clientv3.OpPut(preparedKey, string(newData), opts...),
		).Else(
			clientv3.OpGet(preparedKey),
		).Commit()
		metrics.RecordEtcdRequestLatency("update", s.groupResourceString, startTime)
		if err != nil {
			span.AddEvent("Txn call failed", attribute.String("err", err.Error()))
			return err
		}
		span.AddEvent("Txn call completed")
		span.AddEvent("Transaction committed")
		// 未更新成功，重启循环
		if !txnResp.Succeeded {
			getResp := (*clientv3.GetResponse)(txnResp.Responses[0].GetResponseRange())
			klog.V(4).Infof("GuaranteedUpdate of %s failed because of a conflict, going to retry", preparedKey)
			origState, err = s.getState(ctx, getResp, preparedKey, v, ignoreNotFound)
			if err != nil {
				return err
			}
			span.AddEvent("Retry value restored")
			origStateIsCurrent = true
			continue
		}
		// 更新成功，返回数据
		putResp := txnResp.Responses[0].GetResponsePut()

		err = decode(s.codec, s.versioner, data, destination, putResp.Header.Revision)
		if err != nil {
			span.AddEvent("decode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
			recordDecodeError(s.groupResourceString, preparedKey)
			return err
		}
		span.AddEvent("decode succeeded", attribute.Int("len", len(data)))
		return nil
	}
}
```

### 1.2 Watch 方法
Watch 方法持续监控 etcd 中的数据变化，Get 有多个控制参数:

```go

type ListOptions struct {
	// 从哪个版本开始 watch
	ResourceVersion string
	// resourceVersionMatch指定如何应用resourceVersion参数。只有当resourceVersion也被设置时，才能设置resourceVersionMatch。
    // "NotOlderThan"匹配的数据至少和所提供的resourceVersion一样新。“Exact”匹配所提供的精确resourceVersion中的数据
	ResourceVersionMatch metav1.ResourceVersionMatch
	// Predicate为 list 操作提供选择规则
    // SelectionPredicate用于表示从api存储中选择对象的方式。
	Predicate SelectionPredicate
	// 是否将 key 作为目录，递归查找 
	Recursive bool
	// ProgressNotify 决定是否应该将存储利的 Notify 事件传递给用户。对于非监视请求，该选项将被忽略。
	ProgressNotify bool
}

```

Watch 具体实现如下:

```go
func (s *store) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return nil, err
	}
    // 从哪个版本开始 watch
	rev, err := s.versioner.ParseResourceVersion(opts.ResourceVersion)
	if err != nil {
		return nil, err
	}
    // 调用我们上一节的 watcher 对象的 Watch 方法，返回实现了 watch.Interface 的 watchChan 对象
    // watchChan 在返回前已经调用了 run 方法，启动了新的 goroutine watch etcd 中的 key 变化
	return s.watcher.Watch(ctx, preparedKey, int64(rev), opts.Recursive, opts.ProgressNotify, s.transformer, opts.Predicate)
}
```

### 1.3 Create 方法

```go
func (s *store) Create(ctx context.Context, key string, obj, out runtime.Object, ttl uint64) error {
	preparedKey, err := s.prepareKey(key)
	if err != nil {
		return err
	}
	ctx, span := tracing.Start(ctx, "Create etcd3",
		attribute.String("audit-id", audit.GetAuditIDTruncated(ctx)),
		attribute.String("key", key),
		attribute.String("type", getTypeName(obj)),
		attribute.String("resource", s.groupResourceString),
	)
	defer span.End(500 * time.Millisecond)
	// 1. 设置元数据
	if version, err := s.versioner.ObjectResourceVersion(obj); err == nil && version != 0 {
		return errors.New("resourceVersion should not be set on objects to be created")
	}
	if err := s.versioner.PrepareObjectForStorage(obj); err != nil {
		return fmt.Errorf("PrepareObjectForStorage failed: %v", err)
	}
	span.AddEvent("About to Encode")
	// 2. 编码数据数据
	data, err := runtime.Encode(s.codec, obj)
	if err != nil {
		span.AddEvent("Encode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
		return err
	}
	span.AddEvent("Encode succeeded", attribute.Int("len", len(data)))

	opts, err := s.ttlOpts(ctx, int64(ttl))
	if err != nil {
		return err
	}
	// 3. 数据转换
	newData, err := s.transformer.TransformToStorage(ctx, data, authenticatedDataString(preparedKey))
	if err != nil {
		span.AddEvent("TransformToStorage failed", attribute.String("err", err.Error()))
		return storage.NewInternalError(err.Error())
	}
	span.AddEvent("TransformToStorage succeeded")

	startTime := time.Now()
	// 4. 存储到 etcd
	txnResp, err := s.client.KV.Txn(ctx).If(
		notFound(preparedKey),
	).Then(
		clientv3.OpPut(preparedKey, string(newData), opts...),
	).Commit()
	metrics.RecordEtcdRequestLatency("create", s.groupResourceString, startTime)
	if err != nil {
		span.AddEvent("Txn call failed", attribute.String("err", err.Error()))
		return err
	}
	span.AddEvent("Txn call succeeded")

	if !txnResp.Succeeded {
		return storage.NewKeyExistsError(preparedKey, 0)
	}
	// 5. 成功时，填充 out 
	if out != nil {
		putResp := txnResp.Responses[0].GetResponsePut()
		err = decode(s.codec, s.versioner, data, out, putResp.Header.Revision)
		if err != nil {
			span.AddEvent("decode failed", attribute.Int("len", len(data)), attribute.String("err", err.Error()))
			recordDecodeError(s.groupResourceString, preparedKey)
			return err
		}
		span.AddEvent("decode succeeded", attribute.Int("len", len(data)))
	}
	return nil
}
```