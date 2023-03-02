---
weight: 1
title: "Pod"
date: 2020-08-03T22:00:00+08:00
lastmod: 2020-08-03T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "什么是 Pod"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

Pod 是 k8s 中最基础的 API 对象，关于 Pod 我们需要重点关注以下几点:
1. 为什么我们需要 Pod
2. 如何定义一个 Pod

## 1. 为什么我们需要 Pod
### 1.1 成组调度
如果我们把物理机与云环境做一个对比:
1. 容器的本质是进程，是未来云计算系统中的进程
2. 容器镜像就是这个系统里的“.exe”安装包
3. Kubernetes 则是未来云计算的操作系统
4. 在操作系统里进程是以进程组的方式组织在一起，Pod 就是将“进程组”的概念映射到了容器技术中

之所以需要 Pod 是因为应用往往都存在着类似于“进程和进程组”的关系，更具体地说，就是这些应用之间有着密切的协作关系，使得它们必须部署在同一台机器上。像这样容器间的紧密协作，我们可以称为“超亲密关系”。这些具有“超亲密关系”容器的典型特征包括但不限于：
1. 互相之间会发生直接的文件交换
2. 使用 localhost 或者 Socket 文件进行本地通信
3. 会发生非常频繁的远程调用
4. 需要共享某些 Linux Namespace(比如，一个容器要加入另一个容器的 Network Namespace)等等。

所以 Pod 的存在就是为了解决成组调度(gang scheduling)的问题。Pod 是 Kubernetes 里的原子调度单位。这就意味着，Kubernetes 项目的调度器，是统一按照 Pod 而非容器的资源需求进行计算的。

注:再次强调一下：容器的“单进程模型”，并不是指容器里只能运行“一个”进程，而是指容器没有管理多个进程的能力。这是因为容器里 PID=1 的进程就是应用本身，其他的进程都是这个 PID=1 进程的子进程。可是，用户编写的应用，并不能够像正常操作系统里的 init 进程或者 systemd 那样拥有进程管理的功能。

### 1.2 Pod 的实现原理
Pod 只是一个逻辑概念，本质上 Pod，其实是一组共享了某些资源的容器。具体的说：**Pod 里的所有容器，共享的是同一个 Network Namespace，并且可以声明共享同一个 Volume。**

而为了避免使用 `docker run --net=B --volumes-from=B --name=A image-A ...` 让 Pod 内的容器引入不对等关系，Pod 的实现使用了一个中间容器，这个容器叫作 Infra 容器。Infra 容器使用的是一个非常特殊的镜像，叫作：k8s.gcr.io/paus,占用极少的资源。这个镜像是一个用汇编语言编写的、永远处于“暂停”状态的容器，解压后的大小也只有 100~200 KB 左右。

在容器的启动过程中:
1. Infra 容器永远都是第一个被创建的容器，而其他用户定义的容器，则通过 Join Network Namespace 的方式，与 Infra 容器关联在一起，这样的组织关系，可以用下面这样一个示意图来表达
2. Pod 的生命周期只跟 Infra 容器一致，而与容器 A 和 B 无关。因为共享了 Network Namespace，Pod 里的容器可以直接使用 localhost 进行通信，并共享相同的网络设备

![rootfs](/images/k8s/k8s_use/infra.png)

共享 Network/Volume 意味着:
1. 对于同一个 Pod 里面的所有用户容器来说，它们的进出流量，也可以认为都是通过 Infra 容器完成的。这一点很重要，因为将来如果你要为 Kubernetes 开发一个网络插件时，应该重点考虑的是如何配置这个 Pod 的 Network Namespace，而不是每一个用户容器如何使用你的网络配置，这是没有意义的。
2. 共享 Volume 就简单多了：Kubernetes 项目只要把所有 **Volume 的定义都设计在 Pod 层级** 即可。一个 Volume 对应的宿主机目录对于 Pod 来说就只有一个，Pod 里的容器只要声明挂载这个 Volume，就一定可以共享这个 Volume 对应的宿主机目录。

### 1.3 容器设计模式
前面说了 Pod 存在的一个重要原因是成组调度，而另一个原因就是容器设计模式。容器设计模式，实际上就是希望，当用户想在一个容器里跑多个功能并不相关的应用时，应该优先考虑它们是不是更应该被描述成一个 Pod 里的多个容器。

第一个最典型的例子是：WAR 包与 Web 服务器:

```yaml

apiVersion: v1
kind: Pod
metadata:
  name: javaweb-2
spec:
  initContainers:
  - image: geektime/sample:v2
    name: war
    command: ["cp", "/sample.war", "/app"]
    volumeMounts:
    - mountPath: /app
      name: app-volume
  containers:
  - image: geektime/tomcat:7.0
    name: tomcat
    command: ["sh","-c","/root/apache-tomcat-7.0.42-v2/bin/start.sh"]
    volumeMounts:
    - mountPath: /root/apache-tomcat-7.0.42-v2/webapps
      name: app-volume
    ports:
    - containerPort: 8080
      hostPort: 8001 
  volumes:
  - name: app-volume
    emptyDir: {}
```

在 Pod 中，所有 Init Container 定义的容器，都会比 spec.containers 定义的用户容器先启动。并且，Init Container 容器会按顺序逐一启动，而直到它们都启动并且退出了，用户容器才会启动。

在上面的 Pod 中，使用的是容器设计模式里最常用的一种模式：sidecar。sidecar 指的就是我们可以在一个 Pod 中，启动一个辅助容器，来完成一些独立于主进程(主容器)之外的工作。这个例子中的 sidecar 的主要工作是使用 **共享的 Volume** 将 Jar 包从 InitContainer 拷贝到 Tomcat 容器中，从而解耦 Tomcat 与 Jar 包的发布。

但不要忘记，Pod 的另一个重要特性是，它的所有容器都共享同一个 Network Namespace。这就使得很多与 Pod 网络相关的配置和管理，也都可以交给 sidecar 完成，而完全无须干涉用户容器。这里最典型的例子莫过于 Istio 这个微服务治理项目了。

