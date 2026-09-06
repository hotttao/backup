

## Istio 部署完成检查

### 0. 本次安装命令

```shell
istioctl install \
  --set profile=ambient \
  --set values.global.platform=k3s \
  --skip-confirmation
```

该命令安装 Istio Ambient profile，包括 Istio CRD、`istiod`、`istio-cni-node` 和 `ztunnel`。
它不会自动给业务 namespace 加 Ambient 标签。

### 1. 查看控制面版本

```shell
istioctl version
```

正常情况下应同时看到 Client version 和 Control plane version。当前实验使用 Istio `1.31.0`。

### 2. 检查核心 Pod 是否 Ready

```shell
kubectl get pods -n istio-system -o wide
```

Ambient profile 的核心 Pod 预期如下：

| Pod | 类型 | 作用 | 完成条件 |
| --- | --- | --- | --- |
| `istiod-*` | Deployment | 控制面，向数据面下发配置并管理身份与证书 | `1/1 Running` |
| `istio-cni-node-*` | DaemonSet | 在每个节点配置 Ambient 流量重定向 | 每个节点一个 Pod，全部 `1/1 Running` |
| `ztunnel-*` | DaemonSet | 在每个节点承载 Ambient L4 流量、mTLS 和服务身份 | 每个节点一个 Pod，全部 `1/1 Running` |

也可以使用 rollout 检查工作负载：

```shell
kubectl -n istio-system rollout status deployment/istiod --timeout=180s
kubectl -n istio-system rollout status daemonset/istio-cni-node --timeout=180s
kubectl -n istio-system rollout status daemonset/ztunnel --timeout=180s
```

### 3. 查看部署了哪些组件

```shell
kubectl get deployment,daemonset,service -n istio-system
kubectl get serviceaccount,configmap,secret -n istio-system
```

```shell
$ kubectl get serviceaccount,configmap,secret -n istio-system
NAME                                          AGE
serviceaccount/default                        25h
serviceaccount/istio-cni                      25h
serviceaccount/istio-reader-service-account   25h
serviceaccount/istiod                         25h
serviceaccount/ztunnel                        25h

NAME                                            DATA   AGE
configmap/istio                                 2      25h
configmap/istio-ca-crl                          1      24h
configmap/istio-ca-root-cert                    1      24h
configmap/istio-cni-config                      18     25h
configmap/istio-ip-autoallocate                 0      24h
configmap/istio-leader                          0      24h
configmap/istio-namespace-controller-election   0      24h
configmap/istio-sidecar-injector                2      25h
configmap/kube-root-ca.crt                      1      25h
configmap/values                                2      25h

NAME                     TYPE               DATA   AGE
secret/istio-ca-secret   istio.io/ca-root   5      24h

```

这些命令可以看到：

| 组件 | 当前资源 | 作用 |
| --- | --- | --- |
| 控制面 | `Deployment/istiod`、`Service/istiod` | 管理配置、服务发现、工作负载身份和证书签发 |
| CNI | `DaemonSet/istio-cni-node` | 接入节点 CNI，在 Pod 创建时设置流量重定向 |
| Ambient 数据面 | `DaemonSet/ztunnel` | 处理节点上的服务间 L4 流量和 mTLS |
| 控制面访问 | `Service/istiod`、`Service/istiod-revision-tag-default` | 为数据面提供 xDS、CA 和控制面服务发现 |
| 服务账号 | `ServiceAccount/istiod`、`ServiceAccount/istio-cni` 等 | 为控制面和节点组件提供 Kubernetes 身份 |
| 配置与证书 | `ConfigMap`、`Secret` | 保存 Istio 配置、根证书和引导信息 |

`kubectl get all` 只能查看部分命名空间级资源，不能显示 CRD、ClusterRole、Webhook 等集群级资源。

### 4. 查看 Istio CRD 和 Webhook

