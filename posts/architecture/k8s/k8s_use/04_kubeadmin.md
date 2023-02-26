---
weight: 1
title: "k8s 安装部署"
date: 2020-08-02T22:00:00+08:00
lastmod: 2020-08-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "k8s 安装部署"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

今天我们来介绍 k8s 的安装部署，为我们后面的学习做准备。作为一个分布式的复杂项目，k8s 的安装部署并不容易，我们将分别介绍两种 k8s 的部署方法:
1. kubeadmin: 实验环境的 k8s 部署
2. k8s ansible 部署: 线上环境的 k8s 部署

## 1. kubeadmin
kubeadmin 可以让用户通过这样两条指令完成一个 Kubernetes 集群的部署：

```shell

# 创建一个Master节点
$ kubeadm init

# 将一个Node节点加入到当前集群中
$ kubeadm join <Master节点的IP和端口>
```

### 1.1 kubeadmin 部署的原理
kubeadmin 使用 docker 来部署 k8s 的各个组件，但是由于 kubelet 在启动容器、配置容器网络、管理容器数据卷时，都需要直接操作宿主机，kubeadm 在 kubelet 的部署上做了妥协：把 kubelet 直接运行在宿主机上，然后使用容器部署其他的 Kubernetes 组件。

所以，你使用 kubeadm 的第一步，是在机器上手动安装 kubeadm、kubelet 和 kubectl 这三个二进制文件(执行 `yum install kubeadmin` 即可)。

### 1.2 kubeadm init 的工作流程
当你执行 kubeadm init 指令后，kubeadmin 会执行下面的一系列操作:
1. Preflight Checks，即一系列的检查工作，以确定这台机器可以用来部署 Kubernetes
2. 生成 Kubernetes 对外提供服务所需的各种证书和对应的目录，这些文件都放在 Master 节点的 **/etc/kubernetes/pki** 目录下
3. 证书生成后，kubeadm 接下来会为其他组件生成访问 kube-apiserver 所需的配置文件。这些文件的路径是：**/etc/kubernetes/xxx.conf**
4. 接下来，kubeadm 会为 Master 组件生成 Pod 配置文件。三个 Master 组件 kube-apiserver、kube-controller-manager、kube-scheduler，而它们都会被使用 Pod 的方式部署起来
5. 在上一步完成后，kubeadm 还会再生成一个 Etcd 的 Pod YAML 文件，用来通过同样的 Static Pod 的方式启动 Etcd
6. Master 容器启动后，kubeadm 会通过检查 localhost:6443/healthz 这个 Master 组件的健康检查 URL，等待 Master 组件完全运行起来
7. 在master 组件都启动后，kubeadm 就会为集群生成一个 bootstrap token，只要持有这个 token，任何一个安装了 kubelet 和 kubadm 的节点，都可以通过 kubeadm join 加入到这个集群当中。
8. 在 token 生成之后，kubeadm 会将 ca.crt 等 Master 节点的重要信息，通过 ConfigMap 的方式保存在 Etcd 当中，供后续部署 Node 节点使用。这个 ConfigMap 的名字是 cluster-info
9. kubeadm init 的最后一步，就是安装默认插件。Kubernetes 默认 kube-proxy 和 DNS 这两个插件是必须安装的。它们分别用来提供整个集群的服务发现和 DNS 功能。这两个插件也只是两个容器镜像而已，所以 kubeadm 只要用 Kubernetes 客户端创建两个 Pod 就可以了。

#### 证书文件 

```
$ /etc/kubernetes/pki
```
其中:
1. ca.crt/ca.key:
2. apiserver-kubelet-client.crt/apiserver-kubelet-client.key: kube-apiserver 访问 kubelet 的证书

#### 服务配置文件
```shell
$ ls /etc/kubernetes/
admin.conf  controller-manager.conf  kubelet.conf  scheduler.conf
```

这些文件里面记录的是，当前这个 Master 节点的服务器地址、监听端口、证书目录等信息。这样，对应的客户端（比如 scheduler，kubelet 等），可以直接加载相应的文件，使用里面的信息与 kube-apiserver 建立安全连接。

#### Pod Yaml 文件
在 Kubernetes 中，有一种特殊的容器启动方法叫做“Static Pod”。它允许你把要部署的 Pod 的 YAML 文件放在一个指定的目录里。这样，当这台机器上的 kubelet 启动时，它会自动检查这个目录，加载所有的 Pod YAML 文件，然后在这台机器上启动它们。