Kubernetes 社区曾经把“容器设计模式”这个理论，整理成了一篇[小论文](https://www.usenix.org/conference/hotcloud16/workshop-program/presentation/burns)

### 2.4 pod 的本质
你现在可以这么理解 Pod 的本质：Pod，实际上是在扮演传统基础设施里“虚拟机”的角色；而容器，则是这个虚拟机里运行的用户程序。当你需要把一个运行在虚拟机里的应用迁移到 Docker 容器中时，一定要仔细分析到底有哪些进程(组件)运行在这个虚拟机里。然后，你就可以把整个虚拟机想象成为一个 Pod，把这些进程分别做成容器镜像，把有顺序关系的容器，定义为 Init Container。这才是更加合理的、松耦合的容器编排诀窍，也是从传统应用架构，到“微服务架构”最自然的过渡方式。

Pod 这个概念，提供的是一种编排思想，而不是具体的技术方案。所以，如果愿意的话，你完全可以使用虚拟机来作为 Pod 的实现，然后把用户容器都运行在这个虚拟机里。比如，Mirantis 公司的virtlet 项目。甚至，你可以去实现一个带有 Init 进程的容器项目，来模拟传统应用的运行方式。这些工作，在 Kubernetes 中都是非常轻松的，也是我们后面讲解 CRI 时会提到的内容。

## 2. 如何定义一个 Pod
### 2.1 k8s 中的对象定义
定义一个 Pod 首先我们要面对的问题就是: 到底哪些属性属于 Pod 对象，而又有哪些属性属于 Container 呢？。一个原则是:
1. Pod 对标的是虚拟机所以在 Pod 的配置中，所以凡是调度、网络、存储，以及安全相关的属性，基本上是 Pod 级别的。这些属性的共同特征是，它们描述的是“机器”这个整体，而不是里面运行的“程序”
2. 其他的与进程相关的配置则属于 Container。

k8s api 对象的定义存放在源码目录下的 ./staging/src/k8s.io/api 内
```go
// kubernetes go.mod
require (
	
	k8s.io/api v0.0.0
)

replace (
	k8s.io/api => ./staging/src/k8s.io/api
)
```

在 k8s.io/api/core/v1/ 内:
1. generated.proto 是所有 API 对象的 pb 定义文件
2. type.go 则是由 generated.proto 生成的 go struct 定义。

```sh
[tao@master kubernetes]$ cd staging/src/k8s.io/api/core/v1/
[tao@master v1]$ ll
总用量 2796
-rw-rw-r--. 1 tao tao    8345 2月  28 20:32 annotation_key_constants.go
-rw-rw-r--. 1 tao tao     746 2月  28 20:32 doc.go
-rw-rw-r--. 1 tao tao 1755761 2月  28 20:32 generated.pb.go
-rw-rw-r--. 1 tao tao  259908 2月  28 20:32 generated.proto
-rw-rw-r--. 1 tao tao    1514 2月  28 20:32 lifecycle.go
-rw-rw-r--. 1 tao tao    1194 2月  28 20:32 objectreference.go
-rw-rw-r--. 1 tao tao    2713 2月  28 20:32 register.go
-rw-rw-r--. 1 tao tao    1857 2月  28 20:32 resource.go
-rw-rw-r--. 1 tao tao    1323 2月  28 20:32 taint.go
-rw-rw-r--. 1 tao tao    3002 2月  28 20:32 taint_test.go
-rw-rw-r--. 1 tao tao    2086 2月  28 20:32 toleration.go
-rw-rw-r--. 1 tao tao    3465 2月  28 20:32 toleration_test.go
-rw-rw-r--. 1 tao tao  362124 2月  28 20:32 types.go
-rw-rw-r--. 1 tao tao  238544 2月  28 20:32 types_swagger_doc_generated.go
-rw-rw-r--. 1 tao tao    2188 2月  28 20:32 types_test.go
-rw-rw-r--. 1 tao tao    3625 2月  28 20:32 well_known_labels.go
-rw-rw-r--. 1 tao tao    2076 2月  28 20:32 well_known_taints.go
-rw-rw-r--. 1 tao tao  175985 2月  28 20:32 zz_generated.deepcopy.go

```

### 2.2 Pod 定义
[Pod 的定义](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L4177)如下:

```go
type Pod struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty" protobuf:"bytes,1,opt,name=metadata"`

	// Specification of the desired behavior of the pod.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
	// +optional
	Spec PodSpec `json:"spec,omitempty" protobuf:"bytes,2,opt,name=spec"`

	// Most recently observed status of the pod.
	// This data may not be up to date.
	// Populated by the system.
	// Read-only.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
	// +optional
	Status PodStatus `json:"status,omitempty" protobuf:"bytes,3,opt,name=status"`
}
```

其中:
1. TypeMeta: 定义了 API 对象的类型以及其发布的版本
2. ObjectMeta: 定义了对象的元数据，这个是用户必须定义的
3. PodSpec: 定义 Pod 包含哪些字段
4. PodStatus: Pod 当前状态字段，由系统定义

TypeMeta、ObjectMeta 是通用字段，所有的 API 对象都有这两个属性。

##### TypeMeta
TypeMeta 只包含了，两个属性
1. name: API 对象名称
2. apiVersion: API 对象版本
```go
message TypeMeta { 
  // Kind is a string value representing the REST resource this object represents.
  // Servers may infer this from the endpoint the client submits requests to.
  // Cannot be updated.
  // In CamelCase.
  // More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
  // +optional
  optional string kind = 1;

  // APIVersion defines the versioned schema of this representation of an object.
  // Servers should convert recognized schemas to the latest internal value, and
  // may reject unrecognized values.
  // More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
  // +optional
  optional string apiVersion = 2;
}
```

#### ObjectMeta
ObjectMeta 的定义[github](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apimachinery/pkg/apis/meta/v1/types.go#L111)，比较重要的是以下几个:

```go
type ObjectMeta struct {
	Name string `json:"name,omitempty" protobuf:"bytes,1,opt,name=name"`
	GenerateName string `json:"generateName,omitempty" protobuf:"bytes,2,opt,name=generateName"`
	Namespace string `json:"namespace,omitempty" protobuf:"bytes,3,opt,name=namespace"`

	// Deprecated: selfLink is a legacy read-only field that is no longer populated by the system.
	// +optional
	SelfLink string `json:"selfLink,omitempty" protobuf:"bytes,4,opt,name=selfLink"`

	// UID is the unique in time and space value for this object. It is typically generated by
	// the server on successful creation of a resource and is not allowed to change on PUT
	// operations.
	UID types.UID `json:"uid,omitempty" protobuf:"bytes,5,opt,name=uid,casttype=k8s.io/kubernetes/pkg/types.UID"`

	// An opaque value that represents the internal version of this object that can
	// be used by clients to determine when objects have changed. May be used for optimistic
	// concurrency, change detection, and the watch operation on a resource or set of resources.
	// Clients must treat these values as opaque and passed unmodified back to the server.
	// They may only be valid for a particular resource or set of resources.
	//
	// Populated by the system.
	// Read-only.
	// Value must be treated as opaque by clients and .
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
	// +optional
	ResourceVersion string `json:"resourceVersion,omitempty" protobuf:"bytes,6,opt,name=resourceVersion"`

	// A sequence number representing a specific generation of the desired state.
	// Populated by the system. Read-only.
	// +optional
	Generation int64 `json:"generation,omitempty" protobuf:"varint,7,opt,name=generation"`

	// CreationTimestamp is a timestamp representing the server time when this object was
	// created. It is not guaranteed to be set in happens-before order across separate operations.
	// Clients may not set this value. It is represented in RFC3339 form and is in UTC.
	//
	// Populated by the system.
	// Read-only.
	// Null for lists.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	CreationTimestamp Time `json:"creationTimestamp,omitempty" protobuf:"bytes,8,opt,name=creationTimestamp"`

	// DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This
	// field is set by the server when a graceful deletion is requested by the user, and is not
	// directly settable by a client. The resource is expected to be deleted (no longer visible
	// from resource lists, and not reachable by name) after the time in this field, once the
	// finalizers list is empty. As long as the finalizers list contains items, deletion is blocked.
	// Once the deletionTimestamp is set, this value may not be unset or be set further into the
	// future, although it may be shortened or the resource may be deleted prior to this time.
	// For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react
	// by sending a graceful termination signal to the containers in the pod. After that 30 seconds,
	// the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup,
	// remove the pod from the API. In the presence of network partitions, this object may still
	// exist after this timestamp, until an administrator or automated process can determine the
	// resource is fully terminated.
	// If not set, graceful deletion of the object has not been requested.
	//
	// Populated by the system when a graceful deletion is requested.
	// Read-only.
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	DeletionTimestamp *Time `json:"deletionTimestamp,omitempty" protobuf:"bytes,9,opt,name=deletionTimestamp"`

	// Number of seconds allowed for this object to gracefully terminate before
	// it will be removed from the system. Only set when deletionTimestamp is also set.
	// May only be shortened.
	// Read-only.
	// +optional
	DeletionGracePeriodSeconds *int64 `json:"deletionGracePeriodSeconds,omitempty" protobuf:"varint,10,opt,name=deletionGracePeriodSeconds"`

	// Map of string keys and values that can be used to organize and categorize
	// (scope and select) objects. May match selectors of replication controllers
	// and services.
	// More info: http://kubernetes.io/docs/user-guide/labels
	// +optional
	Labels map[string]string `json:"labels,omitempty" protobuf:"bytes,11,rep,name=labels"`

	// Annotations is an unstructured key value map stored with a resource that may be
	// set by external tools to store and retrieve arbitrary metadata. They are not
	// queryable and should be preserved when modifying objects.
	// More info: http://kubernetes.io/docs/user-guide/annotations
	// +optional
	Annotations map[string]string `json:"annotations,omitempty" protobuf:"bytes,12,rep,name=annotations"`

	// List of objects depended by this object. If ALL objects in the list have
	// been deleted, this object will be garbage collected. If this object is managed by a controller,
	// then an entry in this list will point to this controller, with the controller field set to true.
	// There cannot be more than one managing controller.
	// +optional
	// +patchMergeKey=uid
	// +patchStrategy=merge
	OwnerReferences []OwnerReference `json:"ownerReferences,omitempty" patchStrategy:"merge" patchMergeKey:"uid" protobuf:"bytes,13,rep,name=ownerReferences"`

	// Must be empty before the object is deleted from the registry. Each entry
	// is an identifier for the responsible component that will remove the entry
	// from the list. If the deletionTimestamp of the object is non-nil, entries
	// in this list can only be removed.
	// Finalizers may be processed and removed in any order.  Order is NOT enforced
	// because it introduces significant risk of stuck finalizers.
	// finalizers is a shared field, any actor with permission can reorder it.
	// If the finalizer list is processed in order, then this can lead to a situation
	// in which the component responsible for the first finalizer in the list is
	// waiting for a signal (field value, external system, or other) produced by a
	// component responsible for a finalizer later in the list, resulting in a deadlock.
	// Without enforced ordering finalizers are free to order amongst themselves and
	// are not vulnerable to ordering changes in the list.
	// +optional
	// +patchStrategy=merge
	Finalizers []string `json:"finalizers,omitempty" patchStrategy:"merge" protobuf:"bytes,14,rep,name=finalizers"`

	// Tombstone: ClusterName was a legacy field that was always cleared by
	// the system and never used.
	// ClusterName string `json:"clusterName,omitempty" protobuf:"bytes,15,opt,name=clusterName"`

	// ManagedFields maps workflow-id and version to the set of fields
	// that are managed by that workflow. This is mostly for internal
	// housekeeping, and users typically shouldn't need to set or
	// understand this field. A workflow can be the user's name, a
	// controller's name, or the name of a specific apply path like
	// "ci-cd". The set of fields is always in the version that the
	// workflow used when modifying the object.
	//
	// +optional
	ManagedFields []ManagedFieldsEntry `json:"managedFields,omitempty" protobuf:"bytes,17,rep,name=managedFields"`
}
```
1. Name: API 对象的实例名称
2. Namespace: 实例存放的 namespace
3. Labels: 实例的标签，通过 label Selector 可以实现对实例的筛选
4. Annotations: 携带 key-value 格式的内部信息

#### PodSpec
[PodSpec](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L3181) 是为 Pod 定义的结构体

```go
type PodSpec struct {
	Volumes []Volume `json:"volumes,omitempty" patchStrategy:"merge,retainKeys" patchMergeKey:"name" protobuf:"bytes,1,rep,name=volumes"`
	InitContainers []Container `json:"initContainers,omitempty" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,20,rep,name=initContainers"`
	Containers []Container `json:"containers" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,2,rep,name=containers"`
	// List of ephemeral containers run in this pod. Ephemeral containers may be run in an existing
	// pod to perform user-initiated actions such as debugging. This list cannot be specified when
	// creating a pod, and it cannot be modified by updating the pod spec. In order to add an
	// ephemeral container to an existing pod, use the pod's ephemeralcontainers subresource.
	// +optional
	// +patchMergeKey=name
	// +patchStrategy=merge
	EphemeralContainers []EphemeralContainer `json:"ephemeralContainers,omitempty" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,34,rep,name=ephemeralContainers"`
	
	// 重启策略
	RestartPolicy RestartPolicy `json:"restartPolicy,omitempty" protobuf:"bytes,3,opt,name=restartPolicy,casttype=RestartPolicy"`
	// Optional duration in seconds the pod needs to terminate gracefully. May be decreased in delete request.
	// Value must be non-negative integer. The value zero indicates stop immediately via
	// the kill signal (no opportunity to shut down).
	// If this value is nil, the default grace period will be used instead.
	// The grace period is the duration in seconds after the processes running in the pod are sent
	// a termination signal and the time when the processes are forcibly halted with a kill signal.
	// Set this value longer than the expected cleanup time for your process.
	// Defaults to 30 seconds.
	// +optional
	TerminationGracePeriodSeconds *int64 `json:"terminationGracePeriodSeconds,omitempty" protobuf:"varint,4,opt,name=terminationGracePeriodSeconds"`
	// Optional duration in seconds the pod may be active on the node relative to
	// StartTime before the system will actively try to mark it failed and kill associated containers.
	// Value must be a positive integer.
	// +optional
	ActiveDeadlineSeconds *int64 `json:"activeDeadlineSeconds,omitempty" protobuf:"varint,5,opt,name=activeDeadlineSeconds"`
	// Set DNS policy for the pod.
	// Defaults to "ClusterFirst".
	// Valid values are 'ClusterFirstWithHostNet', 'ClusterFirst', 'Default' or 'None'.
	// DNS parameters given in DNSConfig will be merged with the policy selected with DNSPolicy.
	// To have DNS options set along with hostNetwork, you have to specify DNS policy
	// explicitly to 'ClusterFirstWithHostNet'.
	// +optional
	DNSPolicy DNSPolicy `json:"dnsPolicy,omitempty" protobuf:"bytes,6,opt,name=dnsPolicy,casttype=DNSPolicy"`
	// NodeSelector is a selector which must be true for the pod to fit on a node.
	// Selector which must match a node's labels for the pod to be scheduled on that node.
	// More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
	// +optional
	// +mapType=atomic
	NodeSelector map[string]string `json:"nodeSelector,omitempty" protobuf:"bytes,7,rep,name=nodeSelector"`

	// ServiceAccountName is the name of the ServiceAccount to use to run this pod.
	// More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
	// +optional
	ServiceAccountName string `json:"serviceAccountName,omitempty" protobuf:"bytes,8,opt,name=serviceAccountName"`
	// DeprecatedServiceAccount is a depreciated alias for ServiceAccountName.
	// Deprecated: Use serviceAccountName instead.
	// +k8s:conversion-gen=false
	// +optional
	DeprecatedServiceAccount string `json:"serviceAccount,omitempty" protobuf:"bytes,9,opt,name=serviceAccount"`
	// AutomountServiceAccountToken indicates whether a service account token should be automatically mounted.
	// +optional
	AutomountServiceAccountToken *bool `json:"automountServiceAccountToken,omitempty" protobuf:"varint,21,opt,name=automountServiceAccountToken"`

	// NodeName is a request to schedule this pod onto a specific node. If it is non-empty,
	// the scheduler simply schedules this pod onto that node, assuming that it fits resource
	// requirements.
	// +optional
	NodeName string `json:"nodeName,omitempty" protobuf:"bytes,10,opt,name=nodeName"`
	// Host networking requested for this pod. Use the host's network namespace.
	// If this option is set, the ports that will be used must be specified.
	// Default to false.
	// +k8s:conversion-gen=false
	// +optional
	HostNetwork bool `json:"hostNetwork,omitempty" protobuf:"varint,11,opt,name=hostNetwork"`
	// Use the host's pid namespace.
	// Optional: Default to false.
	// +k8s:conversion-gen=false
	// +optional
	HostPID bool `json:"hostPID,omitempty" protobuf:"varint,12,opt,name=hostPID"`
	// Use the host's ipc namespace.
	// Optional: Default to false.
	// +k8s:conversion-gen=false
	// +optional
	HostIPC bool `json:"hostIPC,omitempty" protobuf:"varint,13,opt,name=hostIPC"`
	// Share a single process namespace between all of the containers in a pod.
	// When this is set containers will be able to view and signal processes from other containers
	// in the same pod, and the first process in each container will not be assigned PID 1.
	// HostPID and ShareProcessNamespace cannot both be set.
	// Optional: Default to false.
	// +k8s:conversion-gen=false
	// +optional
	ShareProcessNamespace *bool `json:"shareProcessNamespace,omitempty" protobuf:"varint,27,opt,name=shareProcessNamespace"`
	// SecurityContext holds pod-level security attributes and common container settings.
	// Optional: Defaults to empty.  See type description for default values of each field.
	// +optional
	SecurityContext *PodSecurityContext `json:"securityContext,omitempty" protobuf:"bytes,14,opt,name=securityContext"`
	// ImagePullSecrets is an optional list of references to secrets in the same namespace to use for pulling any of the images used by this PodSpec.
	// If specified, these secrets will be passed to individual puller implementations for them to use.
	// More info: https://kubernetes.io/docs/concepts/containers/images#specifying-imagepullsecrets-on-a-pod
	// +optional
	// +patchMergeKey=name
	// +patchStrategy=merge
	ImagePullSecrets []LocalObjectReference `json:"imagePullSecrets,omitempty" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,15,rep,name=imagePullSecrets"`
	// Specifies the hostname of the Pod
	// If not specified, the pod's hostname will be set to a system-defined value.
	// +optional
	Hostname string `json:"hostname,omitempty" protobuf:"bytes,16,opt,name=hostname"`
	// If specified, the fully qualified Pod hostname will be "<hostname>.<subdomain>.<pod namespace>.svc.<cluster domain>".
	// If not specified, the pod will not have a domainname at all.
	// +optional
	Subdomain string `json:"subdomain,omitempty" protobuf:"bytes,17,opt,name=subdomain"`
	// If specified, the pod's scheduling constraints
	// +optional
	Affinity *Affinity `json:"affinity,omitempty" protobuf:"bytes,18,opt,name=affinity"`
	// If specified, the pod will be dispatched by specified scheduler.
	// If not specified, the pod will be dispatched by default scheduler.
	// +optional
	SchedulerName string `json:"schedulerName,omitempty" protobuf:"bytes,19,opt,name=schedulerName"`
	// If specified, the pod's tolerations.
	// +optional
	Tolerations []Toleration `json:"tolerations,omitempty" protobuf:"bytes,22,opt,name=tolerations"`
	// HostAliases is an optional list of hosts and IPs that will be injected into the pod's hosts
	// file if specified. This is only valid for non-hostNetwork pods.
	// +optional
	// +patchMergeKey=ip
	// +patchStrategy=merge
	HostAliases []HostAlias `json:"hostAliases,omitempty" patchStrategy:"merge" patchMergeKey:"ip" protobuf:"bytes,23,rep,name=hostAliases"`
	// If specified, indicates the pod's priority. "system-node-critical" and
	// "system-cluster-critical" are two special keywords which indicate the
	// highest priorities with the former being the highest priority. Any other
	// name must be defined by creating a PriorityClass object with that name.
	// If not specified, the pod priority will be default or zero if there is no
	// default.
	// +optional
	PriorityClassName string `json:"priorityClassName,omitempty" protobuf:"bytes,24,opt,name=priorityClassName"`
	// The priority value. Various system components use this field to find the
	// priority of the pod. When Priority Admission Controller is enabled, it
	// prevents users from setting this field. The admission controller populates
	// this field from PriorityClassName.
	// The higher the value, the higher the priority.
	// +optional
	Priority *int32 `json:"priority,omitempty" protobuf:"bytes,25,opt,name=priority"`
	// Specifies the DNS parameters of a pod.
	// Parameters specified here will be merged to the generated DNS
	// configuration based on DNSPolicy.
	// +optional
	DNSConfig *PodDNSConfig `json:"dnsConfig,omitempty" protobuf:"bytes,26,opt,name=dnsConfig"`
	// If specified, all readiness gates will be evaluated for pod readiness.
	// A pod is ready when all its containers are ready AND
	// all conditions specified in the readiness gates have status equal to "True"
	// More info: https://git.k8s.io/enhancements/keps/sig-network/580-pod-readiness-gates
	// +optional
	ReadinessGates []PodReadinessGate `json:"readinessGates,omitempty" protobuf:"bytes,28,opt,name=readinessGates"`
	// RuntimeClassName refers to a RuntimeClass object in the node.k8s.io group, which should be used
	// to run this pod.  If no RuntimeClass resource matches the named class, the pod will not be run.
	// If unset or empty, the "legacy" RuntimeClass will be used, which is an implicit class with an
	// empty definition that uses the default runtime handler.
	// More info: https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
	// +optional
	RuntimeClassName *string `json:"runtimeClassName,omitempty" protobuf:"bytes,29,opt,name=runtimeClassName"`
	// EnableServiceLinks indicates whether information about services should be injected into pod's
	// environment variables, matching the syntax of Docker links.
	// Optional: Defaults to true.
	// +optional
	EnableServiceLinks *bool `json:"enableServiceLinks,omitempty" protobuf:"varint,30,opt,name=enableServiceLinks"`
	// PreemptionPolicy is the Policy for preempting pods with lower priority.
	// One of Never, PreemptLowerPriority.
	// Defaults to PreemptLowerPriority if unset.
	// +optional
	PreemptionPolicy *PreemptionPolicy `json:"preemptionPolicy,omitempty" protobuf:"bytes,31,opt,name=preemptionPolicy"`
	// Overhead represents the resource overhead associated with running a pod for a given RuntimeClass.
	// This field will be autopopulated at admission time by the RuntimeClass admission controller. If
	// the RuntimeClass admission controller is enabled, overhead must not be set in Pod create requests.
	// The RuntimeClass admission controller will reject Pod create requests which have the overhead already
	// set. If RuntimeClass is configured and selected in the PodSpec, Overhead will be set to the value
	// defined in the corresponding RuntimeClass, otherwise it will remain unset and treated as zero.
	// More info: https://git.k8s.io/enhancements/keps/sig-node/688-pod-overhead/README.md
	// +optional
	Overhead ResourceList `json:"overhead,omitempty" protobuf:"bytes,32,opt,name=overhead"`
	// TopologySpreadConstraints describes how a group of pods ought to spread across topology
	// domains. Scheduler will schedule pods in a way which abides by the constraints.
	// All topologySpreadConstraints are ANDed.
	// +optional
	// +patchMergeKey=topologyKey
	// +patchStrategy=merge
	// +listType=map
	// +listMapKey=topologyKey
	// +listMapKey=whenUnsatisfiable
	TopologySpreadConstraints []TopologySpreadConstraint `json:"topologySpreadConstraints,omitempty" patchStrategy:"merge" patchMergeKey:"topologyKey" protobuf:"bytes,33,opt,name=topologySpreadConstraints"`
	// If true the pod's hostname will be configured as the pod's FQDN, rather than the leaf name (the default).
	// In Linux containers, this means setting the FQDN in the hostname field of the kernel (the nodename field of struct utsname).
	// In Windows containers, this means setting the registry value of hostname for the registry key HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters to FQDN.
	// If a pod does not have FQDN, this has no effect.
	// Default to false.
	// +optional
	SetHostnameAsFQDN *bool `json:"setHostnameAsFQDN,omitempty" protobuf:"varint,35,opt,name=setHostnameAsFQDN"`
	// Specifies the OS of the containers in the pod.
	// Some pod and container fields are restricted if this is set.
	//
	// If the OS field is set to linux, the following fields must be unset:
	// -securityContext.windowsOptions
	//
	// If the OS field is set to windows, following fields must be unset:
	// - spec.hostPID
	// - spec.hostIPC
	// - spec.hostUsers
	// - spec.securityContext.seLinuxOptions
	// - spec.securityContext.seccompProfile
	// - spec.securityContext.fsGroup
	// - spec.securityContext.fsGroupChangePolicy
	// - spec.securityContext.sysctls
	// - spec.shareProcessNamespace
	// - spec.securityContext.runAsUser
	// - spec.securityContext.runAsGroup
	// - spec.securityContext.supplementalGroups
	// - spec.containers[*].securityContext.seLinuxOptions
	// - spec.containers[*].securityContext.seccompProfile
	// - spec.containers[*].securityContext.capabilities
	// - spec.containers[*].securityContext.readOnlyRootFilesystem
	// - spec.containers[*].securityContext.privileged
	// - spec.containers[*].securityContext.allowPrivilegeEscalation
	// - spec.containers[*].securityContext.procMount
	// - spec.containers[*].securityContext.runAsUser
	// - spec.containers[*].securityContext.runAsGroup
	// +optional
	OS *PodOS `json:"os,omitempty" protobuf:"bytes,36,opt,name=os"`

	// Use the host's user namespace.
	// Optional: Default to true.
	// If set to true or not present, the pod will be run in the host user namespace, useful
	// for when the pod needs a feature only available to the host user namespace, such as
	// loading a kernel module with CAP_SYS_MODULE.
	// When set to false, a new userns is created for the pod. Setting false is useful for
	// mitigating container breakout vulnerabilities even allowing users to run their
	// containers as root without actually having root privileges on the host.
	// This field is alpha-level and is only honored by servers that enable the UserNamespacesSupport feature.
	// +k8s:conversion-gen=false
	// +optional
	HostUsers *bool `json:"hostUsers,omitempty" protobuf:"bytes,37,opt,name=hostUsers"`

	// SchedulingGates is an opaque list of values that if specified will block scheduling the pod.
	// If schedulingGates is not empty, the pod will stay in the SchedulingGated state and the
	// scheduler will not attempt to schedule the pod.
	//
	// SchedulingGates can only be set at pod creation time, and be removed only afterwards.
	//
	// This is a beta feature enabled by the PodSchedulingReadiness feature gate.
	//
	// +patchMergeKey=name
	// +patchStrategy=merge
	// +listType=map
	// +listMapKey=name
	// +featureGate=PodSchedulingReadiness
	// +optional
	SchedulingGates []PodSchedulingGate `json:"schedulingGates,omitempty" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,38,opt,name=schedulingGates"`

	ResourceClaims []PodResourceClaim `json:"resourceClaims,omitempty" patchStrategy:"merge,retainKeys" patchMergeKey:"name" protobuf:"bytes,39,rep,name=resourceClaims"`
}
```

[PodSpec的字段](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/workload-resources/pod-v1/#containers) 包括:

|分类|字段|作用|
|:---|:---|:---|
|容器定义|Container ([]Container)||
||InitContainers ([]Container)| Init Containers 的生命周期，会先于所有的 Containers，并且严格按照定义的顺序执行|
||EphemeralContainers ([]EphemeralContainer)||
||ImagePullSecrets ([]LocalObjectReference)||
||EnableServiceLinks (boolean)||
||Os (PodOS)||
||Volumes ([]Volume)||
|调度|NodeSelector (map[string]string)||
||NodeName (string)||
||Affinity (Affinity)||
||Tolerations ([]Toleration)||
||SchedulerName (string)||
||RuntimeClassName (string)||
||PriorityClassName (string)||
||Priority (int32)||
||PreemptionPolicy (string)||
||TopologySpreadConstraints ([]TopologySpreadConstraint)||
|生命周期|restartPolicy (string)||
||TerminationGracePeriodSeconds (int64)|Pod 优雅退出的时间，|
||ActiveDeadlineSeconds (int64)|在系统将主动尝试将此 Pod 标记为已失败并杀死相关容器之前，Pod 可能在节点上活跃的时长|
||ReadinessGate ([]PodReadinessGate)||
|主机名|Hostname (string)|指定 Pod 的主机名|
||SetHostnameAsFQDN (boolean)||
||Subdomain (string)|如果设置了此字段，则完全限定的 Pod 主机名将是 `<hostname>.<subdomain>.<Pod 名字空间>.svc.<集群域名>`。 如果未设置此字段，则该 Pod 将没有域名。|
||HostAliases ([]HostAlias)||
|DNS|DnsConfig (PodDNSConfig)|指定 Pod 的 DNS 参数|
||DnsPolicy (string)|为 Pod 设置 DNS 策略|
|Namespace|HostNetwork (boolean)|为此 Pod 请求主机层面联网支持。使用主机的 host namespace|
||HostPID (boolean)|使用主机的 PID 名字空间|
||HostIPC (boolean)|使用主机的 IPC 名字空间|
||HostUsers (boolean)|使用主机的用户名字空间|
||ShareProcessNamespace (boolean)|Pod 里的容器要共享 PID Namespace|
|认证|ServiceAccountName (string)||
||AutomountServiceAccountToken (boolean)||
|安全控制|securityContext (PodSecurityContext)| Pod 级别的安全属性和常见的容器设置|

## 3. Pod 重要字段 
### 2.1 调度相关
与调度有关的字段包括:

1. NodeName：
  - 一旦 Pod 的这个字段被赋值，Kubernetes 项目就会被认为这个 Pod 已经经过了调度，调度的结果就是赋值的节点名字
  - 所以，这个字段一般由调度器负责设置，但用户也可以设置它来“骗过”调度器，当然这个做法一般是在测试或者调试的时候才会用到
2. NodeSelector：通过 label 选择特定范围的 Node 

```yaml
apiVersion: v1
kind: Pod
...
spec:
 nodeSelector:
   disktype: ssd
