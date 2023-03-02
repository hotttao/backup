---
weight: 1
title: "Projected Volume"
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

深入解析 Pod 对象之使用进阶。作为 Kubernetes 项目里最核心的编排对象，Pod 携带的信息非常丰富。其中，资源定义（比如 CPU、内存等），以及调度相关的字段，会在后面调度器章节分析。接下来我们着重介绍 pod 的以下几个字段
1. volume
2. 容器健康检查和恢复机制

## 1. Volume
在 Kubernetes 中，有几种特殊的 Volume，它们存在的意义不是为了存放容器里的数据，也不是用来进行容器和宿主机之间的数据交换。这些特殊 Volume 的作用，是为容器提供预先定义好的数据。从容器的角度来看，这些 Volume 里的信息就是仿佛是被 Kubernetes“投射”（Project）进入容器当中的。所以它们被称作 Projected Volume(投射数据卷)。

Kubernetes 支持的 Projected Volume 一共有四种：
1. Secret；
2. ConfigMap；
3. Downward API；
4. ServiceAccountToken

### 1.1 Secret
Secret:
1. 作用: 把 Pod 想要访问的加密数据，存放到 Etcd 中。然后就可以通过在 Pod 的容器里挂载 Volume 的方式，访问到这些 Secret 里保存的信息了
2. 场景: 存放数据库的认证信息
3. 更新: 
	- 通过挂载方式进入到容器里的 Secret，一旦其对应的 Etcd 里的数据被更新，这些 Volume 里的文件内容，同样也会被更新
	- kubelet 组件在定时维护这些 Volume
	- 这个更新可能会有一定的延时。所以在编写应用程序时，在发起数据库连接的代码处写好重试和超时的逻辑，绝对是个好习惯。
4. 创建: kubectl create secret

#### Secret 创建和使用
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
    projected:              # volume 类型
      sources:              # 数据源
      - secret:             
          name: user        # Secret 名称
      - secret:
          name: pass
# 最终 user secret会以文件的方式保存在 /projected-volume/user

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

需要注意的是，Secret 对象要求这些数据必须是经过 Base64 转码的，以免出现明文密码的安全隐患。这个转码操作也很简单，比如：

```shell
$ echo -n 'admin' | base64
YWRtaW4=
$ echo -n '1f2d1e2e67df' | base64
MWYyZDFlMmU2N2Rm
```

需要注意的是，像这样创建的 Secret 对象，它里面的内容仅仅是经过了转码，而并没有被加密。在真正的生产环境中，你需要在 Kubernetes 中开启 Secret 的加密插件，增强数据的安全性。

#### Secret 命令行创建
Secret 也可以通过命令行的方式创建:

```shell
# 命令行创建 Secret

$ cat ./username.txt
admin
$ cat ./password.txt
c1oudc0w!

$ kubectl create secret generic user --from-file=./username.txt
$ kubectl create secret generic pass --from-file=./password.txt

$ kubectl get secrets
```

### 1.1 ConfigMap
ConfigMap
1. 作用: 与 Secret 类似，但保存的是不需要加密的、应用所需的配置信息
2. 创建: kubectl create configmap 从文件或者目录创建 ConfigMap

#### ConfigMap 创建
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

#### 命令行创建
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

### 1.3 Downward API
Downward API
1. 作用: 让 Pod 里的容器能够直接获取到这个 Pod API 对象本身的信息
2. 范围:
	- Downward API 能够获取到的信息，一定是 Pod 里的容器进程启动之前就能够确定下来的信息
	- 如果想要获取 Pod 容器运行后才会出现的信息，比如，容器进程的 PID，应该考虑在 Pod 里定义一个 sidecar 容器

Secret、ConfigMap，以及 Downward API 这三种 Projected Volume 定义的信息，大多还可以通过环境变量的方式出现在容器里。但是，通过环境变量获取这些信息的方式，不具备自动更新的能力。所以，一般情况下，我都建议你使用 Volume 文件的方式获取这些信息。

#### Downward API 使用示例

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

#### Downward API 支持的字段

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

2. 使用resourceFieldRef可以声明使用:
容器的CPU limit
容器的CPU request
容器的memory limit
容器的memory request
```

### 1.4 Service Account
Service Account
1. 作用: 
	- Service Account 是 Kubernetes 系统内置的一种“服务账户”，它是 Kubernetes 进行权限分配的对象
	- Service Account 的授权信息和文件，保存在它所绑定的一个特殊的 Secret 对象里的。这个特殊的 Secret 对象，叫作 ServiceAccountToken
	- 任何运行在 Kubernetes 集群上的应用，都必须使用这个 ServiceAccountToken 里保存的授权信息，也就是 Token，才可以合法地访问 API Server
	- 为了方便使用，Kubernetes 提供了一个默认“服务账户”（default Service Account）。并且，任何一个运行在 Kubernetes 里的 Pod，都可以直接使用这个默认的 Service Account，而无需显示地声明挂载
	- default Service Account 在容器内的路径是固定的，即：/var/run/secrets/kubernetes.io/serviceaccount

```shell
# kubectl describe pod nginx-deployment-bb48f7f4-4djf7
Name:         nginx-deployment-bb48f7f4-4djf7
Namespace:    default
Volumes:
  nginx-vol:
    Type:       EmptyDir (a temporary directory that shares a pod's lifetime)
    Medium:
    SizeLimit:  <unset>
  kube-api-access-2fp79:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
```
