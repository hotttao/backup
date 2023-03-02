---
weight: 1
title: "Secret"
date: 2020-08-04T22:00:00+08:00
lastmod: 2020-08-04T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Pod 使用进阶"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. Secret 
在介绍 Volume 之前，我们需要先学习一下 kubernetes 中的 Secret API 对象。有几种特殊的 Volume 是专门针对 Secret 定义的。Secret 的作用是把 Pod 想要访问的加密数据，存放到 Etcd 中。然后就可以通过在 Pod 的容器里挂载 Volume 的方式，访问到这些 Secret 里保存的信息了。

### 1.1 Secret 定义
[Secret](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L6338)定义如下:

```go
// Secret holds secret data of a certain type. The total bytes of the values in
// the Data field must be less than MaxSecretSize bytes.
type Secret struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty" protobuf:"bytes,1,opt,name=metadata"`

	// Immutable, if set to true, ensures that data stored in the Secret cannot
	// be updated (only object metadata can be modified).
	// If not set to true, the field can be modified at any time.
	// Defaulted to nil.
	// +optional
	Immutable *bool `json:"immutable,omitempty" protobuf:"varint,5,opt,name=immutable"`

	// Data contains the secret data. Each key must consist of alphanumeric
	// characters, '-', '_' or '.'. The serialized form of the secret data is a
	// base64 encoded string, representing the arbitrary (possibly non-string)
	// data value here. Described in https://tools.ietf.org/html/rfc4648#section-4
	// +optional
	Data map[string][]byte `json:"data,omitempty" protobuf:"bytes,2,rep,name=data"`

	// stringData allows specifying non-binary secret data in string form.
	// It is provided as a write-only input field for convenience.
	// All keys and values are merged into the data field on write, overwriting any existing values.
	// The stringData field is never output when reading from the API.
	// +k8s:conversion-gen=false
	// +optional
	StringData map[string]string `json:"stringData,omitempty" protobuf:"bytes,4,rep,name=stringData"`

	// Used to facilitate programmatic handling of secret data.
	// More info: https://kubernetes.io/docs/concepts/configuration/secret/#secret-types
	// +optional
	Type SecretType `json:"type,omitempty" protobuf:"bytes,3,opt,name=type,casttype=SecretType"`
}

type SecretType string

const (
	// SecretTypeOpaque is the default. Arbitrary user-defined data
	SecretTypeOpaque SecretType = "Opaque"
	SecretTypeServiceAccountToken SecretType = "kubernetes.io/service-account-token"
	...
)
```

Secret 的字段中:
1. Immutable: 指定 Secret 实例定义是否可变
2. Data: 数据，必须是经过 Base64 转码的，以免出现明文密码的安全隐患
3. Type: 指定 Data 中数据的格式

```shell
# base64 编码
$ echo -n 'admin' | base64
YWRtaW4=
$ echo -n '1f2d1e2e67df' | base64
MWYyZDFlMmU2N2Rm
```

需要注意的是，像这样创建的 Secret 对象，它里面的内容仅仅是经过了转码，而并没有被加密。在真正的生产环境中，你需要在 Kubernetes 中开启 Secret 的加密插件，增强数据的安全性。下面是一个 Secret 创建示例:

```yaml
# 创建 Secret yaml 格式
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  user: YWRtaW4=
  pass: MWYyZDFlMmU2N2Rm
```

也可以用命令行直接创建:

```bash
$ cat ./username.txt
admin
$ cat ./password.txt
c1oudc0w!

$ kubectl create secret generic user --from-file=./username.txt
$ kubectl create secret generic pass --from-file=./password.txt

