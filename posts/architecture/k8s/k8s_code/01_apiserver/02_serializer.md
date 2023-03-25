---
weight: 1
title: "Serializer"
date: 2023-03-02T22:00:00+08:00
lastmod: 2023-03-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver 序列化协议实现"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. API 对象的抽象
所有的 API 对象都需要在客户端、API Server 以及 etcd 之间进行传输，这就涉及到 API 对象的序列化与反序列化。我们知道接口是 go 语言实现抽象和泛型编程的核心方法。接下来我们来看看 k8s 如何把众多的 API 对象抽象为可统一处理的接口


以 Deployment 为例，Deployment 内嵌了 TypeMeta、ObjectMeta。

```go
type Deployment struct {
  metav1.TypeMeta

  metav1.ObjectMeta

  Spec DeploymentSpec

  Status DeploymentStatus
}
```

TypeMeta 和 ObjectMeta 实现了众多的接口:

|TypeMeta|ObjectMeta|
|:---|:---|
|![TypeMeta 实现接口](/images/k8s/k8s_use/type_meta_impl.png)|![ObjectMeta 实现接口](/images/k8s/k8s_use/object_type_impl.png)|
|runtime.Object|meta.Object|
|schema.ObjectKind||

#### TypeMeta 实现的接口
```go

// staging/src/k8s.io/apimachinery/pkg/runtime/interfaces.go
type Object interface {
  GetObjectKind() schema.ObjectKind
  DeepCopyObject() Object
}

// staging/src/k8s.io/apimachinery/pkg/runtime/schema/interfaces.go
type ObjectKind interface {
  SetGroupVersionKind(kind GroupVersionKind)
  GroupVersionKind() GroupVersionKind
}
```

#### ObjectMeta 实现的接口

```go
// staging/src/k8s.io/apimachinery/pkg/apis/meta/v1/meta.go
func (meta *ObjectMeta) GetNamespace() string                { return meta.Namespace }
func (meta *ObjectMeta) SetNamespace(namespace string)       { meta.Namespace = namespace }
func (meta *ObjectMeta) GetName() string                     { return meta.Name }

// staging/src/k8s.io/apimachinery/pkg/apis/meta/v1/meta.go
type Object interface {
	GetNamespace() string
	SetNamespace(namespace string)
	GetName() string
	SetName(name string)
	GetGenerateName() string
	SetGenerateName(name string)
	GetUID() types.UID
	SetUID(uid types.UID)
	GetResourceVersion() string
	SetResourceVersion(version string)
	GetGeneration() int64
    ...
}
```

所有 API 对象都内嵌了 TypeMeta、ObjectMeta，意味着所有  API 对象都实现了 meta.Object、runtime.Object 和 schema.ObjectKind。这三个接口就是 API 对象实现序列化的基础。

## 2. API 对象的序列化
kubernetes 支持的所有序列化方式定义在 kubernetes/staging/src/k8s.io/apimachinery/pkg/runtime/serializer/

```bash
$ tree -L 3 kubernetes/staging/src/k8s.io/apimachinery/pkg/runtime/serializer
kubernetes/staging/src/k8s.io/apimachinery/pkg/runtime/serializer
├── codec_factory.go
├── codec_test.go
├── encoder_with_allocator_test.go
├── json
│   ├── json.go                      # json 的序列化实现
│   ├── json_limit_test.go
│   ├── json_test.go
│   ├── meta.go
│   └── meta_test.go
├── negotiated_codec.go
├── protobuf
│   ├── doc.go
│   ├── protobuf.go                   # protobuf 的序列化实现
│   └── protobuf_test.go
├── recognizer
│   ├── recognizer.go
│   └── testing
│       └── recognizer_test.go
├── sparse_test.go
├── streaming
│   ├── streaming.go
│   └── streaming_test.go
├── versioning
│   ├── versioning.go
│   ├── versioning_test.go
│   └── versioning_unstructured_test.go
└── yaml
    ├── meta.go
    ├── meta_test.go
    ├── yaml.go                     # yaml 的序列化实现
    └── yaml_test.go

```

以 json 为例，其由 serializer.json.Serializer 结构体负责实现， 在 kubernetes/staging/src/k8s.io/apimachinery/pkg/runtime/serializer/json/json.go 中定义:

```go
type Serializer struct {
	meta    MetaFactory
	options SerializerOptions
	creater runtime.ObjectCreater
	typer   runtime.ObjectTyper

	identifier runtime.Identifier
}
```
其中:
1. MetaFactory 来负责序列化 resource 的 group， version， kind。
2. SerializerOption 负责定义是否为 yaml 格式，是否需要 pretty 美化处理，是否为 strict 严格处理
3. ObjectTyper: 序列化之后识别类型
4. ObjectCreater:创建对象

Serializer 实现了下面这些接口:

![Serializer 实现的接口](/images/k8s/k8s_use/impl_serializer.png)

![json.Serializer 定义](/images/k8s/k8s_use/serializer_json.png)
<!-- ![Serializer 实现的接口](/images/k8s/k8s_use/json_Serializer.svg) -->

### 2.1 GVK 的反序列化
MetaFactory 组件负责反序列化 resource 的 group， version， kind。可以看到:
1. SimpleMetaFactory 提供了 MetaFactory 的实现
2. SimpleMetaFactory.Interpret() 方法利用 encoding/json 开源工具的 json.Unmarshal() 方法来完成对资源的 group， version， kind 的提取。

