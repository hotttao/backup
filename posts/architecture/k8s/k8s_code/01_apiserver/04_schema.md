---
weight: 1
title: "Schema"
date: 2023-03-04T22:00:00+08:00
lastmod: 2023-03-04T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. schema 
### 1.1 schema 简介
kubernetes 通过 GVK 标识所有的 api 对象，这些 api 对象的定义、版本之间的转换逻辑等等，都通过 kubernetes 中一个叫 Schema 的数据结构来维护。可以说 schema 是组织 kubernetes 资源的核心:

![schema 实现](/images/k8s/k8s_use/schema.png)

从图中可以看到 Schema 实现了多个接口:
1. ObjectTyper: API 对象识别
2. ObjectDefaulter: 为 API 对象设置默认值
3. ObjectCreater: 创建 API 对象
4. ObjectConvertor: API 对象的版本转换

Schema 定义如下:

```go
type Scheme struct {
	// gvkToType allows one to figure out the go type of an object with
	// the given version and name.
	gvkToType map[schema.GroupVersionKind]reflect.Type

	// typeToGVK allows one to find metadata for a given go object.
	// The reflect.Type we index by should *not* be a pointer.
	typeToGVK map[reflect.Type][]schema.GroupVersionKind

	// unversionedTypes are transformed without conversion in ConvertToVersion.
	unversionedTypes map[reflect.Type]schema.GroupVersionKind

	// unversionedKinds are the names of kinds that can be created in the context of any group
	// or version
	// TODO: resolve the status of unversioned types.
	unversionedKinds map[string]reflect.Type

	// Map from version and resource to the corresponding func to convert
	// resource field labels in that version to internal version.
	fieldLabelConversionFuncs map[schema.GroupVersionKind]FieldLabelConversionFunc

	// defaulterFuncs is a map to funcs to be called with an object to provide defaulting
	// the provided object must be a pointer.
	defaulterFuncs map[reflect.Type]func(interface{})

	// converter stores all registered conversion functions. It also has
	// default converting behavior.
	converter *conversion.Converter

	// versionPriority is a map of groups to ordered lists of versions for those groups indicating the
	// default priorities of these versions as registered in the scheme
	versionPriority map[string][]string

	// observedVersions keeps track of the order we've seen versions during type registration
	observedVersions []schema.GroupVersion

	// schemeName is the name of this scheme.  If you don't specify a name, the stack of the NewScheme caller will be used.
	// This is useful for error reporting to indicate the origin of the scheme.
	schemeName string
}
```

## 2. API 资源注册
### 2.1 Schemabuilder
Schemabuilder 对象辅助完成资源在 schema 中的注册。Schemabuilder 定义如下:
```go
type SchemeBuilder []func(*Scheme) error

// 依赖反转的技巧，接受 schema 作为参数，避免导出导入全局的 schema
// AddToScheme applies all the stored functions to the scheme. A non-nil error
// indicates that one function failed and the attempt was abandoned.
func (sb *SchemeBuilder) AddToScheme(s *Scheme) error {
	for _, f := range *sb {
		if err := f(s); err != nil {
			return err
		}
	}
	return nil
}

// Register adds a scheme setup function to the list.
func (sb *SchemeBuilder) Register(funcs ...func(*Scheme) error) {
	for _, f := range funcs {
		*sb = append(*sb, f)
	}
}

// NewSchemeBuilder calls Register for you.
func NewSchemeBuilder(funcs ...func(*Scheme) error) SchemeBuilder {
	var sb SchemeBuilder
	sb.Register(funcs...)
	return sb
}

```

### 2.2 资源的外部本版注册
我们以 apps/v1beta1 为例子，看看 API 资源是如何注册到 schema 中的。apps/v1beta1 版本定义在 k8s.io/api/apps/v1beta1/ 目录:

```go
$ ll /home/tao/code/kubernetes/staging/src/k8s.io/api/apps/v1beta1/
总用量 300
-rw-rw-r--. 1 tao tao    745 2月  28 20:15 doc.go
-rw-rw-r--. 1 tao tao 173450 2月  28 20:15 generated.pb.go
-rw-rw-r--. 1 tao tao  24081 2月  28 20:15 generated.proto
-rw-rw-r--. 1 tao tao   1856 2月  28 20:15 register.go
-rw-rw-r--. 1 tao tao  35385 2月  28 20:15 types.go
-rw-rw-r--. 1 tao tao  23178 2月  28 20:15 types_swagger_doc_generated.go
-rw-rw-r--. 1 tao tao  18905 2月  28 20:15 zz_generated.deepcopy.go
-rw-rw-r--. 1 tao tao  13334 2月  28 20:15 zz_generated.prerelease-lifecycle.go
```