在 kubeadm 中，Master 组件的 YAML 文件会被生成在 **/etc/kubernetes/manifests** 路径下。

```shell
$ ls /etc/kubernetes/manifests/
etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

#### bootstrap token
为什么执行 kubeadm join 需要这样一个 token 呢？因为，任何一台机器想要成为 Kubernetes 集群中的一个节点，就必须在集群的 kube-apiserver 上注册。可是，要想跟 apiserver 打交道，这台机器就必须要获取到相应的证书文件（CA 文件）。可是，为了能够一键安装，我们就不能让用户去 Master 节点上手动拷贝这些文件。所以，kubeadm 至少需要发起一次“不安全模式”的访问到 kube-apiserver，从而拿到保存在 ConfigMap 中的 cluster-info（它保存了 APIServer 的授权信息）。而 bootstrap token，扮演的就是这个过程中的安全验证的角色。只要有了 cluster-info 里的 kube-apiserver 的地址、端口、证书，kubelet 就可以以“安全模式”连接到 apiserver 上，这样一个新的节点就部署完成了。

### 1.3 kubeadmin 参数配置
kubeadm 确实简单易用，可是我又该如何定制我的集群组件参数呢？荐你在使用 kubeadm init 部署 Master 节点时，使用下面这条指令，给 kubeadm 提供一个 YAML 文件，在这个配置文件里自定义 k8s 各个组件的启动参数:

```shell
$ kubeadm init --config kubeadm.yaml
```

[kubeadm.yaml](https://kubernetes.io/docs/reference/config-api/kubeadm-config.v1beta3/) 的内容参考如下:

```yaml
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
bootstrapTokens:
  - token: "9a08jv.c0izixklcxtmnze7"
    description: "kubeadm bootstrap token"
    ttl: "24h"
  - token: "783bde.3f89s0fje9f38fhf"
    description: "another bootstrap token"
    usages:
      - authentication
      - signing
    groups:
      - system:bootstrappers:kubeadm:default-node-token
nodeRegistration:
  name: "ec2-10-100-0-1"
  criSocket: "/var/run/dockershim.sock"
  taints:
    - key: "kubeadmNode"
      value: "someValue"
      effect: "NoSchedule"
  kubeletExtraArgs:
    v: 4
  ignorePreflightErrors:
    - IsPrivilegedUser
  imagePullPolicy: "IfNotPresent"
localAPIEndpoint:
  advertiseAddress: "10.100.0.1"
  bindPort: 6443
certificateKey: "e6a2eb8581237ab72a4f494f30285ec12a9694d750b9785706a83bfcbbbd2204"
skipPhases:
  - addon/kube-proxy
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
etcd:
  # one of local or external
  local:
    imageRepository: "registry.k8s.io"
    imageTag: "3.2.24"
    dataDir: "/var/lib/etcd"
    extraArgs:
      listen-client-urls: "http://10.100.0.1:2379"
    serverCertSANs:
      -  "ec2-10-100-0-1.compute-1.amazonaws.com"
    peerCertSANs:
      - "10.100.0.1"
  # external:
    # endpoints:
    # - "10.100.0.1:2379"
    # - "10.100.0.2:2379"
    # caFile: "/etcd/kubernetes/pki/etcd/etcd-ca.crt"
    # certFile: "/etcd/kubernetes/pki/etcd/etcd.crt"
    # keyFile: "/etcd/kubernetes/pki/etcd/etcd.key"
networking:
  serviceSubnet: "10.96.0.0/16"
  podSubnet: "10.244.0.0/24"
  dnsDomain: "cluster.local"
kubernetesVersion: "v1.21.0"
controlPlaneEndpoint: "10.100.0.1:6443"
apiServer:
  extraArgs:
    authorization-mode: "Node,RBAC"
  extraVolumes:
    - name: "some-volume"
      hostPath: "/etc/some-path"
      mountPath: "/etc/some-pod-path"
      readOnly: false
      pathType: File
  certSANs:
    - "10.100.1.1"
    - "ec2-10-100-0-1.compute-1.amazonaws.com"
  timeoutForControlPlane: 4m0s
controllerManager:
  extraArgs:
    "node-cidr-mask-size": "20"
  extraVolumes:
    - name: "some-volume"
      hostPath: "/etc/some-path"
      mountPath: "/etc/some-pod-path"
      readOnly: false
      pathType: File
scheduler:
  extraArgs:
    address: "10.100.0.1"
  extraVolumes:
    - name: "some-volume"
      hostPath: "/etc/some-path"
      mountPath: "/etc/some-pod-path"
      readOnly: false
      pathType: File