```go
var DefaultMetaFactory = SimpleMetaFactory{}

// SimpleMetaFactory provides default methods for retrieving the type and version of objects
// that are identified with an "apiVersion" and "kind" fields in their JSON
// serialization. It may be parameterized with the names of the fields in memory, or an
// optional list of base structs to search for those fields in memory.
type SimpleMetaFactory struct {
}

// Interpret will return the APIVersion and Kind of the JSON wire-format
// encoding of an object, or an error.
func (SimpleMetaFactory) Interpret(data []byte) (*schema.GroupVersionKind, error) {
	findKind := struct {
		// +optional
		APIVersion string `json:"apiVersion,omitempty"`
		// +optional
		Kind string `json:"kind,omitempty"`
	}{}
	if err := json.Unmarshal(data, &findKind); err != nil {
		return nil, fmt.Errorf("couldn't get version/kind; json parse error: %v", err)
	}
	gv, err := schema.ParseGroupVersion(findKind.APIVersion)
	if err != nil {
		return nil, err
	}
	return &schema.GroupVersionKind{Group: gv.Group, Version: gv.Version, Kind: findKind.Kind}, nil
}
```

### 2.2 json decode
json 的反序列化有 json.Serializer 的 Decode 方法实现:

```go
func (s *Serializer) Decode(originalData []byte, gvk *schema.GroupVersionKind, into runtime.Object) (runtime.Object, *schema.GroupVersionKind, error) {
	data := originalData
	// 1. 如果是 yaml 把 yaml 转换成 json
	if s.options.Yaml {
		altered, err := yaml.YAMLToJSON(data)
		if err != nil {
			return nil, nil, err
		}
		data = altered
	}
	// 2. 调用 MetaFactory 解析数据中的 GVK
	actual, err := s.meta.Interpret(data)
	if err != nil {
		return nil, nil, err
	}

	if gvk != nil {
		// 假如 2 中没有解析成功，使用传入的 GVK 作为默认值
		*actual = gvkWithDefaults(*actual, *gvk)
	}
	// 3. 判断是否是 Unknown 类型，是，解析成 Unknown
	if unk, ok := into.(*runtime.Unknown); ok && unk != nil {
		unk.Raw = originalData
		unk.ContentType = runtime.ContentTypeJSON
		unk.GetObjectKind().SetGroupVersionKind(*actual)
		return unk, actual, nil
	}

	if into != nil {
		// 4. 判断是否是 Unstructured 类型
		_, isUnstructured := into.(runtime.Unstructured)
		// 尝试判断 Unstructured 的所有可能类型
		types, _, err := s.typer.ObjectKinds(into)
		switch {
		case runtime.IsNotRegisteredError(err), isUnstructured:
			//  unmarshal 就是反序列化的函数
			strictErrs, err := s.unmarshal(into, data, originalData)
			if err != nil {
				return nil, actual, err
			}

			// 到这里解析 Unstructured 已经成功了
			if isUnstructured {
				*actual = into.GetObjectKind().GroupVersionKind()
				if len(actual.Kind) == 0 {
					return nil, actual, runtime.NewMissingKindErr(string(originalData))
				}
				// TODO(109023): require apiVersion here as well once unstructuredJSONScheme#Decode does
			}

			if len(strictErrs) > 0 {
				return into, actual, runtime.NewStrictDecodingError(strictErrs)
			}
			return into, actual, nil
		case err != nil:
			return nil, actual, err
		default:
			// 假如操作 2 没有解析出来，提供的 gvk 参数也为空，使用 into 中解析的 gvk 作为默认值
			*actual = gvkWithDefaults(*actual, types[0])
		}
	}

	if len(actual.Kind) == 0 {
		return nil, actual, runtime.NewMissingKindErr(string(originalData))
	}
	if len(actual.Version) == 0 {
		return nil, actual, runtime.NewMissingVersionErr(string(originalData))
	}

	// 5. 检查 into 参数与 actual 得到的 gvk 是否匹配，不匹配返回一个新的 actual 对应的 object 
	obj, err := runtime.UseOrCreateObject(s.typer, s.creater, *actual, into)
	if err != nil {
		return nil, actual, err
	}
	// decode
	strictErrs, err := s.unmarshal(obj, data, originalData)
	if err != nil {
		return nil, actual, err
	} else if len(strictErrs) > 0 {
		return obj, actual, runtime.NewStrictDecodingError(strictErrs)
	}
	return obj, actual, nil
}


func UseOrCreateObject(t ObjectTyper, c ObjectCreater, gvk schema.GroupVersionKind, obj Object) (Object, error) {
	if obj != nil {
		kinds, _, err := t.ObjectKinds(obj)
		if err != nil {
			return nil, err
		}
		for _, kind := range kinds {
			if gvk == kind {
				return obj, nil
			}
		}
	}
	return c.New(gvk)
}
```

### 2.3 json encode
json 的序列化有 json.Serializer 的 Encode 方法实现:

```go
// Encode serializes the provided object to the given writer.
func (s *Serializer) Encode(obj runtime.Object, w io.Writer) error {
	if co, ok := obj.(runtime.CacheableObject); ok {
		return co.CacheEncode(s.Identifier(), s.doEncode, w)
	}
	return s.doEncode(obj, w)
}

func (s *Serializer) doEncode(obj runtime.Object, w io.Writer) error {
	if s.options.Yaml {
		json, err := json.Marshal(obj)
		if err != nil {
			return err
		}
		data, err := yaml.JSONToYAML(json)
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	}

	if s.options.Pretty {
		data, err := json.MarshalIndent(obj, "", "  ")
		if err != nil {
			return err
		}
		_, err = w.Write(data)
		return err
	}
	encoder := json.NewEncoder(w)
	return encoder.Encode(obj)
}
```