|文件|作用|
|:---|:---|
|generated.proto|API 资源定义的 pb 文件|
|types.go|API 对象的定义，types.go 应该不是 pb 文件自动生成的|
|generated.pb.go|protoc-gen-gogo 为 API 对象生成的方法|
|types_swagger_doc_generated.go|通过 hack/update-codegen.sh 生成的 swagger 文档|
|zz_generated.deepcopy.go|deepcopy-gen 工具为添加了 +k8s:deepcopy-gen: 注解的 API 对象生成的 DeepCopy 代码|
|zz_generated.prerelease-lifecycle.go|prerelease-lifecycle-gen 生成的代码|

k8s 提供了很多代码生成工具，在我们对 k8s 的整体代码有了比较深入的了解之后，再来学些这些工具的原理和使用。

#### API 资源定义的注册
API 资源的注册在 register.go 文件中:

```go
// GroupName is the group name use in this package
const GroupName = "apps"

// 3. 设置当前组的 GV
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1beta1"}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

var (
	// TODO: move SchemeBuilder with zz_generated.deepcopy.go to k8s.io/api.
	// localSchemeBuilder and AddToScheme will stay in k8s.io/kubernetes.
	SchemeBuilder      = runtime.NewSchemeBuilder(addKnownTypes)
	localSchemeBuilder = &SchemeBuilder
    // 2. 暴露 localSchemeBuilder 的 AddToScheme 方法，供外部调用
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// 1. app/apps/v1beta1 的注册函数
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&Deployment{},
		&DeploymentList{},
		&DeploymentRollback{},
		&Scale{},
		&StatefulSet{},
		&StatefulSetList{},
		&ControllerRevision{},
		&ControllerRevisionList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}
```

可以看到 API 资源定义最终会调用 scheme.AddKnownTypes 方法:

```go
func (s *Scheme) AddKnownTypes(gv schema.GroupVersion, types ...Object) {
    s.addObservedVersion(gv)
	for _, obj := range types {
		t := reflect.TypeOf(obj)
		if t.Kind() != reflect.Pointer {
			panic("All types must be pointers to structs.")
		}
		t = t.Elem()
        // 注册每一个 API 对象
		s.AddKnownTypeWithName(gv.WithKind(t.Name()), obj)
	}
}

func (s *Scheme) addObservedVersion(version schema.GroupVersion) {
	if len(version.Version) == 0 || version.Version == APIVersionInternal {
		return
	}
	for _, observedVersion := range s.observedVersions {
		if observedVersion == version {
			return
		}
	}

	s.observedVersions = append(s.observedVersions, version)
}
```

#### 资源默认值初始化函数和 label 转换函数注册
默认值和 label 转换函数的注册就不在 k8s.io/api 下了，而是在 kubernetes 自己的仓库中: pkg/apis/apps/v1beta1

```bash
$ ll /home/tao/code/kubernetes/pkg/apis/apps/v1beta1/
总用量 112
-rw-rw-r--. 1 tao tao  4396 2月  28 20:16 conversion.go
-rw-rw-r--. 1 tao tao  4884 2月  28 20:16 defaults.go
-rw-rw-r--. 1 tao tao  6976 2月  28 20:16 defaults_test.go
-rw-rw-r--. 1 tao tao   902 2月  28 20:16 doc.go
-rw-rw-r--. 1 tao tao  1540 2月  28 20:16 register.go
-rw-rw-r--. 1 tao tao 54126 2月  28 20:16 zz_generated.conversion.go
-rw-rw-r--. 1 tao tao 21250 2月  28 20:16 zz_generated.defaults.go
```
|文件|作用|
|:---|:---|
|conversion.go|API 资源转换函数|
|zz_generated.conversion.go|conversion-gen 工具从 conversion.go 生成的转换函数|
|defaults.go|API 资源默认值设置函数|
|zz_generated.defaults.go|defaulter-gen 工具从 defaults.go 生成的 default 函数|
|register.go|资源注册|

默认值和 label 转换函数的注册在 register.go 中:

```go
import (
    // 1. 导入的 k8s.io/api/apps/v1beta1/ 定义的 SchemeBuilder
	appsv1beta1 "k8s.io/api/apps/v1beta1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	localSchemeBuilder = &appsv1beta1.SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	// 2. 添加 addDefaultingFuncs 函数作为资源的初始化函数
    // 3. 添加 addConversionFuncs 这个函数作为资源的 label 转换函数。
	localSchemeBuilder.Register(addDefaultingFuncs, addConversionFuncs)
}
```

addDefaultingFuncs 定义在 /pkg/apis/apps/v1beta1/defaults.go:

```go
// 1. RegisterDefaults 是生成在 zz_generated.defaults.go 中的函数
func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return RegisterDefaults(scheme)
}
```

addConversionFuncs 定义在 /pkg/apis/apps/v1beta1/conversion.go:

