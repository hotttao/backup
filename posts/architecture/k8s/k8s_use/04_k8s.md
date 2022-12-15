---
weight: 1
title: "Pod 进阶"
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

## 2.容器健康检查和恢复机制
在 Kubernetes 中，你可以为 Pod 里的容器定义一个健康检查“探针”（Probe）。这样，kubelet 就会根据这个 Probe 的返回值决定这个容器的状态，而不是直接以容器镜像是否运行（来自 Docker 返回的信息）作为依据。这种机制，是生产环境中保证应用健康存活的重要手段。

### 2.1 健康检查

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
```
这里  livenessProbe（健康检查）的类型是 exec，这意味着，它会在容器启动后，在容器里面执行一条我们指定的命令。

livenessProbe 除了 exec 还可以定义为发起 HTTP 或者 TCP 请求:

```yaml

...
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
### 2.2 恢复机制
Pod 恢复机制，也叫 restartPolicy。它是 Pod 的 Spec 部分的一个标准字段（pod.spec.restartPolicy），默认值是 Always，即：任何时候这个容器发生了异常，它一定会被重新创建。

定要强调的是，Pod 的恢复过程，永远都是发生在当前节点上，而不会跑到别的节点上去。事实上，一旦一个 Pod 与一个节点（Node）绑定，除非这个绑定发生了变化（pod.spec.node 字段被修改），否则它永远都不会离开这个节点。这也就意味着，如果这个宿主机宕机了，这个 Pod 也不会主动迁移到其他节点上去。而如果你想让 Pod 出现在其他的可用节点上，就必须使用 Deployment 这样的“控制器”来管理 Pod。

restartPolicy 的可选值包括：
1. Always：在任何情况下，只要容器不在运行状态，就自动重启容器；
2. OnFailure: 只在容器 异常时才自动重启容器；
3. Never: 从来不重启容器。

如果你要关心这个容器退出后的上下文环境，比如容器退出后的日志、文件和目录，就需要将 restartPolicy 设置为 Never。因为一旦容器被自动重新创建，这些内容就有可能丢失掉了（被垃圾回收了）。

#### restartPolicy 与容器状态的关系
Kubernetes 的官方文档，把 restartPolicy 和 Pod 里容器的状态，以及 Pod 状态的对应关系，[总结了非常复杂的一大堆情况](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#example-states)。但总体的设计原则是:
1. 只要 Pod 的 restartPolicy 指定的策略允许重启异常的容器（比如：Always），那么这个 Pod 就会保持 Running 状态，并进行容器重启。否则，Pod 就会进入 Failed 状态 。
2. 对于包含多个容器的 Pod，只有它里面所有的容器都进入异常状态后，Pod 才会进入 Failed 状态。在此之前，Pod 都是 Running 状态。此时，Pod 的 READY 字段会显示正常容器的个数

所以，假如一个 Pod 里只有一个容器，然后这个容器异常退出了。那么，只有当 restartPolicy=Never 时，这个 Pod 才会进入 Failed 状态。而其他情况下，由于 Kubernetes 都可以重启这个容器，所以 Pod 的状态保持 Running 不变。

而如果这个 Pod 有多个容器，仅有一个容器异常退出，它就始终保持 Running 状态，哪怕即使 restartPolicy=Never。只有当所有容器也异常退出之后，这个 Pod 才会进入 Failed 状态。

### 2.3 readinessProbe
readinessProbe 用法与 livenessProbe 类似，但作用却大不一样。readinessProbe 检查结果的成功与否，决定的这个 Pod 是不是能被通过 Service 的方式访问到，而并不影响 Pod 的生命周期。


## 3.PodPreset
PodPreset 可以自动给对应的 Pod 对象加上其他必要的信息。比如下面的 PodPreset 

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