```
这样的一个配置，意味着这个 Pod 永远只能运行在携带了“disktype: ssd”标签(Label)的节点上；否则，它将调度失败。

### 2.2 网络配置
与网络配置有关的字段包括:
1. HostAliases：定义了 Pod 的 hosts 文件(比如 /etc/hosts)里的内容

```yaml
apiVersion: v1
kind: Pod
...
spec:
  hostAliases:
  - ip: "10.1.2.3"
    hostnames:
    - "foo.remote"
    - "bar.remote"
...
```

上面配置的 Pod 启动后，/etc/hosts 文件的内容将如下所示：

```
cat /etc/hosts
# Kubernetes-managed hosts file.
127.0.0.1 localhost
...
10.244.135.10 hostaliases-pod
# 通过 HostAliases 字段为 Pod 设置的
10.1.2.3 foo.remote
10.1.2.3 bar.remote
```

### 2.3 Linux Namespace 相关
与 Namespace 配置有关的字段包括:
1. `shareProcessNamespace: true`: Pod 里的容器要共享 PID Namespace
2. `hostNetwork: true`: 共享宿主机的 Network Namespace
3. `hostIPC: true`: 共享宿主机的 IPC Namespace
4. `hostPID: true`: 共享宿主机的 PID Namespace

```yaml

apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  shareProcessNamespace: true
  containers:
  - name: nginx
    image: nginx
  - name: shell
    image: busybox
    stdin: true
    tty: true
# 可以直接认为 tty 就是 Linux 给用户提供的一个常驻小程序，用于接收用户的标准输入，返回操作系统的标准输出。
# 为了能够在 tty 中输入信息，你还需要同时开启 stdin(标准输入流)

# 连接到 shell 容器的 tty 上
# kubectl attach -it nginx -c shell


apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  hostNetwork: true
  hostIPC: true
  hostPID: true
  containers:
  ...
```

### 2. Pod 恢复机制
RestartPolicy 定义了 Pod 的恢复机制，默认值是 Always，即：任何时候这个容器发生了异常，它一定会被重新创建。

需要强调的是，Pod 的恢复过程，永远都是发生在当前节点上，而不会跑到别的节点上去。事实上，一旦一个 Pod 与一个节点（Node）绑定，除非这个绑定发生了变化（pod.spec.node 字段被修改），否则它永远都不会离开这个节点。这也就意味着，如果这个宿主机宕机了，这个 Pod 也不会主动迁移到其他节点上去。而如果你想让 Pod 出现在其他的可用节点上，就必须使用 Deployment 这样的“控制器”来管理 Pod。

restartPolicy 的可选值包括：
1. Always：在任何情况下，只要容器不在运行状态，就自动重启容器；
2. OnFailure: 只在容器 异常时才自动重启容器；
3. Never: 从来不重启容器。

在实际使用时，我们需要根据应用运行的特性，合理设置这三种恢复策略。如果 Pod 执行的是一个一次性的 job 任务，就不要设置成 Always 了。如果你要关心这个容器退出后的上下文环境，比如容器退出后的日志、文件和目录，就需要将 restartPolicy 设置为 Never。因为一旦容器被自动重新创建，这些内容就有可能丢失掉了（被垃圾回收了）。

#### restartPolicy 与容器状态的关系
Kubernetes 的官方文档，把 restartPolicy 和 Pod 里容器的状态，以及 Pod 状态的对应关系，[总结了非常复杂的一大堆情况](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#example-states)。但总体的设计原则是:
1. 只要 Pod 的 restartPolicy 指定的策略允许重启异常的容器（比如：Always），那么这个 Pod 就会保持 Running 状态，并进行容器重启。否则，Pod 就会进入 Failed 状态 。
2. 对于包含多个容器的 Pod，只有它里面所有的容器都进入异常状态后，Pod 才会进入 Failed 状态。在此之前，Pod 都是 Running 状态。此时，Pod 的 READY 字段会显示正常容器的个数

所以，假如一个 Pod 里只有一个容器，然后这个容器异常退出了。那么，只有当 restartPolicy=Never 时，这个 Pod 才会进入 Failed 状态。而其他情况下，由于 Kubernetes 都可以重启这个容器，所以 Pod 的状态保持 Running 不变。

而如果这个 Pod 有多个容器，仅有一个容器异常退出，它就始终保持 Running 状态，哪怕即使 restartPolicy=Never。只有当所有容器也异常退出之后，这个 Pod 才会进入 Failed 状态。

## 3. Container 定义
[Container](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L2372) 的结构体定义如下:

```go
type Container struct {
	// Name of the container specified as a DNS_LABEL.
	// Each container in a pod must have a unique name (DNS_LABEL).
	// Cannot be updated.
	Name string `json:"name" protobuf:"bytes,1,opt,name=name"`
	// Container image name.
	// More info: https://kubernetes.io/docs/concepts/containers/images
	// This field is optional to allow higher level config management to default or override
	// container images in workload controllers like Deployments and StatefulSets.
	// +optional
	Image string `json:"image,omitempty" protobuf:"bytes,2,opt,name=image"`
	// Entrypoint array. Not executed within a shell.
	// The container image's ENTRYPOINT is used if this is not provided.
	// Variable references $(VAR_NAME) are expanded using the container's environment. If a variable
	// cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced
	// to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will
	// produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless
	// of whether the variable exists or not. Cannot be updated.
	// More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
	// +optional
	Command []string `json:"command,omitempty" protobuf:"bytes,3,rep,name=command"`
	// Arguments to the entrypoint.
	// The container image's CMD is used if this is not provided.
	// Variable references $(VAR_NAME) are expanded using the container's environment. If a variable
	// cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced
	// to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will
	// produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless
	// of whether the variable exists or not. Cannot be updated.
	// More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
	// +optional
	Args []string `json:"args,omitempty" protobuf:"bytes,4,rep,name=args"`
	// Container's working directory.
	// If not specified, the container runtime's default will be used, which
	// might be configured in the container image.
	// Cannot be updated.
	// +optional
	WorkingDir string `json:"workingDir,omitempty" protobuf:"bytes,5,opt,name=workingDir"`
	// List of ports to expose from the container. Not specifying a port here
	// DOES NOT prevent that port from being exposed. Any port which is
	// listening on the default "0.0.0.0" address inside a container will be
	// accessible from the network.
	// Modifying this array with strategic merge patch may corrupt the data.
	// For more information See https://github.com/kubernetes/kubernetes/issues/108255.
	// Cannot be updated.
	// +optional
	// +patchMergeKey=containerPort
	// +patchStrategy=merge
	// +listType=map
	// +listMapKey=containerPort
	// +listMapKey=protocol
	Ports []ContainerPort `json:"ports,omitempty" patchStrategy:"merge" patchMergeKey:"containerPort" protobuf:"bytes,6,rep,name=ports"`
	// List of sources to populate environment variables in the container.
	// The keys defined within a source must be a C_IDENTIFIER. All invalid keys
	// will be reported as an event when the container is starting. When a key exists in multiple
	// sources, the value associated with the last source will take precedence.
	// Values defined by an Env with a duplicate key will take precedence.
	// Cannot be updated.
	// +optional
	EnvFrom []EnvFromSource `json:"envFrom,omitempty" protobuf:"bytes,19,rep,name=envFrom"`
	// List of environment variables to set in the container.
	// Cannot be updated.
	// +optional
	// +patchMergeKey=name
	// +patchStrategy=merge
	Env []EnvVar `json:"env,omitempty" patchStrategy:"merge" patchMergeKey:"name" protobuf:"bytes,7,rep,name=env"`
	// Compute Resources required by this container.
	// Cannot be updated.
	// More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
	// +optional
	Resources ResourceRequirements `json:"resources,omitempty" protobuf:"bytes,8,opt,name=resources"`
	// Pod volumes to mount into the container's filesystem.
	// Cannot be updated.
	// +optional
	// +patchMergeKey=mountPath
	// +patchStrategy=merge
	VolumeMounts []VolumeMount `json:"volumeMounts,omitempty" patchStrategy:"merge" patchMergeKey:"mountPath" protobuf:"bytes,9,rep,name=volumeMounts"`
	// volumeDevices is the list of block devices to be used by the container.
	// +patchMergeKey=devicePath
	// +patchStrategy=merge
	// +optional
	VolumeDevices []VolumeDevice `json:"volumeDevices,omitempty" patchStrategy:"merge" patchMergeKey:"devicePath" protobuf:"bytes,21,rep,name=volumeDevices"`
	// Periodic probe of container liveness.
	// Container will be restarted if the probe fails.
	// Cannot be updated.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
	// +optional
	LivenessProbe *Probe `json:"livenessProbe,omitempty" protobuf:"bytes,10,opt,name=livenessProbe"`
	// Periodic probe of container service readiness.
	// Container will be removed from service endpoints if the probe fails.
	// Cannot be updated.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
	// +optional
	ReadinessProbe *Probe `json:"readinessProbe,omitempty" protobuf:"bytes,11,opt,name=readinessProbe"`
	// StartupProbe indicates that the Pod has successfully initialized.
	// If specified, no other probes are executed until this completes successfully.
	// If this probe fails, the Pod will be restarted, just as if the livenessProbe failed.
	// This can be used to provide different probe parameters at the beginning of a Pod's lifecycle,
	// when it might take a long time to load data or warm a cache, than during steady-state operation.
	// This cannot be updated.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
	// +optional
	StartupProbe *Probe `json:"startupProbe,omitempty" protobuf:"bytes,22,opt,name=startupProbe"`
	// Actions that the management system should take in response to container lifecycle events.
	// Cannot be updated.
	// +optional
	Lifecycle *Lifecycle `json:"lifecycle,omitempty" protobuf:"bytes,12,opt,name=lifecycle"`
	// Optional: Path at which the file to which the container's termination message
	// will be written is mounted into the container's filesystem.
	// Message written is intended to be brief final status, such as an assertion failure message.
	// Will be truncated by the node if greater than 4096 bytes. The total message length across
	// all containers will be limited to 12kb.
	// Defaults to /dev/termination-log.
	// Cannot be updated.
	// +optional
	TerminationMessagePath string `json:"terminationMessagePath,omitempty" protobuf:"bytes,13,opt,name=terminationMessagePath"`
	// Indicate how the termination message should be populated. File will use the contents of
	// terminationMessagePath to populate the container status message on both success and failure.
	// FallbackToLogsOnError will use the last chunk of container log output if the termination
	// message file is empty and the container exited with an error.
	// The log output is limited to 2048 bytes or 80 lines, whichever is smaller.
	// Defaults to File.
	// Cannot be updated.
	// +optional
	TerminationMessagePolicy TerminationMessagePolicy `json:"terminationMessagePolicy,omitempty" protobuf:"bytes,20,opt,name=terminationMessagePolicy,casttype=TerminationMessagePolicy"`
	// Image pull policy.
	// One of Always, Never, IfNotPresent.
	// Defaults to Always if :latest tag is specified, or IfNotPresent otherwise.
	// Cannot be updated.
	// More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
	// +optional
	ImagePullPolicy PullPolicy `json:"imagePullPolicy,omitempty" protobuf:"bytes,14,opt,name=imagePullPolicy,casttype=PullPolicy"`
	// SecurityContext defines the security options the container should be run with.
	// If set, the fields of SecurityContext override the equivalent fields of PodSecurityContext.
	// More info: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
	// +optional
	SecurityContext *SecurityContext `json:"securityContext,omitempty" protobuf:"bytes,15,opt,name=securityContext"`

	// Variables for interactive containers, these have very specialized use-cases (e.g. debugging)
	// and shouldn't be used for general purpose containers.

	// Whether this container should allocate a buffer for stdin in the container runtime. If this
	// is not set, reads from stdin in the container will always result in EOF.
	// Default is false.
	// +optional
	Stdin bool `json:"stdin,omitempty" protobuf:"varint,16,opt,name=stdin"`
	// Whether the container runtime should close the stdin channel after it has been opened by
	// a single attach. When stdin is true the stdin stream will remain open across multiple attach
	// sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the
	// first client attaches to stdin, and then remains open and accepts data until the client disconnects,
	// at which time stdin is closed and remains closed until the container is restarted. If this
	// flag is false, a container processes that reads from stdin will never receive an EOF.
	// Default is false
	// +optional
	StdinOnce bool `json:"stdinOnce,omitempty" protobuf:"varint,17,opt,name=stdinOnce"`
	// Whether this container should allocate a TTY for itself, also requires 'stdin' to be true.
	// Default is false.
	// +optional
	TTY bool `json:"tty,omitempty" protobuf:"varint,18,opt,name=tty"`
}
```

[Container的字段](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/workload-resources/pod-v1/#Container) 包括:

|分类|字段|作用|
|:---|:---|:---|
|Docker|name (string)||
||image (string)||
||imagePullPolicy (string)|镜像拉取策略|
||command ([]string)|entrypoint array，默认使用容器内的 ENTRYPOINT|
||args ([]string)|entrypoint 的参数，默认使用容器镜像的 CMD|
||workingDir (string)|容器的工作目录|
||ports([]ContainerPort)|容器暴露的端口列表，不指定端口不会阻止该端口被暴露|
||env([]EnvVar)|在容器中设置的环境变量列表，无法更新|
||envFrom ([]EnvFromSource)|容器中填充环境变量的数据源列表|
||volumeMounts ([]VolumeMount)|挂载到容器文件系统中的 Pod 卷|
||volumeDevices ([]VolumeDevice)|容器要使用的块设备列表|
|资源限制|resources(ResourceRequirements)|容器所需的计算资源|
|Hook|lifecycle (Lifecycle)||
||terminationMessagePath (string)||
||terminationMessagePolicy (string)||
|健康检查|livenessProbe (Probe)|定期探针容器活跃度。如果探针失败，容器将重新启动|
||readinessProbe (Probe)|定期探测容器服务就绪情况。如果探针失败，容器将被从服务端点中删除|
||startupProbe (Probe)|startupProbe 表示 Pod 已成功初始化。如果设置了此字段，则此探针成功完成之前不会执行其他探针。如果这个探针失败，Pod 会重新启动，就像存活态探针失败一样|
|安全控制|securityContext (SecurityContext)|定义了容器应该运行的安全选项，将覆盖Pod SecurityContext 的同名字段|
|调试|stdin(boolean)|此容器是否应在容器运行时为 stdin 分配缓冲区。如果未设置，从容器中的 stdin 读取将始终导致 EOF。 默认为 false|
||stdinOnce(boolean)|stdin 是否在第一链接后就关闭|


## 4. Container 重要字段
### 4.1 Docker 常规字段
Docker 常规字段包括定义容器运行的相关参数，常用的字段包括: 

```yaml
  # 常规字段
  containers:
  - image: geektime/tomcat:7.0
    workingDir: /root
    name: tomcat
    command: ["sh","-c","/root/apache-tomcat-7.0.42-v2/bin/start.sh"]
    volumeMounts:
    ports:
      - containerPort: 8080      
        hostPort: 8001 
