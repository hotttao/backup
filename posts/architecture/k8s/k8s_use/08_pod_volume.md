---
weight: 1
title: "Pod Volume"
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

上一节我们介绍了 Pod 的定义，Pod 包含的信息非常服务，其中，资源定义（比如 CPU、内存等），以及调度相关的字段会在后面专门讲解调度器时再进行深入的分析。本节我们来关注 Pod 的另一重要内容 Volume。

## 1. Volume
### 1.1 Volume 定义

[Volume](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L36):

```go
// Volume represents a named volume in a pod that may be accessed by any container in the pod.
type Volume struct {
	// name of the volume.
	// Must be a DNS_LABEL and unique within the pod.
	// More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
	Name string `json:"name" protobuf:"bytes,1,opt,name=name"`
	// volumeSource represents the location and type of the mounted volume.
	// If not specified, the Volume is implied to be an EmptyDir.
	// This implied behavior is deprecated and will be removed in a future version.
	VolumeSource `json:",inline" protobuf:"bytes,2,opt,name=volumeSource"`
}

// Represents the source of a volume to mount.
// Only one of its members may be specified.
type VolumeSource struct {
	// hostPath represents a pre-existing file or directory on the host
	// machine that is directly exposed to the container. This is generally
	// used for system agents or other privileged things that are allowed
	// to see the host machine. Most containers will NOT need this.
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
	// ---
	// TODO(jonesdl) We need to restrict who can use host directory mounts and who can/can not
	// mount host directories as read/write.
	// +optional
	HostPath *HostPathVolumeSource `json:"hostPath,omitempty" protobuf:"bytes,1,opt,name=hostPath"`
	// emptyDir represents a temporary directory that shares a pod's lifetime.
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir
	// +optional
	EmptyDir *EmptyDirVolumeSource `json:"emptyDir,omitempty" protobuf:"bytes,2,opt,name=emptyDir"`
	// gcePersistentDisk represents a GCE Disk resource that is attached to a
	// kubelet's host machine and then exposed to the pod.
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
	// +optional
	GCEPersistentDisk *GCEPersistentDiskVolumeSource `json:"gcePersistentDisk,omitempty" protobuf:"bytes,3,opt,name=gcePersistentDisk"`
	// awsElasticBlockStore represents an AWS Disk resource that is attached to a
	// kubelet's host machine and then exposed to the pod.
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
	// +optional
	AWSElasticBlockStore *AWSElasticBlockStoreVolumeSource `json:"awsElasticBlockStore,omitempty" protobuf:"bytes,4,opt,name=awsElasticBlockStore"`
	// gitRepo represents a git repository at a particular revision.
	// DEPRECATED: GitRepo is deprecated. To provision a container with a git repo, mount an
	// EmptyDir into an InitContainer that clones the repo using git, then mount the EmptyDir
	// into the Pod's container.
	// +optional
	GitRepo *GitRepoVolumeSource `json:"gitRepo,omitempty" protobuf:"bytes,5,opt,name=gitRepo"`
	// secret represents a secret that should populate this volume.
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#secret
	// +optional
	Secret *SecretVolumeSource `json:"secret,omitempty" protobuf:"bytes,6,opt,name=secret"`
	// nfs represents an NFS mount on the host that shares a pod's lifetime
	// More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
	// +optional
	NFS *NFSVolumeSource `json:"nfs,omitempty" protobuf:"bytes,7,opt,name=nfs"`
	// iscsi represents an ISCSI Disk resource that is attached to a
	// kubelet's host machine and then exposed to the pod.
	// More info: https://examples.k8s.io/volumes/iscsi/README.md
	// +optional
	ISCSI *ISCSIVolumeSource `json:"iscsi,omitempty" protobuf:"bytes,8,opt,name=iscsi"`
	// glusterfs represents a Glusterfs mount on the host that shares a pod's lifetime.
	// More info: https://examples.k8s.io/volumes/glusterfs/README.md
	// +optional
	Glusterfs *GlusterfsVolumeSource `json:"glusterfs,omitempty" protobuf:"bytes,9,opt,name=glusterfs"`
	// persistentVolumeClaimVolumeSource represents a reference to a
	// PersistentVolumeClaim in the same namespace.
	// More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
	// +optional
	PersistentVolumeClaim *PersistentVolumeClaimVolumeSource `json:"persistentVolumeClaim,omitempty" protobuf:"bytes,10,opt,name=persistentVolumeClaim"`
	// rbd represents a Rados Block Device mount on the host that shares a pod's lifetime.
	// More info: https://examples.k8s.io/volumes/rbd/README.md
	// +optional
	RBD *RBDVolumeSource `json:"rbd,omitempty" protobuf:"bytes,11,opt,name=rbd"`
	// flexVolume represents a generic volume resource that is
	// provisioned/attached using an exec based plugin.
	// +optional
	FlexVolume *FlexVolumeSource `json:"flexVolume,omitempty" protobuf:"bytes,12,opt,name=flexVolume"`
	// cinder represents a cinder volume attached and mounted on kubelets host machine.
	// More info: https://examples.k8s.io/mysql-cinder-pd/README.md
	// +optional
	Cinder *CinderVolumeSource `json:"cinder,omitempty" protobuf:"bytes,13,opt,name=cinder"`
	// cephFS represents a Ceph FS mount on the host that shares a pod's lifetime
	// +optional
	CephFS *CephFSVolumeSource `json:"cephfs,omitempty" protobuf:"bytes,14,opt,name=cephfs"`
	// flocker represents a Flocker volume attached to a kubelet's host machine. This depends on the Flocker control service being running
	// +optional
	Flocker *FlockerVolumeSource `json:"flocker,omitempty" protobuf:"bytes,15,opt,name=flocker"`
	// downwardAPI represents downward API about the pod that should populate this volume
	// +optional
	DownwardAPI *DownwardAPIVolumeSource `json:"downwardAPI,omitempty" protobuf:"bytes,16,opt,name=downwardAPI"`
	// fc represents a Fibre Channel resource that is attached to a kubelet's host machine and then exposed to the pod.
	// +optional
	FC *FCVolumeSource `json:"fc,omitempty" protobuf:"bytes,17,opt,name=fc"`
	// azureFile represents an Azure File Service mount on the host and bind mount to the pod.
	// +optional
	AzureFile *AzureFileVolumeSource `json:"azureFile,omitempty" protobuf:"bytes,18,opt,name=azureFile"`
	// configMap represents a configMap that should populate this volume
	// +optional
	ConfigMap *ConfigMapVolumeSource `json:"configMap,omitempty" protobuf:"bytes,19,opt,name=configMap"`
	// vsphereVolume represents a vSphere volume attached and mounted on kubelets host machine
	// +optional
	VsphereVolume *VsphereVirtualDiskVolumeSource `json:"vsphereVolume,omitempty" protobuf:"bytes,20,opt,name=vsphereVolume"`
	// quobyte represents a Quobyte mount on the host that shares a pod's lifetime
	// +optional
	Quobyte *QuobyteVolumeSource `json:"quobyte,omitempty" protobuf:"bytes,21,opt,name=quobyte"`
	// azureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
	// +optional
	AzureDisk *AzureDiskVolumeSource `json:"azureDisk,omitempty" protobuf:"bytes,22,opt,name=azureDisk"`
	// photonPersistentDisk represents a PhotonController persistent disk attached and mounted on kubelets host machine
	PhotonPersistentDisk *PhotonPersistentDiskVolumeSource `json:"photonPersistentDisk,omitempty" protobuf:"bytes,23,opt,name=photonPersistentDisk"`
	// projected items for all in one resources secrets, configmaps, and downward API
	Projected *ProjectedVolumeSource `json:"projected,omitempty" protobuf:"bytes,26,opt,name=projected"`
	// portworxVolume represents a portworx volume attached and mounted on kubelets host machine
	// +optional
	PortworxVolume *PortworxVolumeSource `json:"portworxVolume,omitempty" protobuf:"bytes,24,opt,name=portworxVolume"`
	// scaleIO represents a ScaleIO persistent volume attached and mounted on Kubernetes nodes.
	// +optional
	ScaleIO *ScaleIOVolumeSource `json:"scaleIO,omitempty" protobuf:"bytes,25,opt,name=scaleIO"`
	// storageOS represents a StorageOS volume attached and mounted on Kubernetes nodes.
	// +optional
	StorageOS *StorageOSVolumeSource `json:"storageos,omitempty" protobuf:"bytes,27,opt,name=storageos"`
	// csi (Container Storage Interface) represents ephemeral storage that is handled by certain external CSI drivers (Beta feature).
	// +optional
	CSI *CSIVolumeSource `json:"csi,omitempty" protobuf:"bytes,28,opt,name=csi"`
	// ephemeral represents a volume that is handled by a cluster storage driver.
	// The volume's lifecycle is tied to the pod that defines it - it will be created before the pod starts,
	// and deleted when the pod is removed.
	//
	// Use this if:
	// a) the volume is only needed while the pod runs,
	// b) features of normal volumes like restoring from snapshot or capacity
	//    tracking are needed,
	// c) the storage driver is specified through a storage class, and
	// d) the storage driver supports dynamic volume provisioning through
	//    a PersistentVolumeClaim (see EphemeralVolumeSource for more
	//    information on the connection between this volume type
	//    and PersistentVolumeClaim).
	//
	// Use PersistentVolumeClaim or one of the vendor-specific
	// APIs for volumes that persist for longer than the lifecycle
	// of an individual pod.
	//
	// Use CSI for light-weight local ephemeral volumes if the CSI driver is meant to
	// be used that way - see the documentation of the driver for
	// more information.
	//
	// A pod can use both types of ephemeral volumes and
	// persistent volumes at the same time.
	//
	// +optional
	Ephemeral *EphemeralVolumeSource `json:"ephemeral,omitempty" protobuf:"bytes,29,opt,name=ephemeral"`
}
```