$ kubectl get secrets
NAME           TYPE                                DATA      AGE
user          Opaque                                1         51s
pass          Opaque                                1         51s
```

### 1.2 ConfigMap
ConfigMap 与 Secret 类似，但保存的是不需要加密的、应用所需的配置信息

[ConfigMap](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L6479) 定义如下:

```go
type ConfigMap struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty" protobuf:"bytes,1,opt,name=metadata"`

	// Immutable, if set to true, ensures that data stored in the ConfigMap cannot
	// be updated (only object metadata can be modified).
	// If not set to true, the field can be modified at any time.
	// Defaulted to nil.
	// +optional
	Immutable *bool `json:"immutable,omitempty" protobuf:"varint,4,opt,name=immutable"`

	// Data contains the configuration data.
	// Each key must consist of alphanumeric characters, '-', '_' or '.'.
	// Values with non-UTF-8 byte sequences must use the BinaryData field.
	// The keys stored in Data must not overlap with the keys in
	// the BinaryData field, this is enforced during validation process.
	// +optional
	Data map[string]string `json:"data,omitempty" protobuf:"bytes,2,rep,name=data"`

	// BinaryData contains the binary data.
	// Each key must consist of alphanumeric characters, '-', '_' or '.'.
	// BinaryData can contain byte sequences that are not in the UTF-8 range.
	// The keys stored in BinaryData must not overlap with the ones in
	// the Data field, this is enforced during validation process.
	// Using this field will require 1.10+ apiserver and
	// kubelet.
	// +optional
	BinaryData map[string][]byte `json:"binaryData,omitempty" protobuf:"bytes,3,rep,name=binaryData"`
}
```

ConfigMap 的字段中:
1. Data: 包含配置数据
1. BinaryData: 包含二进制数据，binaryData 中存储的键不得与 data 字段中的键重叠

#### ConfigMap 创建
ConfigMap 可以用 yaml 创建:

```yaml
# 查看这个ConfigMap里保存的信息(data)
$ kubectl get configmaps ui-config -o yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ui-config
  ...
data:
  ui.properties: |
    color.good=purple
    color.bad=yellow
    allow.textmode=true
    how.nice.to.look=fairlyNice
```

也可以通过命令行创建:

```shell
# .properties文件的内容
$ cat example/ui.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice

# 从.properties文件创建ConfigMap
$ kubectl create configmap ui-config --from-file=example/ui.properties
```

### 1.3 Service Account
Service Account
- Service Account 是 Kubernetes 系统内置的一种“服务账户”，它是 Kubernetes 进行权限分配的对象
- Service Account 的授权信息和文件，保存在它所绑定的一个特殊的 Secret 对象里的。这个特殊的 Secret 对象，叫作 ServiceAccountToken
- 任何运行在 Kubernetes 集群上的应用，都必须使用这个 ServiceAccountToken 里保存的授权信息，也就是 Token，才可以合法地访问 API Server

为了方便使用，Kubernetes 提供了一个默认“服务账户”（default Service Account）。并且，任何一个运行在 Kubernetes 里的 Pod，都可以直接使用这个默认的 Service Account，而无需显示地声明挂载 default Service Account 在容器内的路径是固定的，即：/var/run/secrets/kubernetes.io/serviceaccount。

这个实现依赖的是 Projected Volume 机制。Kubernetes 在每个 Pod 创建的时候，自动在它的 spec.volumes 部分添加上了默认 ServiceAccountToken 的定义，然后自动给每个容器加上了对应的 volumeMounts 字段。这个过程对于用户来说是完全透明的。

```shell
# kubectl describe pod nginx-deployment-bb48f7f4-4djf7

    Mounts:
      /etc/podinfo from podinfo (rw)
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-8l6js (ro)
....
Volumes:
  podinfo:
    Type:         Projected (a volume that contains injected data from multiple sources)
    DownwardAPI:  true
  kube-api-access-8l6js:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
```

只要应用程序加载 `/var/run/secrets/kubernetes.io/serviceaccount` 下这些授权文件，就可以访问并操作 Kubernetes API 了。而且，如果你使用的是 Kubernetes 官方的 Client 包（k8s.io/client-go）的话，它还可以自动加载这个目录下的文件。这种把 Kubernetes 客户端以容器的方式运行在集群里，然后使用 default Service Account 自动授权的方式，被称作“InClusterConfig”。