```

#### ImagePullPolicy
ImagePullPolicy 定义了镜像拉取的策略 
- Always: 默认值，每次创建 Pod 都重新拉取一次镜像。另外，当容器的镜像是类似于 nginx 或者 nginx:latest 这样的名字时，ImagePullPolicy 也会被认为 Always
- Never 或者 IfNotPresent，则意味着 Pod 永远不会主动拉取这个镜像，或者只在宿主机上不存在这个镜像时才拉取

### 4.2 容器健康检查
在 Kubernetes 中，你可以为 Pod 里的容器定义各种探针(Probe) kubelet 会根据这些 Probe 的返回值决定容器的可用性。

[Probe](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L2215) 的定义如下:

```go
type Probe struct {
	// The action taken to determine the health of a container
	ProbeHandler `json:",inline" protobuf:"bytes,1,opt,name=handler"`
	// Number of seconds after the container has started before liveness probes are initiated.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
	// +optional
	InitialDelaySeconds int32 `json:"initialDelaySeconds,omitempty" protobuf:"varint,2,opt,name=initialDelaySeconds"`
	// Number of seconds after which the probe times out.
	// Defaults to 1 second. Minimum value is 1.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
	// +optional
	TimeoutSeconds int32 `json:"timeoutSeconds,omitempty" protobuf:"varint,3,opt,name=timeoutSeconds"`
	// How often (in seconds) to perform the probe.
	// Default to 10 seconds. Minimum value is 1.
	// +optional
	PeriodSeconds int32 `json:"periodSeconds,omitempty" protobuf:"varint,4,opt,name=periodSeconds"`
	// Minimum consecutive successes for the probe to be considered successful after having failed.
	// Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
	// +optional
	SuccessThreshold int32 `json:"successThreshold,omitempty" protobuf:"varint,5,opt,name=successThreshold"`
	// Minimum consecutive failures for the probe to be considered failed after having succeeded.
	// Defaults to 3. Minimum value is 1.
	// +optional
	FailureThreshold int32 `json:"failureThreshold,omitempty" protobuf:"varint,6,opt,name=failureThreshold"`
	// Optional duration in seconds the pod needs to terminate gracefully upon probe failure.
	// The grace period is the duration in seconds after the processes running in the pod are sent
	// a termination signal and the time when the processes are forcibly halted with a kill signal.
	// Set this value longer than the expected cleanup time for your process.
	// If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this
	// value overrides the value provided by the pod spec.
	// Value must be non-negative integer. The value zero indicates stop immediately via
	// the kill signal (no opportunity to shut down).
	// This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate.
	// Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
	// +optional
	TerminationGracePeriodSeconds *int64 `json:"terminationGracePeriodSeconds,omitempty" protobuf:"varint,7,opt,name=terminationGracePeriodSeconds"`
}
```

|字段|含义|
|TimeoutSeconds (int32)|容器启动后启动存活态探针之前的秒数|
|terminationGracePeriodSeconds （int64）|Pod 需要在探针失败时体面终止所需的时间长度，Pod 优雅终止需要的时间|
|periodSeconds (int32)|探针的执行周期|
|timeoutSeconds (int32)|探针超时的秒数|
|failureThreshold (int32)|探针成功后的最小连续失败次数，超出此阈值则认为探针失败|
|successThreshold (int32)|探针失败后最小连续成功次数，超过此阈值才会被视为探针成功|
|ProbeHandler|定义探针的类型|

ProbeHandler 包含的探针有如下几种类型:
1. Exec: 在容器启动后，在容器里面执行一条的命令
2. HTTPGet: 在容器启动后，发送一个 get 请求
3. TCPSocket: 在容器启动后，尝试一次 Tcp 连接
4. GRPCAction: 在容器启动后，发送一个 Grpc 请求

```go
type ProbeHandler struct {
	// Exec specifies the action to take.
	// +optional
	Exec *ExecAction `json:"exec,omitempty" protobuf:"bytes,1,opt,name=exec"`
	// HTTPGet specifies the http request to perform.
	// +optional
	HTTPGet *HTTPGetAction `json:"httpGet,omitempty" protobuf:"bytes,2,opt,name=httpGet"`
	// TCPSocket specifies an action involving a TCP port.
	// +optional
	TCPSocket *TCPSocketAction `json:"tcpSocket,omitempty" protobuf:"bytes,3,opt,name=tcpSocket"`

	// GRPC specifies an action involving a GRPC port.
	// This is a beta field and requires enabling GRPCContainerProbe feature gate.
	// +featureGate=GRPCContainerProbe
	// +optional
	GRPC *GRPCAction `json:"grpc,omitempty" protobuf:"bytes,4,opt,name=grpc"`
}