除了上一节提到的 EmptyDir 和 HostPath，Pod 的 Volume 还支持很多其他类型。

### 1.1 Projected Volume
在 Kubernetes 中，有几种特殊的 Volume，它们存在的意义不是为了存放容器里的数据，也不是用来进行容器和宿主机之间的数据交换。这些特殊 Volume 的作用，是为容器提供预先定义好的数据。从容器的角度来看，这些 Volume 里的信息就是仿佛是被 Kubernetes“投射”（Project）进入容器当中的。所以它们被称作 Projected Volume(投射数据卷)。

Projected Volume 由 Volume 中的 Project 字段定义类型是 [ProjectedVolumeSource](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L1707):

```go
// Represents a projected volume source
type ProjectedVolumeSource struct {
	// sources is the list of volume projections
	// +optional
	Sources []VolumeProjection `json:"sources" protobuf:"bytes,1,rep,name=sources"`
	// defaultMode are the mode bits used to set permissions on created files by default.
	// Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511.
	// YAML accepts both octal and decimal values, JSON requires decimal values for mode bits.
	// Directories within the path are not affected by this setting.
	// This might be in conflict with other options that affect the file
	// mode, like fsGroup, and the result can be other mode bits set.
	// +optional
	DefaultMode *int32 `json:"defaultMode,omitempty" protobuf:"varint,2,opt,name=defaultMode"`
}

// Projection that may be projected along with other supported volume types
type VolumeProjection struct {
	// all types below are the supported types for projection into the same volume

	// secret information about the secret data to project
	// +optional
	Secret *SecretProjection `json:"secret,omitempty" protobuf:"bytes,1,opt,name=secret"`
	// downwardAPI information about the downwardAPI data to project
	// +optional
	DownwardAPI *DownwardAPIProjection `json:"downwardAPI,omitempty" protobuf:"bytes,2,opt,name=downwardAPI"`
	// configMap information about the configMap data to project
	// +optional
	ConfigMap *ConfigMapProjection `json:"configMap,omitempty" protobuf:"bytes,3,opt,name=configMap"`
	// serviceAccountToken is information about the serviceAccountToken data to project
	// +optional
	ServiceAccountToken *ServiceAccountTokenProjection `json:"serviceAccountToken,omitempty" protobuf:"bytes,4,opt,name=serviceAccountToken"`
}
```