certificatesDir: "/etc/kubernetes/pki"
imageRepository: "registry.k8s.io"
clusterName: "example-cluster"
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
# kubelet specific options here
---
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
# kube-proxy specific options here
```

kubeadm 就会使用 kubeadm.yaml 中的信息替换 /etc/kubernetes/manifests/ 里对应服务的 pod yaml 文件。kubeadmin.yaml 支持的参数参见 k8s 的[文档](https://kubernetes.io/zh/docs/setup/production-environment/tools/kubeadm/control-plane-flags/)。

kubeadm 的源代码，直接就在 kubernetes/cmd/kubeadm 目录下，是 Kubernetes 项目的一部分。其中，app/phases 文件夹下的代码，对应的就是我在这篇文章中详细介绍的每一个具体步骤。

kubeadm 目前应该已经具备一键部署一个高可用的 Kubernetes 集群，即：Etcd、Master 组件都应该是多节点集群，而不是现在这样的单点。可参考文档[Creating Highly Available Clusters with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/)。除了 kubadmin 目前有多种安装 k8s 的方式:

|工具|适用|原理|推荐指数|
|:---|:---|:---|:---|
|[kops](https://github.com/kubernetes/kops)|生产环境|||
|[kubeasz](https://github.com/gjmzj/kubeasz) |生产环境|ansible||
|[kubespray](https://imroc.cc/kubernetes/deploy/kubespray/index.html)|生产环境|ansible||
|[Rancher](https://rancher.com/docs/rancher/latest/zh/)|生产环境||标准|
|[kubeadm](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/)|生产/学习||推荐|
|[kind](https://github.com/kubernetes-sigs/kind)|单机安装|||
|[minikube](https://github.com/kubernetes/minikube)|单机安装|||


## 2. kubadmin 安装 k8s 
使用 kubadmin 安装 k8s 分成如下几个步骤:
1. 在所有节点上安装 Docker 和 kubeadm；
2. 部署 Kubernetes Master；
3. 部署容器网络插件；
4. 部署 Kubernetes Worker
5. 部署 Dashboard 可视化插件；
6. 部署容器存储插件

### 2.1 安装 Docker 和 kubeadm；
#### 准备 yum 源
首先准备 yum 源安装 Docker 和 kubeadmin

```bash
# docker-ce 源
yum install -y yum-utils
yum-config-manager \
  --add-repo \
  https://download.docker.com/linux/centos/docker-ce.repo

# kubernetes 源
cat <<EOF | tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-\$basearch
enabled=1
gpgcheck=1
gpgkey=https://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
EOF
```

#### 系统参数配置
```bash
# Set SELinux in permissive mode (effectively disabling it)
# Set SELinux in permissive mode (effectively disabling it)
setenforce 0
sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

sysctl -w net.bridge.bridge-nf-call-ip6tables=1
sysctl -w net.bridge.bridge-nf-call-iptables=1
iptables -F

systemctl stop firewalld.service
```

#### 安装配置相关组件
```bash
# 安装相关组件
set -e
# 安装相关组件
yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
```

#### 启动服务
```bash
# 配置 kuberneters 不受 swap 分区的影响
sed -i 's@KUBELET_EXTRA_ARGS=$@KUBELET_EXTRA_ARGS="--fail-swap-on=false"@' /etc/sysconfig/kubelet

# 设置 docker kubelet 开机自启动
# 设置 docker kubelet 开机自启动
systemctl enable --now docker kubelet
# systemctl restart docker kubelet
```

#### 生成 kubeadm 默认配置文件
```bash
#!/bin/bash
# 作用: 生成 kubeadm 的默认配置文件

set -e
SHELL_PATH=`readlink -f $0`
PROJECT_ROOT=$(dirname  $SHELL_PATH)

kubeadm config print init-defaults > $PROJECT_ROOT/kubeadm_default.yaml
```



#### 准备 kubeadm 所需镜像
```bash
set -e
SHELL_PATH=`readlink -f $0`
PROJECT_ROOT=$(dirname  $SHELL_PATH)

# # 查看需要安装的镜像
# kubeadm config images list

# pull 镜像
# kubeadm.yaml 是在上面 kubeadm_default.yaml 修改而来，添加了部分自定义参数，详细内容见下
kubeadm config images pull --config $PROJECT_ROOT/kubeadm.yaml

