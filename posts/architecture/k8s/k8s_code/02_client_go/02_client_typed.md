---
weight: 1
title: "client-go 资源操作对象"
date: 2023-03-01T22:00:00+08:00
lastmod: 2023-03-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "client-go 基础抽象"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---

## 1. 资源操作对象
kubernetes 资源对象是区分组和版本的，对于不同组和不同版本下的资源有不同的操作对象定义，在源码结构里资源操作对象如下：

![资源操作对象](/images/k8s/k8s_code/client_typed.png)

### 1.1 资源操作对象的定义

按照 GVK 的定义层级，资源层操作对象也有三层聚合层级:
1. K 对应某一个具体资源操作对象定义，比如图中的 deployment.go
2. V 对应同一组下相同版本资源操作对象工厂，比如图中 apps_client.go 
3. G 没有 group 组对应的聚合对象，k8s 将所有的 gv 收集在 client-go/kubernetes/clientset.go 的 Clientset 对象中。

## 2. apps/v1 
### 2.1 deployment 操作对象
![apps/v1](/images/k8s/k8s_code/app_v1.png)

我们以 apps 组下的 v1 版本中的 deployment 资源为例，介绍该资源的操作对象。每个资源的操作对象都会定义如下三个对象:
1. DeploymentInterface 接口定义了对于该资源的所有操作
2. deployments 
    - 实现了上面定义的接口，是实际的资源操作对象
    - 封装了 rest.Interface 接口类型对象，也就是前面介绍的 RESTClient 对象实现的接口。同时也封装了 namespace 信息，表示被操作的资源属于哪个命名空间
3. DeploymentGetter 接口定义了获取该资源的操作对象，可以认为是源的操作对象对应的工厂方法。

```go
type DeploymentInterface interface {}

type deployments struct {}

type DeploymentsGetter interface {}
```


### 2.2 apps/v1 聚合对象
apps 组下的 v1 版本中所有的资源操作对象都聚合在 AppsV1Client 下:

```go
// client-go/kubernetes/typed/apps/v1/apps_client.go
type AppsV1Interface interface {
  RESTClient() rest.Interface
  ControllerRevisionsGetter
  DaemonSetsGetter
  DeploymentsGetter
  ReplicaSetsGetter
  StatefulSetsGetter
}

type AppsV1Client struct {
  restClient rest.Interface
}
```

其中:
1. AppsV1Interface 接口
    - 封装了该组的版本下所有资源操作对象的工厂方法
    - 也封装了之前文章介绍的 rest.Interface 接口
2. AppsV1Client 结构体实现了 AppsV1Interface

### 2.3 AppsV1Client 的实例化
AppsV1Client 的实例化代码如下:

```go
// client-go/kubernetes/typed/apps/v1/apps_client.go
func NewForConfig(c *rest.Config) (*AppsV1Client, error) {
	config := *c
	if err := setConfigDefaults(&config); err != nil {
		return nil, err
	}
	httpClient, err := rest.HTTPClientFor(&config)
	if err != nil {
		return nil, err
	}
	return NewForConfigAndClient(&config, httpClient)
}

// NewForConfigAndClient creates a new AppsV1Client for the given config and http client.
// Note the http client provided takes precedence over the configured transport values.
func NewForConfigAndClient(c *rest.Config, h *http.Client) (*AppsV1Client, error) {
	config := *c
	if err := setConfigDefaults(&config); err != nil {
		return nil, err
	}
	client, err := rest.RESTClientForConfigAndClient(&config, h)
	if err != nil {
		return nil, err
	}
	return &AppsV1Client{client}, nil
}

func setConfigDefaults(config *rest.Config) error {
	gv := v1.SchemeGroupVersion
	config.GroupVersion = &gv
	config.APIPath = "/apis"
	config.NegotiatedSerializer = scheme.Codecs.WithoutConversion()

	if config.UserAgent == "" {
		config.UserAgent = rest.DefaultKubernetesUserAgent()
	}

	return nil
}
```

可以看到在构造 rest.Config 对象的时候会用到之前文章中介绍的 schema 对象，该对象中注册了所有的 kubernetes 资源以及提供相应的对象创建，版本转化，序列化反序列化等系列功能。

## 3. Clientset
Clientset 位于 client-go/kubernetes/clientset.go 是所有类似 AppsV1Client 的工厂。

```go
type Interface interface {
	Discovery() discovery.DiscoveryInterface
	...
	InternalV1alpha1() internalv1alpha1.InternalV1alpha1Interface
	AppsV1() appsv1.AppsV1Interface
    ...
}

type Clientset struct {
	*discovery.DiscoveryClient
	admissionregistrationV1       *admissionregistrationv1.AdmissionregistrationV1Client
	admissionregistrationV1alpha1 *admissionregistrationv1alpha1.AdmissionregistrationV1alpha1Client
	admissionregistrationV1beta1  *admissionregistrationv1beta1.AdmissionregistrationV1beta1Client
	internalV1alpha1              *internalv1alpha1.InternalV1alpha1Client
	appsV1                        *appsv1.AppsV1Client
}

func (c *Clientset) AppsV1() appsv1.AppsV1Interface {
	return c.appsV1
}
```