Kubernetes 支持的 Projected Volume 一共有四种：
1. Secret (SecretProjection)；
2. ConfigMap (ConfigMapProjection)
3. Downward API (DownwardAPIProjection)
4. ServiceAccountToken (ServiceAccountTokenProjection)

注意 Pod Volume 的定义中也有一个 Secret *SecretVolumeSource 与这里的类型 SecretProjection 是不一样的，这个我们后面在介绍。

#### SecretProjection

[SecretProjection](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L1235) 定义如下:

```go
// Adapts a secret into a projected volume.
//
// The contents of the target Secret's Data field will be presented in a
// projected volume as files using the keys in the Data field as the file names.
// Note that this is identical to a secret volume source without the default
// mode.
type SecretProjection struct {
	LocalObjectReference `json:",inline" protobuf:"bytes,1,opt,name=localObjectReference"`
	// items if unspecified, each key-value pair in the Data field of the referenced
	// Secret will be projected into the volume as a file whose name is the
	// key and content is the value. If specified, the listed keys will be
	// projected into the specified paths, and unlisted keys will not be
	// present. If a key is specified which is not present in the Secret,
	// the volume setup will error unless it is marked optional. Paths must be
	// relative and may not contain the '..' path or start with '..'.
	// +optional
	Items []KeyToPath `json:"items,omitempty" protobuf:"bytes,2,rep,name=items"`
	// optional field specify whether the Secret or its key must be defined
	// +optional
	Optional *bool `json:"optional,omitempty" protobuf:"varint,4,opt,name=optional"`
}

// LocalObjectReference contains enough information to let you locate the
// referenced object inside the same namespace.
// +structType=atomic
type LocalObjectReference struct {
	// Name of the referent.
	// More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
	// TODO: Add other useful fields. apiVersion, kind, uid?
	// +optional
	Name string `json:"name,omitempty" protobuf:"bytes,1,opt,name=name"`
}

// Maps a string key to a path within a volume.
type KeyToPath struct {
	// key is the key to project.
	Key string `json:"key" protobuf:"bytes,1,opt,name=key"`

	// path is the relative path of the file to map the key to.
	// May not be an absolute path.
	// May not contain the path element '..'.
	// May not start with the string '..'.
	Path string `json:"path" protobuf:"bytes,2,opt,name=path"`
	// mode is Optional: mode bits used to set permissions on this file.
	// Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511.
	// YAML accepts both octal and decimal values, JSON requires decimal values for mode bits.
	// If not specified, the volume defaultMode will be used.
	// This might be in conflict with other options that affect the file
	// mode, like fsGroup, and the result can be other mode bits set.
	// +optional
	Mode *int32 `json:"mode,omitempty" protobuf:"varint,3,opt,name=mode"`
}
```