# 重命名镜像
for i in `kubeadm config images list`; do
    image_aliyun=`echo "$i" |sed 's@registry.k8s.io@registry.cn-hangzhou.aliyuncs.com/google_containers@'`
    image_aliyun=`echo "$image_aliyun"| sed 's@coredns/@@'`
    echo "===================================="
    echo "sudo docker pull $image_aliyun"
    docker pull $image_aliyun
    docker tag $image_aliyun $i
done

```

### 2.2 初始化 Master 节点
首先我们为 kubadmin 准备一个配置文件: 

```yaml
apiVersion: kubeadm.k8s.io/v1beta3
bootstrapTokens:
- groups:
  - system:bootstrappers:kubeadm:default-node-token
  token: abcdef.0123456789abcdef
  ttl: 24h0m0s
  usages:
  - signing
  - authentication
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: 1.2.3.4
  bindPort: 6443
nodeRegistration:
  criSocket: unix:///var/run/containerd/containerd.sock
  imagePullPolicy: IfNotPresent
  name: node
  taints: null
  
---
apiServer:
  timeoutForControlPlane: 4m0s
apiVersion: kubeadm.k8s.io/v1beta3
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
controllerManager: {}
dns: {}
etcd:
  local:
    dataDir: /var/lib/etcd
imageRepository: registry.cn-hangzhou.aliyuncs.com/google_containers
kind: ClusterConfiguration
kubernetesVersion: 1.26.0
networking:
  dnsDomain: cluster.local
  serviceSubnet: 10.96.0.0/12
scheduler: {}

---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
# kubelet specific options here
cgroupDriver: systemd

```
然后我们只需要下面的命令就可以完成 master 节点的部署。

```bash
$ kubeadm init --config kubeadm.yaml

# 运行完成之后，会提示将 Node 节点加入集群的命令
kubeadm join 192.168.1.106:6443 --token z5fqxu.dn3awhi0u5n2i6eb --discovery-token-ca-cert-hash sha256:dc333a8af6ee0c7cd1e180b43251800685b90d6338929fa508e42f76579ce50c

# 按照初始化后的提示，创建一个普通用户，并复制相应文件
# user: kubernetes
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g)  $HOME/.kube/config

# 测试
kubectl get cs
kubectl get nodes
kubectl get pods -n kube-system
kubectl get ns

```

需要这些配置命令的原因是：Kubernetes 集群默认需要加密方式访问。所以，这几条命令，就是将刚刚部署生成的 Kubernetes 集群的安全配置文件，保存到当前用户的.kube 目录下，kubectl 默认会使用这个目录下的授权信息访问 Kubernetes 集群。如果不这么做的话，我们每次都需要通过 export KUBECONFIG 环境变量告诉 kubectl 这个安全配置文件的位置。

### 2.3 部署网络组件
初始化 Master 还有非常重要的一步，就是部署网络组件，否则各个 pod 等组件之间是无法通信的
```bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/bc79dd1505b0c8681ece4de4c0d86c5cd2643275/Documentation/kube-flannel.yml

kubectl get pods -n kube-system
```

### 2.4 部署 Worker 节点
相比与 Master Worker 节点的部署只需要两步即可完成:
1. 安装 kubeadm 和 Docker
2. 执行 Master 初始化后输出的 kubadmin join 命令

### 2.5 调整 Master 执行 Pod 的策略
默认情况下 Master 节点是不允许运行用户 Pod 的。而 Kubernetes 做到这一点，依靠的是 Kubernetes 的 Taint/Toleration 机制:
1. 某个节点可以被加上了一个 Taint
2. 一旦某个节点被加上了一个 Taint，即被“打上了污点”，那么所有 Pod 就都不能在这个节点上运行
2. 除非，Pod 声明自己能“容忍”这个“污点”，即声明了 Toleration 才能调度到有 Taint 污点的节点上运行

#### taint 命令
为节点打上“污点”（Taint）的命令是：

```bash
kubectl taint nodes node1 foo=bar:NoSchedule
```

其中值里面的 NoSchedule，意味着这个 Taint 只会在调度新 Pod 时产生作用，而不会影响已经在 node1 上运行的 Pod，哪怕它们没有 Toleration。

#### 声明 Toleration
声明 Toleration 只要在 Pod 的.yaml 文件中的 spec 部分，加入 tolerations 字段即可：

```yaml
apiVersion: v1
kind: Pod
...
spec:
  tolerations:
  - key: "foo"
    operator: "Equal"
    value: "bar"
    effect: "NoSchedule"