// TCPSocketAction describes an action based on opening a socket
type TCPSocketAction struct {
	// Number or name of the port to access on the container.
	// Number must be in the range 1 to 65535.
	// Name must be an IANA_SVC_NAME.
	Port intstr.IntOrString `json:"port" protobuf:"bytes,1,opt,name=port"`
	// Optional: Host name to connect to, defaults to the pod IP.
	// +optional
	Host string `json:"host,omitempty" protobuf:"bytes,2,opt,name=host"`
}

type GRPCAction struct {
	// Port number of the gRPC service. Number must be in the range 1 to 65535.
	Port int32 `json:"port" protobuf:"bytes,1,opt,name=port"`

	// Service is the name of the service to place in the gRPC HealthCheckRequest
	// (see https://github.com/grpc/grpc/blob/master/doc/health-checking.md).
	//
	// If this is not specified, the default behavior is defined by gRPC.
	// +optional
	// +default=""
	Service *string `json:"service" protobuf:"bytes,2,opt,name=service"`
}

// ExecAction describes a "run in container" action.
type ExecAction struct {
	// Command is the command line to execute inside the container, the working directory for the
	// command  is root ('/') in the container's filesystem. The command is simply exec'd, it is
	// not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use
	// a shell, you need to explicitly call out to that shell.
	// Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
	// +optional
	Command []string `json:"command,omitempty" protobuf:"bytes,1,rep,name=command"`
}