在 SecretProjection 的定义中:
1. LocalObjectReference 的 Name 字段指向的是 kubernetes 保存在 ETCD 中的 Secret 对象。
2. KeyToPath 指定将 Secret data 中哪些键值对单独保存 KeyToPath.Path 是一个相对路径。

SecretProjection:
1. 作用: 通过在 Pod 的容器里挂载 SecretProjection 类型的 Project Volume，就可以访问 Secret 里保存的信息了
2. 场景: 存放数据库的认证信息
3. 更新: 
	- 通过挂载方式进入到容器里的 Secret，一旦其对应的 Etcd 里的数据被更新，这些 Volume 里的文件内容，同样也会被更新
	- kubelet 组件在定时维护这些 Volume，这个更新可能会有一定的延时。所以在编写应用程序时，在发起数据库连接的代码处写好重试和超时的逻辑，绝对是个好习惯。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-projected-volume 
spec:
  containers:
  - name: test-secret-volume
    image: busybox
    args:
    - sleep
    - "86400"
    volumeMounts:
    - name: mysql-cred
      mountPath: "/projected-volume" 
      readOnly: true
  volumes:
  - name: mysql-cred
    projected:             
      sources:             
      - secret:             
          name: user        # Secret 名称
      - secret:
          name: pass
# 最终 user secret会以文件的方式保存在 /projected-volume/user
```

#### ConfigMapProjection

[ConfigMapProjection](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L1666) 定义如下:

```go
type ConfigMapProjection struct {
	LocalObjectReference `json:",inline" protobuf:"bytes,1,opt,name=localObjectReference"`
	// items if unspecified, each key-value pair in the Data field of the referenced
	// ConfigMap will be projected into the volume as a file whose name is the
	// key and content is the value. If specified, the listed keys will be
	// projected into the specified paths, and unlisted keys will not be
	// present. If a key is specified which is not present in the ConfigMap,
	// the volume setup will error unless it is marked optional. Paths must be
	// relative and may not contain the '..' path or start with '..'.
	// +optional
	Items []KeyToPath `json:"items,omitempty" protobuf:"bytes,2,rep,name=items"`
	// optional specify whether the ConfigMap or its keys must be defined
	// +optional
	Optional *bool `json:"optional,omitempty" protobuf:"varint,4,opt,name=optional"`
}
```

从 ConfigMapProjection 的定义可以看到 ConfigMapProjection 与 SecretProjection 完全一致。

```yaml
  volumes:
  - name: mysql-cred
    projected:             
      sources:             
      - configMap:             
          name: user        # ConfigMap 名称
      - secret:
          name: pass        # Secret 名称