```shell
> kubectl get crd | rg 'istio.io|extensions.istio.io'

authorizationpolicies.security.istio.io        2026-09-05T01:53:22Z
destinationrules.networking.istio.io           2026-09-05T01:53:21Z
envoyfilters.networking.istio.io               2026-09-05T01:53:21Z
gateways.networking.istio.io                   2026-09-05T01:53:21Z
peerauthentications.security.istio.io          2026-09-05T01:53:22Z
proxyconfigs.networking.istio.io               2026-09-05T01:53:21Z
requestauthentications.security.istio.io       2026-09-05T01:53:22Z
serviceentries.networking.istio.io             2026-09-05T01:53:21Z
sidecars.networking.istio.io                   2026-09-05T01:53:21Z
telemetries.telemetry.istio.io                 2026-09-05T01:53:22Z
trafficextensions.extensions.istio.io          2026-09-05T01:53:21Z
virtualservices.networking.istio.io            2026-09-05T01:53:22Z
wasmplugins.extensions.istio.io                2026-09-05T01:53:21Z
workloadentries.networking.istio.io            2026-09-05T01:53:22Z
workloadgroups.networking.istio.io             2026-09-05T01:53:22Z
```


```shell
> kubectl get validatingwebhookconfiguration,mutatingwebhookconfiguration | rg istio

validatingwebhookconfiguration.admissionregistration.k8s.io/istio-validator-istio-system            1          25h
validatingwebhookconfiguration.admissionregistration.k8s.io/istiod-default-validator                1          24h
mutatingwebhookconfiguration.admissionregistration.k8s.io/istio-revision-tag-default                  4          24h
mutatingwebhookconfiguration.admissionregistration.k8s.io/istio-sidecar-injector                      4          25h

```

CRD 用于让 Kubernetes API Server 识别 `AuthorizationPolicy`、`PeerAuthentication`、
`RequestAuthentication`、`VirtualService` 等 Istio 对象。Webhook 用于在相关资源变更时参与 Kubernetes
的校验或变更流程。

### 5. 检查 Istio 的 RBAC 资源

```shell
> kubectl get role,rolebinding -n istio-system
> kubectl get clusterrole,clusterrolebinding | rg istio
clusterrole.rbac.authorization.k8s.io/istio-cni                                                              2026-09-05T01:53:22Z
clusterrole.rbac.authorization.k8s.io/istio-cni-ambient                                                      2026-09-05T01:53:22Z
clusterrole.rbac.authorization.k8s.io/istio-cni-repair-role                                                  2026-09-05T01:53:22Z
clusterrole.rbac.authorization.k8s.io/istio-reader-clusterrole-istio-system                                  2026-09-05T01:53:22Z
clusterrole.rbac.authorization.k8s.io/istiod-clusterrole-istio-system                                        2026-09-05T01:53:22Z
clusterrole.rbac.authorization.k8s.io/istiod-gateway-controller-istio-system                                 2026-09-05T01:53:22Z
clusterrolebinding.rbac.authorization.k8s.io/istio-cni                                                       ClusterRole/istio-cni                                                       25h
clusterrolebinding.rbac.authorization.k8s.io/istio-cni-ambient                                               ClusterRole/istio-cni-ambient                                               25h
clusterrolebinding.rbac.authorization.k8s.io/istio-cni-repair-rolebinding                                    ClusterRole/istio-cni-repair-role                                           25h
clusterrolebinding.rbac.authorization.k8s.io/istio-reader-clusterrole-istio-system                           ClusterRole/istio-reader-clusterrole-istio-system                           25h
clusterrolebinding.rbac.authorization.k8s.io/istiod-clusterrole-istio-system                                 ClusterRole/istiod-clusterrole-istio-system                                 25h
clusterrolebinding.rbac.authorization.k8s.io/istiod-gateway-controller-istio-system                          ClusterRole/istiod-gateway-controller-istio-system                          25h
```

这些资源控制 `istiod`、`istio-cni` 和其他 Istio 组件能够读取或修改哪些 Kubernetes 对象。

本步骤只验证 Istio 控制面已经部署完成，不代表业务已经加入 Ambient。只有给目标 namespace 添加：

```shell
kubectl label namespace <namespace> istio.io/dataplane-mode=ambient
```

并重新创建或更新工作负载后，目标 Pod 的流量才会进入 Ambient 数据面。