// HTTPGetAction describes an action based on HTTP Get requests.
type HTTPGetAction struct {
	// Path to access on the HTTP server.
	// +optional
	Path string `json:"path,omitempty" protobuf:"bytes,1,opt,name=path"`
	// Name or number of the port to access on the container.
	// Number must be in the range 1 to 65535.
	// Name must be an IANA_SVC_NAME.
	Port intstr.IntOrString `json:"port" protobuf:"bytes,2,opt,name=port"`
	// Host name to connect to, defaults to the pod IP. You probably want to set
	// "Host" in httpHeaders instead.
	// +optional
	Host string `json:"host,omitempty" protobuf:"bytes,3,opt,name=host"`
	// Scheme to use for connecting to the host.
	// Defaults to HTTP.
	// +optional
	Scheme URIScheme `json:"scheme,omitempty" protobuf:"bytes,4,opt,name=scheme,casttype=URIScheme"`
	// Custom headers to set in the request. HTTP allows repeated headers.
	// +optional
	HTTPHeaders []HTTPHeader `json:"httpHeaders,omitempty" protobuf:"bytes,5,rep,name=httpHeaders"`
}

type HTTPHeader struct {
	// The header field name
	Name string `json:"name" protobuf:"bytes,1,opt,name=name"`
	// The header field value
	Value string `json:"value" protobuf:"bytes,2,opt,name=value"`
}
```

#### livenessProbe
livenessProbe 定义一个健康检查“探针”（Probe）。kubelet 会根据这个 Probe 的返回值决定这个容器的状态，而不是直接以容器镜像是否运行（来自 Docker 返回的信息）作为依据。这种机制，是生产环境中保证应用健康存活的重要手段。

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    test: liveness
  name: test-liveness-exec
spec:
  containers:
  - name: liveness
    image: busybox
    args:
    - /bin/sh
    - -c
    - touch /tmp/healthy; sleep 30; rm -rf /tmp/healthy; sleep 600
    livenessProbe:
      exec:
        command:
        - cat
        - /tmp/healthy
      initialDelaySeconds: 5
      periodSeconds: 5

livenessProbe:
     httpGet:
       path: /healthz
       port: 8080
       httpHeaders:
       - name: X-Custom-Header
         value: Awesome
	initialDelaySeconds: 3
	periodSeconds: 3


...
livenessProbe:
	tcpSocket:
		port: 8080
	initialDelaySeconds: 15
	periodSeconds: 20
```

#### readinessProbe
readinessProbe 用法与 livenessProbe 类似，但作用却大不一样。readinessProbe 检查结果的成功与否，决定的这个 Pod 是不是能被通过 Service 的方式访问到，而并不影响 Pod 的生命周期。

### 4.3 Hook
Lifecycle 定义的是 Container Lifecycle Hooks。顾名思义，Container Lifecycle Hooks 就是在容器状态发生变化时触发一系列“钩子”。

[LifecycleHandler](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L2559):