```

#### DownwardAPIProjection
Downward API
1. 作用: 让 Pod 里的容器能够直接获取到这个 Pod API 对象本身的信息
2. 范围:
	- Downward API 能够获取到的信息，一定是 Pod 里的容器进程启动之前就能够确定下来的信息
	- 如果想要获取 Pod 容器运行后才会出现的信息，比如，容器进程的 PID，应该考虑在 Pod 里定义一个 sidecar 容器

Secret、ConfigMap，以及 Downward API 这三种 Projected Volume 定义的信息，大多还可以通过环境变量的方式出现在容器里。但是，通过环境变量获取这些信息的方式，不具备自动更新的能力。所以，一般情况下，我都建议你使用 Volume 文件的方式获取这些信息。

[DownwardAPIProjection](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L6633) 定义如下:

```go
type DownwardAPIProjection struct {
	// Items is a list of DownwardAPIVolume file
	// +optional
	Items []DownwardAPIVolumeFile `json:"items,omitempty" protobuf:"bytes,1,rep,name=items"`
}

// DownwardAPIVolumeFile represents information to create the file containing the pod field
type DownwardAPIVolumeFile struct {
	// Required: Path is  the relative path name of the file to be created. Must not be absolute or contain the '..' path. Must be utf-8 encoded. The first item of the relative path must not start with '..'
	Path string `json:"path" protobuf:"bytes,1,opt,name=path"`
	// Required: Selects a field of the pod: only annotations, labels, name and namespace are supported.
	// +optional
	FieldRef *ObjectFieldSelector `json:"fieldRef,omitempty" protobuf:"bytes,2,opt,name=fieldRef"`
	// Selects a resource of the container: only resources limits and requests
	// (limits.cpu, limits.memory, requests.cpu and requests.memory) are currently supported.
	// +optional
	ResourceFieldRef *ResourceFieldSelector `json:"resourceFieldRef,omitempty" protobuf:"bytes,3,opt,name=resourceFieldRef"`
	// Optional: mode bits used to set permissions on this file, must be an octal value
	// between 0000 and 0777 or a decimal value between 0 and 511.
	// YAML accepts both octal and decimal values, JSON requires decimal values for mode bits.
	// If not specified, the volume defaultMode will be used.
	// This might be in conflict with other options that affect the file
	// mode, like fsGroup, and the result can be other mode bits set.
	// +optional
	Mode *int32 `json:"mode,omitempty" protobuf:"varint,4,opt,name=mode"`
}

// ObjectFieldSelector selects an APIVersioned field of an object.
// +structType=atomic
type ObjectFieldSelector struct {
	// Version of the schema the FieldPath is written in terms of, defaults to "v1".
	// +optional
	APIVersion string `json:"apiVersion,omitempty" protobuf:"bytes,1,opt,name=apiVersion"`
	// Path of the field to select in the specified API version.
	FieldPath string `json:"fieldPath" protobuf:"bytes,2,opt,name=fieldPath"`
}

// ResourceFieldSelector represents container resources (cpu, memory) and their output format
// +structType=atomic
type ResourceFieldSelector struct {
	// Container name: required for volumes, optional for env vars
	// +optional
	ContainerName string `json:"containerName,omitempty" protobuf:"bytes,1,opt,name=containerName"`
	// Required: resource to select
	Resource string `json:"resource" protobuf:"bytes,2,opt,name=resource"`
	// Specifies the output format of the exposed resources, defaults to "1"
	// +optional
	Divisor resource.Quantity `json:"divisor,omitempty" protobuf:"bytes,3,opt,name=divisor"`
}