```

这个 Toleration 的含义是，这个 Pod 能“容忍”所有键值对为 foo=bar 的 Taint（ operator: “Equal”，“等于”操作）。

#### master 节点去污点
回到搭建的集群上，kubectl describe 可以查看 Master 节点的 Taint 字段:

```bash
$ kubectl describe node master

Name:               master
Roles:              master
Taints:             node-role.kubernetes.io/master:NoSchedule
```
你可以在像下面一样，在 pod 声明 Toleration 容忍这个污点:

```yaml
apiVersion: v1
kind: Pod
...
spec:
  tolerations:
  - key: "node-role.kubernetes.io/master"
    operator: "Exists"
    effect: "NoSchedule"
```

或者是删除这个污点，让 master 可以被调度执行 pod

```bash
$ kubectl taint nodes --all node-role.kubernetes.io/master-
```

短横线“-”，意味着移除所有以“node-role.kubernetes.io/master”为键的 Taint。

### 2.6 部署 Dashboard 可视化插件
```bash
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-rc6/aio/deploy/recommended.yaml

$ kubectl get pods -n kube-system
```

1.7 版本之后的 Dashboard 项目部署完成后，默认只能通过 Proxy 的方式在本地访问，想要直接访问，具体的操作，你可以查看 Dashboard 项目的[官方文档](https://github.com/kubernetes/dashboard)。

### 2.7 部署容器存储插件
容器的持久化存储，就是用来保存容器存储状态的重要手段：存储插件会在容器里挂载一个基于网络或者其他机制的远程数据卷，使得在容器里创建的文件，实际上是保存在远程存储服务器上，或者以分布式的方式保存在多个节点上，而与当前宿主机没有任何绑定关系。这样，无论你在其他哪个宿主机上启动新的容器，都可以请求挂载指定的持久化存储卷，从而访问到数据卷里保存的内容。这就是“持久化”的含义。

绝大多数存储项目，比如 Ceph、GlusterFS、NFS 等，都可以为 Kubernetes 提供持久化存储能力。在这次的部署实战中，我会选择部署一个很重要的 Kubernetes 存储插件项目：Rook。

Rook 项目是一个基于 Ceph 的 Kubernetes 存储插件（它后期也在加入对更多存储实现的支持）。不过，不同于对 Ceph 的简单封装，Rook 在自己的实现中加入了水平扩展、迁移、灾难备份、监控等大量的企业级功能，使得这个项目变成了一个完整的、生产级别可用的容器存储插件。

整个部署过程也很简单:

```bash

$ kubectl apply -f https://raw.githubusercontent.com/rook/rook/master/cluster/examples/kubernetes/ceph/common.yaml
$ kubectl apply -f https://raw.githubusercontent.com/rook/rook/master/cluster/examples/kubernetes/ceph/operator.yaml
$ kubectl apply -f https://raw.githubusercontent.com/rook/rook/master/cluster/examples/kubernetes/ceph/cluster.yaml

$ kubectl get pods -n rook-ceph-system
$ kubectl get pods -n rook-ceph
```
部署完成后，接下来在 Kubernetes 项目上创建的所有 Pod 就能够通过 Persistent Volume（PV）和 Persistent Volume Claim（PVC）的方式，在容器里挂载由 Ceph 提供的数据卷了。

得益于对 k8s 诸如 Operator、CRD 等重要的扩展特性的使用，使得 Rook 项目，成为了目前社区中基于 Kubernetes API 构建的最完善也最成熟的容器存储插件。这也正是开发和使用 Kubernetes 的重要指导思想，即：基于 Kubernetes 开展工作时，你一定要优先考虑这两个问题：
1. 我的工作是不是可以容器化？
2. 我的工作是不是可以借助 Kubernetes API 和可扩展机制来完成？

如果能够基于 Kubernetes 实现容器化，那么将大大降低我们的 运维工作。

### 2.8 k8s 集群重至
如果配置过程中出现了错误，想重新配置集群， 可以使用 `kubeadm reset` 对整个集群进行重至，然后重新使用 `kubeadm init` 进行初始化创建。但是需要注意的时，`kubeadm reset` 不会重至 flannel 网络，想要完全重至可使用以下脚本


```bash
#!/bin/bash
kubeadm reset
systemctl stop kubelet
systemctl stop docker
rm -rf /var/lib/cni/
rm -rf /var/lib/kubelet/*
rm -rf /etc/cni/
ifconfig cni0 down
ifconfig flannel.1 down
ifconfig docker0 down
ip link delete cni0
ip link delete flannel.1
systemctl start docker
```