```go
// LifecycleHandler defines a specific action that should be taken in a lifecycle
// hook. One and only one of the fields, except TCPSocket must be specified.
type LifecycleHandler struct {
	// Exec specifies the action to take.
	// +optional
	Exec *ExecAction `json:"exec,omitempty" protobuf:"bytes,1,opt,name=exec"`
	// HTTPGet specifies the http request to perform.
	// +optional
	HTTPGet *HTTPGetAction `json:"httpGet,omitempty" protobuf:"bytes,2,opt,name=httpGet"`
	// Deprecated. TCPSocket is NOT supported as a LifecycleHandler and kept
	// for the backward compatibility. There are no validation of this field and
	// lifecycle hooks will fail in runtime when tcp handler is specified.
	// +optional
	TCPSocket *TCPSocketAction `json:"tcpSocket,omitempty" protobuf:"bytes,3,opt,name=tcpSocket"`
}

// Lifecycle describes actions that the management system should take in response to container lifecycle
// events. For the PostStart and PreStop lifecycle handlers, management of the container blocks
// until the action is complete, unless the container process fails, in which case the handler is aborted.
type Lifecycle struct {
	// PostStart is called immediately after a container is created. If the handler fails,
	// the container is terminated and restarted according to its restart policy.
	// Other management of the container blocks until the hook completes.
	// More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks
	// +optional
	PostStart *LifecycleHandler `json:"postStart,omitempty" protobuf:"bytes,1,opt,name=postStart"`
	// PreStop is called immediately before a container is terminated due to an
	// API request or management event such as liveness/startup probe failure,
	// preemption, resource contention, etc. The handler is not called if the
	// container crashes or exits. The Pod's termination grace period countdown begins before the
	// PreStop hook is executed. Regardless of the outcome of the handler, the
	// container will eventually terminate within the Pod's termination grace
	// period (unless delayed by finalizers). Other management of the container blocks until the hook completes
	// or until the termination grace period is reached.
	// More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks
	// +optional
	PreStop *LifecycleHandler `json:"preStop,omitempty" protobuf:"bytes,2,opt,name=preStop"`
}
```
其中:
1. postStart: 
  - 指的是，在容器启动后，立刻执行一个指定的操作。
  - 需要明确的是，postStart 定义的操作，虽然是在 Docker 容器 ENTRYPOINT 执行之后，但它并不严格保证顺序。
  - 也就是说，在 postStart 启动时，ENTRYPOINT 有可能还没有结束。
  - 如果 postStart 执行超时或者错误，Kubernetes 会在该 Pod 的 Events 中报出该容器启动失败的错误信息，导致 Pod 也处于失败的状态
2. preStop:
  - 发生的时机，则是容器被杀死之前
  - preStop 操作的执行是同步的。所以，它会阻塞当前的容器杀死流程，直到这个 Hook 定义操作完成之后，才允许容器被杀死，这跟 postStart 不一样

LifecycleHandler 包含的 Handler 与 ProbeHandler 基本一直，只是少了 GRPCAction

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: lifecycle-demo
spec:
  containers:
  - name: lifecycle-demo-container
    image: nginx
    lifecycle:
      postStart:
        exec:
          command: ["/bin/sh", "-c", "echo Hello from the postStart handler > /usr/share/message"]
      preStop:
        exec:
          command: ["/usr/sbin/nginx","-s","quit"]
```

## 5. Pod 生命周期
[PodStatus](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L4061): 

```go
type PodStatus struct {
	Phase PodPhase `json:"phase,omitempty" protobuf:"bytes,1,opt,name=phase,casttype=PodPhase"`
	// Current service state of pod.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-conditions
	// +optional
	// +patchMergeKey=type
	// +patchStrategy=merge
	Conditions []PodCondition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type" protobuf:"bytes,2,rep,name=conditions"`
	// A human readable message indicating details about why the pod is in this condition.
	// +optional
	Message string `json:"message,omitempty" protobuf:"bytes,3,opt,name=message"`
	// A brief CamelCase message indicating details about why the pod is in this state.
	// e.g. 'Evicted'
	// +optional
	Reason string `json:"reason,omitempty" protobuf:"bytes,4,opt,name=reason"`
	// nominatedNodeName is set only when this pod preempts other pods on the node, but it cannot be
	// scheduled right away as preemption victims receive their graceful termination periods.
	// This field does not guarantee that the pod will be scheduled on this node. Scheduler may decide
	// to place the pod elsewhere if other nodes become available sooner. Scheduler may also decide to
	// give the resources on this node to a higher priority pod that is created after preemption.
	// As a result, this field may be different than PodSpec.nodeName when the pod is
	// scheduled.
	// +optional
	NominatedNodeName string `json:"nominatedNodeName,omitempty" protobuf:"bytes,11,opt,name=nominatedNodeName"`

	// IP address of the host to which the pod is assigned. Empty if not yet scheduled.
	// +optional
	HostIP string `json:"hostIP,omitempty" protobuf:"bytes,5,opt,name=hostIP"`
	// IP address allocated to the pod. Routable at least within the cluster.
	// Empty if not yet allocated.
	// +optional
	PodIP string `json:"podIP,omitempty" protobuf:"bytes,6,opt,name=podIP"`

	// podIPs holds the IP addresses allocated to the pod. If this field is specified, the 0th entry must
	// match the podIP field. Pods may be allocated at most 1 value for each of IPv4 and IPv6. This list
	// is empty if no IPs have been allocated yet.
	// +optional
	// +patchStrategy=merge
	// +patchMergeKey=ip
	PodIPs []PodIP `json:"podIPs,omitempty" protobuf:"bytes,12,rep,name=podIPs" patchStrategy:"merge" patchMergeKey:"ip"`

	// RFC 3339 date and time at which the object was acknowledged by the Kubelet.
	// This is before the Kubelet pulled the container image(s) for the pod.
	// +optional
	StartTime *metav1.Time `json:"startTime,omitempty" protobuf:"bytes,7,opt,name=startTime"`

	// The list has one entry per init container in the manifest. The most recent successful
	// init container will have ready = true, the most recently started container will have
	// startTime set.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-and-container-status
	InitContainerStatuses []ContainerStatus `json:"initContainerStatuses,omitempty" protobuf:"bytes,10,rep,name=initContainerStatuses"`

	// The list has one entry per container in the manifest.
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#pod-and-container-status
	// +optional
	ContainerStatuses []ContainerStatus `json:"containerStatuses,omitempty" protobuf:"bytes,8,rep,name=containerStatuses"`
	// The Quality of Service (QOS) classification assigned to the pod based on resource requirements
	// See PodQOSClass type for available QOS classes
	// More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#quality-of-service-classes
	// +optional
	QOSClass PodQOSClass `json:"qosClass,omitempty" protobuf:"bytes,9,rep,name=qosClass"`
	// Status for any ephemeral containers that have run in this pod.
	// +optional
	EphemeralContainerStatuses []ContainerStatus `json:"ephemeralContainerStatuses,omitempty" protobuf:"bytes,13,rep,name=ephemeralContainerStatuses"`

	// Status of resources resize desired for pod's containers.
	// It is empty if no resources resize is pending.
	// Any changes to container resources will automatically set this to "Proposed"
	// +featureGate=InPlacePodVerticalScaling
	// +optional
	Resize PodResizeStatus `json:"resize,omitempty" protobuf:"bytes,14,opt,name=resize,casttype=PodResizeStatus"`
}
```

Pod 生命周期的变化，主要体现在 Pod API 对象的 Status 部分，其中，**pod.status.phase**，就是 Pod 的当前状态，它有如下几种可能的情况：
1. Pending: API 对象已经被创建并保存在 Etcd 当中。但是，这个 Pod 里有些容器因为某种原因而不能被顺利创建。比如，调度不成功
2. Running: Pod 已经调度成功，跟一个具体的节点绑定。它包含的容器都已经创建成功，并且至少有一个正在运行中
3. Succeeded: Pod 里的所有容器都正常运行完毕，并且已经退出了，运行一次性任务时最为常见
4. Failed: Pod 里至少有一个容器以不正常的状态(非 0 的返回码)退出
5. Unknown: 这是一个异常状态，意味着 Pod 的状态不能持续地被 kubelet 汇报给 kube-apiserver，这很有可能是主从节点(Master 和 Kubelet)间的通信出现了问题

更进一步地，Pod 对象的 Status 字段，还可以再细分出一组 **Conditions**。这些细分状态的值包括：PodScheduled、Ready、Initialized，以及 Unschedulable。它们主要用于描述造成当前 Status 的具体原因是什么。比如，Pod 当前的 Status 是 Pending，对应的 Condition 是 Unschedulable，这就意味着它的调度出现了问题。

而其中，Ready 这个细分状态非常值得我们关注：它意味着 Pod 不仅已经正常启动(Running 状态)，而且已经可以对外提供服务了。这两者之间(Running 和 Ready)是有区别的。

## 6.PodPreset
PodPreset 可以自动给对应的 Pod 对象填充字段。

### 6.1 PodPreset 定义
```go

```

### 6.2 PodPreset
```yaml

apiVersion: settings.k8s.io/v1alpha1
kind: PodPreset
metadata:
  name: allow-database
spec:
  selector:
    matchLabels:
      role: frontend  # 目标 Pod
  env:
    - name: DB_PORT
      value: "6379"
  volumeMounts:
    - mountPath: /cache
      name: cache-volume
  volumes:
    - name: cache-volume
      emptyDir: {}
```

这个 PodPreset 会作用于 selector 所定义的、带有“role: frontend”标签的 Pod 对象。

PodPreset 里定义的内容，只会在 Pod API 对象被创建之前追加在这个对象本身上，而不会影响任何 Pod 的控制器的定义。比如，我们现在提交的是一个 nginx-deployment，那么这个 Deployment 对象本身是永远不会被 PodPreset 改变的，被修改的只是这个 Deployment 创建出来的所有 Pod。

如果你定义了同时作用于一个 Pod 对象的多个 PodPreset，Kubernetes 会帮你合并（Merge）这两个 PodPreset 要做的修改。而如果它们要做的修改有冲突的话，这些冲突字段就不会被修改。