```go
func addConversionFuncs(scheme *runtime.Scheme) error {
	// Add field label conversions for kinds having selectable nothing but ObjectMeta fields.
	if err := scheme.AddFieldLabelConversionFunc(SchemeGroupVersion.WithKind("StatefulSet"),
		func(label, value string) (string, string, error) {
			switch label {
			case "metadata.name", "metadata.namespace", "status.successful":
				return label, value, nil
			default:
				return "", "", fmt.Errorf("field label not supported for appsv1beta1.StatefulSet: %s", label)
			}
		}); err != nil {
		return err
	}

	return nil
}
```

#### 资源外部版本和内部版本转换函数注册
内外部版本转换注册在生成的 zz_generated.conversion.go 内:

```go
func init() {
	localSchemeBuilder.Register(RegisterConversions)
}
```
RegisterConversions 就是 conversion-gen 工具从 conversion.go 生成的转换函数的注册入口。

### 2.3 资源的内部版本注册
资源的内部版本只有资源定义的注册，位于 pkg/apis/apps/register.go 内:

```go
// kubernetes/pkg/apis/apps/register.go
var (
	// SchemeBuilder stores functions to add things to a scheme.
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
	// AddToScheme applies all stored functions t oa scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: runtime.APIVersionInternal}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	// TODO this will get cleaned up with the scheme types are fixed
	scheme.AddKnownTypes(SchemeGroupVersion,
		&DaemonSet{},
		&DaemonSetList{},
		&Deployment{},
		&DeploymentList{},
		&DeploymentRollback{},
		&autoscaling.Scale{},
		&StatefulSet{},
		&StatefulSetList{},
		&ControllerRevision{},
		&ControllerRevisionList{},
		&ReplicaSet{},
		&ReplicaSetList{},
	)
	return nil
}

// k8s.io/apimachinery/pkg/runtime/interfaces.go
const (
	// APIVersionInternal may be used if you are registering a type that should not
	// be considered stable or serialized - it is a convention only and has no
	// special behavior in this package.
	APIVersionInternal = "__internal"
)
```

### 2.4 注册的执行过程
通过上面的代码可以看到，所有的资源的注册最终都需要调用，每个 GV 模块中的 AddToScheme 方法，并传入 Schema 实例才能真正完成。AddToScheme 的调用位于 kubernetes/pkg/apis/apps/install/install.go 内。

```go
package install

import (
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/kubernetes/pkg/api/legacyscheme"
	"k8s.io/kubernetes/pkg/apis/apps"
	"k8s.io/kubernetes/pkg/apis/apps/v1"
	"k8s.io/kubernetes/pkg/apis/apps/v1beta1"
	"k8s.io/kubernetes/pkg/apis/apps/v1beta2"
)

func init() {
	Install(legacyscheme.Scheme)
}

// Install registers the API group and adds types to a scheme
func Install(scheme *runtime.Scheme) {
	utilruntime.Must(apps.AddToScheme(scheme))
	utilruntime.Must(v1beta1.AddToScheme(scheme))
	utilruntime.Must(v1beta2.AddToScheme(scheme))
	utilruntime.Must(v1.AddToScheme(scheme))
	utilruntime.Must(scheme.SetVersionPriority(v1.SchemeGroupVersion, v1beta2.SchemeGroupVersion, v1beta1.SchemeGroupVersion))
}
```

legacyscheme.Scheme 是全局变量，位于 pkg/api/legacyscheme/scheme.go 内:

```go
package legacyscheme

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

var (
	// Scheme is the default instance of runtime.Scheme to which types in the Kubernetes API are already registered.
	// NOTE: If you are copying this file to start a new api group, STOP! Copy the
	// extensions group instead. This Scheme is special and should appear ONLY in
	// the api group, unless you really know what you're doing.
	// TODO(lavalamp): make the above error impossible.
	Scheme = runtime.NewScheme()

	// Codecs provides access to encoding and decoding for the scheme
	Codecs = serializer.NewCodecFactory(Scheme)

	// ParameterCodec handles versioning of objects that are converted to query parameters.
	ParameterCodec = runtime.NewParameterCodec(Scheme)
)
```

只要程序启动的过程中导入了 install 模块，就完成了注册过程。

### 2.5 schema 注册过程总结
至此我们就可以总结一下 schema 资源的注册过程:

|package|文件|作用|
|:---|:---|:---|
|k8s.io/api|apps/v1beta1/types.go|app v1beta1 版本 API 定义|
||apps/v1beta1/register.go|app 外部版本 v1beta1 定义的注册|
|kubernetes/pkg/apis|apps/v1beta1/defaults.go|app v1beta1 版本默认值设置函数定义|
||apps/v1beta1/conversion.go|app v1beta1 版本 label 转换函数定义|
||apps/v1beta1/register.go|默认值设置、label 转换函数注册|
||apps/v1beta1/zz_generated.conversion.go|版本转换函数注册|
||apps/types.go|app 内部版本定义|
||apps/register.go|app 内部版本定义的注册|
||apps/install/install.go|AddToScheme 函数调用，完成注册|
||legacyscheme/scheme.go|定义全局 Schema|