type Quantity struct {
	// i is the quantity in int64 scaled form, if d.Dec == nil
	i int64Amount
	// d is the quantity in inf.Dec form if d.Dec != nil
	d infDecAmount
	// s is the generated value of this quantity to avoid recalculation
	s string

	// Change Format at will. See the comment for Canonicalize for
	// more details.
	Format
}

// Format lists the three possible formattings of a quantity.
type Format string
```

在 SecretProjection 的定义中:
1. FieldRef: 可以获取 Pod 中的字段(仅支持注解、标签、名称和名字空间)
2. ResourceFieldRef: 可以获取选择容器的资源，目前仅支持资源限制与请求（limits.cpu、limits.memory、requests.cpu 和 requests.memory）

```
1. 使用fieldRef可以声明使用:
spec.nodeName - 宿主机名字
status.hostIP - 宿主机IP
metadata.name - Pod的名字
metadata.namespace - Pod的Namespace
status.podIP - Pod的IP
spec.serviceAccountName - Pod的Service Account的名字
metadata.uid - Pod的UID
metadata.labels['<KEY>'] - 指定<KEY>的Label值
metadata.annotations['<KEY>'] - 指定<KEY>的Annotation值
metadata.labels - Pod的所有Label
metadata.annotations - Pod的所有Annotation
```

Downward API 定义稍微有些复杂下面是一个示例:

```yaml

apiVersion: v1
kind: Pod
metadata:
  name: test-downwardapi-volume
  labels:
    zone: us-est-coast
    cluster: test-cluster1
    rack: rack-22
spec:
  containers:
    - name: client-container
      image: k8s.gcr.io/busybox
      command: ["sh", "-c"]
      args:
      - while true; do
          if [[ -e /etc/podinfo/labels ]]; then
            echo -en '\n\n'; cat /etc/podinfo/labels; fi;
          sleep 5;
        done;
      volumeMounts:
        - name: podinfo
          mountPath: /etc/podinfo
          readOnly: false
  volumes:
    - name: podinfo
      projected:
        sources:
        - downwardAPI:
            items:
              - path: "labels"
                fieldRef:
                  fieldPath: metadata.labels
# 当前 Pod 的 Labels 字段的值，就会被 Kubernetes 自动挂载成为容器里的 /etc/podinfo/labels 文件
```

### 1.4 ServiceAccountTokenProjection

[ServiceAccountTokenProjection](https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/api/core/v1/types.go#L1686) 定义如下:

```go
type ServiceAccountTokenProjection struct {
	// audience is the intended audience of the token. A recipient of a token
	// must identify itself with an identifier specified in the audience of the
	// token, and otherwise should reject the token. The audience defaults to the
	// identifier of the apiserver.
	// +optional
	Audience string `json:"audience,omitempty" protobuf:"bytes,1,rep,name=audience"`
	// expirationSeconds is the requested duration of validity of the service
	// account token. As the token approaches expiration, the kubelet volume
	// plugin will proactively rotate the service account token. The kubelet will
	// start trying to rotate the token if the token is older than 80 percent of
	// its time to live or if the token is older than 24 hours.Defaults to 1 hour
	// and must be at least 10 minutes.
	// +optional
	ExpirationSeconds *int64 `json:"expirationSeconds,omitempty" protobuf:"varint,2,opt,name=expirationSeconds"`
	// path is the path relative to the mount point of the file to project the
	// token into.
	Path string `json:"path" protobuf:"bytes,3,opt,name=path"`
}
```
ServiceAccountTokenProjection 中:
1. Path: 相对于令牌投射目标文件的挂载点的路径
2. Audience: 是令牌的目标受众，令牌的接收方必须用令牌受众中指定的一个标识符来标识自己，否则应拒绝此令牌。 受众默认为 apiserver 的标识符。
3. ExpirationSeconds: 是所请求的服务账号令牌的有效期。 当令牌即将到期时，kubelet 卷插件将主动轮换服务账号令牌。 如果令牌超过其生存时间的 80% 或令牌超过 24 小时，kubelet 将开始尝试轮换令牌。 默认为 1 小时且必须至少为 10 分钟。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
    name: nginx
    volumeMounts:
    - mountPath: /var/run/secrets/tokens
      name: vault-token
  serviceAccountName: build-robot
  volumes:
  - name: vault-token
    projected:
      sources:
      - serviceAccountToken:
          path: vault-token
          expirationSeconds: 7200
          audience: vault
```