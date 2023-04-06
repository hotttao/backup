---
weight: 1
title: "API 接口注册"
date: 2023-03-06T22:00:00+08:00
lastmod: 2023-03-06T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "kube-apiserver schema api 对象元数据管理"
featuredImage: 

tags: ["k8s"]
categories: ["architecture"]

lightgallery: true

---
k8s选用的Restful框架是go-restful，所有的 API 对象操作最终都需要注册为 go-restful 中的接口。接下来我们就来看看 kubernetes 中 API 对象的接口是如何注册的。

## 1. API 的接口抽象
从 kubernetes 相关资源 API 的数据结构角度上看，主要包括三个结构体
1. APIGroupInfo 结构体: 定义了具体某一个资源组 API 的相关信息
2. APIGroupVersion 结构体: 定义了某一个资源组下的某一个具体版本 API 的相关信息
3. APIInstaller 结构体: 辅助完成资源到 REST API 的注册

|数据结构|定义位置|
|:---|:---|
|APIGroupInfo|k8s.io/apiserver/pkg/server/genericapiserver.go|
|APIGroupVersion|k8s.io/apiserver/pkg/endpoints/groupversion.go|
|APIInstaller|k8s.io/apiserver/pkg/endpoints/installer.go|

其中 APIGroupInfo 是连接 API Rest 与 APIInstall 的关键。

## 2. APIGroupInfo
### 2.1 APIGroupInfo 定义
在 APIGroupInfo 的定义中:
1. PrioritizedVersions 代表某一组下资源所有的版本。
2. VersionedResourcesStorageMap: 映射该组下某一个具体版本对应的资源操作实例
    - key 为具体的版本的名称，例如 v1/v1beta1 等版本。
    - value 则为另外一个 map 
        - 在此 map 中 key 为该版本里某一个具体的资源的名称，例如常见资源 depployment/demonset 等
        - value 则为在以前文章中我们介绍的资源操作接口 rest.Storage 类型
2. Scheme: 前面介绍的 Schema，hold 各种资源注册在其中。
3. NegotiatedSerializer: 即前面介绍的 Codec，完成资源的序列化和反序列化。

```go
type APIGroupInfo struct {
    PrioritizedVersions []schema.GroupVersion
    // 存储在此 API 组中的资源信息，是一个从版本到资源到存储的映射。
    VersionedResourcesStorageMap map[string]map[string]rest.Storage
    // OptionsExternalVersion 控制模式中用于 api.Status、api.DeleteOptions 和 metav1.ListOptions 等通用对象的 APIVersion。
    // 其他实现者可以定义版本 "v1beta1"，但希望使用 Kubernetes 内部对象的 "v1" 版本。
    // 如果为 nil，则默认为 groupMeta.GroupVersion。
    // TODO: 当 https://github.com/kubernetes/kubernetes/issues/19018 修复后，移除此字段。
    OptionsExternalVersion *schema.GroupVersion
    // MetaGroupVersion 默认为 "meta.k8s.io/v1"，是用于解码 ListOptions 等常见 API 实现的模式组版本。
    // 未来的更改将允许此版本因组版本而异（为了当必不可少的 meta/v2 组出现时）。
    MetaGroupVersion *schema.GroupVersion
    // Scheme 包括此组使用的所有类型以及如何在它们之间进行转换（或将在此 API 中接受的外部对象转换为对象）。
    // TODO：替换为接口
    Scheme *runtime.Scheme
    // NegotiatedSerializer 控制此组如何对数据进行编码和解码
    NegotiatedSerializer runtime.NegotiatedSerializer
    // ParameterCodec 执行传递给 API 调用的查询参数的转换
    ParameterCodec runtime.ParameterCodec

    // StaticOpenAPISpec 是从一起安装的所有资源的定义派生的规范。
    // 它在 InstallAPIGroups、InstallAPIGroup 和 InstallLegacyAPIGroup 期间设置。
    StaticOpenAPISpec *spec.Swagger
}
```

kubernetes 的资源分为核心组资源和非核心组资源。那么一定会有非核心资源组的 APIGroupInfo 结构体和核心资源组的 APIGroupInfo 结构，他们定义在:

|资源|APIGroup定义位置|
|:---|:---|
|非核心组|![apps 组 APIGroupInfo ](/images/k8s/k8s_use/apps_apigroupinfo.png)|
|核心组|![core APIGroupInfo ](/images/k8s/k8s_use/core_apigroupinfo.png)|

### 2.2 非核心资源组 APIGroupInfo 的创建

这里我们以 apps 资源组为例，看看非核心资源组 APIGroupInfo 结构体的创建:

```go
// pkg/registry/apps/rest/storage_apps.go

// 1. 源文件中定义结构体 StorageProvider 用来实现 APIGroupInfo 的创建逻辑。
// StorageProvider is a struct for apps REST storage.
type StorageProvider struct{}

// 2. NewRESTStorage 方法用来创建 APIGroupInfo 结构体实例
// NewRESTStorage returns APIGroupInfo object.
func (p StorageProvider) NewRESTStorage(apiResourceConfigSource serverstorage.APIResourceConfigSource, restOptionsGetter generic.RESTOptionsGetter) (genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(apps.GroupName, legacyscheme.Scheme, legacyscheme.ParameterCodec, legacyscheme.Codecs)
	// 如果你在这里添加了一个版本，一定要在' k8s.io/kubernetes/cmd/kube-apiserver/app/aggregator中添加一个条目。要有明确的优先级。
	// TODO refactor the plumbing to provide the information in the APIGroupInfo

	if storageMap, err := p.v1Storage(apiResourceConfigSource, restOptionsGetter); err != nil {
		return genericapiserver.APIGroupInfo{}, err
	} else if len(storageMap) > 0 {
		apiGroupInfo.VersionedResourcesStorageMap[appsapiv1.SchemeGroupVersion.Version] = storageMap
	}

	return apiGroupInfo, nil
}

func (p StorageProvider) v1Storage(apiResourceConfigSource serverstorage.APIResourceConfigSource, restOptionsGetter generic.RESTOptionsGetter) (map[string]rest.Storage, error) {
	storage := map[string]rest.Storage{}

	// deployments
    // 3. 根据是否开启不同版本的配置来调用子方法，生成不同版本资源的 API 信息。
	if resource := "deployments"; apiResourceConfigSource.ResourceEnabled(appsapiv1.SchemeGroupVersion.WithResource(resource)) {
        // 4. 返回一个 DeploymentStorage
		deploymentStorage, err := deploymentstore.NewStorage(restOptionsGetter)
		if err != nil {
			return storage, err
		}
        // 资源的名称格式统一定义为 ${resource-name} 
        // 或者是 ${resource-name}/${sub-resource-name}
		storage[resource] = deploymentStorage.Deployment
		storage[resource+"/status"] = deploymentStorage.Status
		storage[resource+"/scale"] = deploymentStorage.Scale
	}

	// statefulsets
    return storage, nil
}
```

NewDefaultAPIGroupInfo 返回一个空的 APIGroupInfo。
```go
// k8s.io/apiserver/pkg/server/genericapiserver.go

// NewDefaultAPIGroupInfo 返回一个带有“正常”值的APIGroupInfo，以便从其他包中更容易地组合
func NewDefaultAPIGroupInfo(group string, scheme *runtime.Scheme, parameterCodec runtime.ParameterCodec, codecs serializer.CodecFactory) APIGroupInfo {
	return APIGroupInfo{
		PrioritizedVersions:          scheme.PrioritizedVersionsForGroup(group),
		VersionedResourcesStorageMap: map[string]map[string]rest.Storage{},
		// TODO unhardcode this.  It was hardcoded before, but we need to re-evaluate
		OptionsExternalVersion: &schema.GroupVersion{Version: "v1"},
		Scheme:                 scheme,
		ParameterCodec:         parameterCodec,
		NegotiatedSerializer:   codecs,
	}
}
```

deploymentstore.NewStorage 返回了 DeploymentStorage，这个 DeploymentStorage Deployment 以及其所有子资源 REST 的一个集合:

```go
type DeploymentStorage struct {
	Deployment *REST
	Status     *StatusREST
	Scale      *ScaleREST
	Rollback   *RollbackREST
}

func NewStorage(optsGetter generic.RESTOptionsGetter) (DeploymentStorage, error) {
	// NewREST 就是我们前面介绍的 NewREST 返回资源的 Rest 示例
    deploymentRest, deploymentStatusRest, deploymentRollbackRest, err := NewREST(optsGetter)
	if err != nil {
		return DeploymentStorage{}, err
	}

	return DeploymentStorage{
		Deployment: deploymentRest,
		Status:     deploymentStatusRest,
		Scale:      &ScaleREST{store: deploymentRest.Store},
		Rollback:   deploymentRollbackRest,
	}, nil
}
```

### 2.3 核心资源组 APIGroupInfo 的创建
核心资源组 APIGroupInfo 在 pkg/registry/core/rest/storage_core.go 文件中定义：
1. 定义结构体 LegacyRESTStorageProvider 主要用来实现 APIGroupInfo 的创建逻辑。
2. LegacyRESTStorageProvider.NewLegacyRESTStorage() 方法创建 APIGroupInfo 实例， 代表核心组中所有资源的 API 信息。

```go
type LegacyRESTStorageProvider struct {
	StorageFactory serverstorage.StorageFactory
	// Used for custom proxy dialing, and proxy TLS options
	ProxyTransport      http.RoundTripper
	KubeletClientConfig kubeletclient.KubeletClientConfig
	EventTTL            time.Duration

	// ServiceIPRange is used to build cluster IPs for discovery.
	ServiceIPRange net.IPNet
	// allocates ips for secondary service cidr in dual  stack clusters
	SecondaryServiceIPRange net.IPNet
	ServiceNodePortRange    utilnet.PortRange

	ServiceAccountIssuer        serviceaccount.TokenGenerator
	ServiceAccountMaxExpiration time.Duration
	ExtendExpiration            bool

	APIAudiences authenticator.Audiences

	LoopbackClientConfig *restclient.Config
}

// LegacyRESTStorage将特定REST存储实例的有状态信息返回给 kube-apiserver 的RESTful框架
type LegacyRESTStorage struct {
	ServiceClusterIPAllocator          rangeallocation.RangeRegistry
	SecondaryServiceClusterIPAllocator rangeallocation.RangeRegistry
	ServiceNodePortAllocator           rangeallocation.RangeRegistry
}

func (c LegacyRESTStorageProvider) NewLegacyRESTStorage(apiResourceConfigSource serverstorage.APIResourceConfigSource, restOptionsGetter generic.RESTOptionsGetter) (LegacyRESTStorage, genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.APIGroupInfo{
		PrioritizedVersions:          legacyscheme.Scheme.PrioritizedVersionsForGroup(""),
		VersionedResourcesStorageMap: map[string]map[string]rest.Storage{},
		Scheme:                       legacyscheme.Scheme,
		ParameterCodec:               legacyscheme.ParameterCodec,
		NegotiatedSerializer:         legacyscheme.Codecs,
	}

	podDisruptionClient, err := policyclient.NewForConfig(c.LoopbackClientConfig)
	if err != nil {
		return LegacyRESTStorage{}, genericapiserver.APIGroupInfo{}, err
	}
	restStorage := LegacyRESTStorage{}
    ...
	// 资源的名称格式统一定义为 ${resource-name} 或者是 ${resource-name}/${sub-resource-name}
    storage := map[string]rest.Storage{}
	if resource := "pods"; apiResourceConfigSource.ResourceEnabled(corev1.SchemeGroupVersion.WithResource(resource)) {
		storage[resource] = podStorage.Pod
		storage[resource+"/attach"] = podStorage.Attach
		storage[resource+"/status"] = podStorage.Status
		storage[resource+"/log"] = podStorage.Log
		storage[resource+"/exec"] = podStorage.Exec
		storage[resource+"/portforward"] = podStorage.PortForward
		storage[resource+"/proxy"] = podStorage.Proxy
		storage[resource+"/binding"] = podStorage.Binding
		if podStorage.Eviction != nil {
			storage[resource+"/eviction"] = podStorage.Eviction
		}
		storage[resource+"/ephemeralcontainers"] = podStorage.EphemeralContainers

	}
	if resource := "bindings"; apiResourceConfigSource.ResourceEnabled(corev1.SchemeGroupVersion.WithResource(resource)) {
		storage[resource] = podStorage.LegacyBinding
	}

	if resource := "podtemplates"; apiResourceConfigSource.ResourceEnabled(corev1.SchemeGroupVersion.WithResource(resource)) {
		storage[resource] = podTemplateStorage
	}
    ...
}
```

## 3. API 接口注册
```go
// CreateKubeAPIServer creates and wires a workable kube-apiserver
func CreateKubeAPIServer(kubeAPIServerConfig *controlplane.Config, delegateAPIServer genericapiserver.DelegationTarget) (*controlplane.Instance, error) {
	return kubeAPIServerConfig.Complete().New(delegateAPIServer)
}

// New 函数从给定的配置返回一个新的 Master 实例。
// 如果未设置某些配置字段，则会将它们设置为默认值。
func (c completedConfig) New(delegationTarget genericapiserver.DelegationTarget) (*Instance, error) {
	...
	m := &Instance{
		GenericAPIServer:          s,
		ClusterAuthenticationInfo: c.ExtraConfig.ClusterAuthenticationInfo,
	}

	// install legacy rest storage

	if err := m.InstallLegacyAPI(&c, c.GenericConfig.RESTOptionsGetter); err != nil {
		return nil, err
	}
}
```

Instance 定义在 pkg/controlplane/instance.go 

```go
func (m *Instance) InstallLegacyAPI(c *completedConfig, restOptionsGetter generic.RESTOptionsGetter) error {
	
	legacyRESTStorageProvider := corerest.LegacyRESTStorageProvider{
		StorageFactory:              c.ExtraConfig.StorageFactory,
		ProxyTransport:              c.ExtraConfig.ProxyTransport,
		KubeletClientConfig:         c.ExtraConfig.KubeletClientConfig,
		EventTTL:                    c.ExtraConfig.EventTTL,
		ServiceIPRange:              c.ExtraConfig.ServiceIPRange,
		SecondaryServiceIPRange:     c.ExtraConfig.SecondaryServiceIPRange,
		ServiceNodePortRange:        c.ExtraConfig.ServiceNodePortRange,
		LoopbackClientConfig:        c.GenericConfig.LoopbackClientConfig,
		ServiceAccountIssuer:        c.ExtraConfig.ServiceAccountIssuer,
		ExtendExpiration:            c.ExtraConfig.ExtendExpiration,
		ServiceAccountMaxExpiration: c.ExtraConfig.ServiceAccountMaxExpiration,
		APIAudiences:                c.GenericConfig.Authentication.APIAudiences,
	}
	// 1. 返回核心资源的 apiGroupInfo
	legacyRESTStorage, apiGroupInfo, err := legacyRESTStorageProvider.NewLegacyRESTStorage(c.ExtraConfig.APIResourceConfigSource, restOptionsGetter)
	if err != nil {
		return fmt.Errorf("error building core storage: %v", err)
	}
	if len(apiGroupInfo.VersionedResourcesStorageMap) == 0 { // if all core storage is disabled, return.
		return nil
	}

	controllerName := "bootstrap-controller"
	client := kubernetes.NewForConfigOrDie(c.GenericConfig.LoopbackClientConfig)
	bootstrapController, err := c.NewBootstrapController(legacyRESTStorage, client)
	if err != nil {
		return fmt.Errorf("error creating bootstrap controller: %v", err)
	}
	m.GenericAPIServer.AddPostStartHookOrDie(controllerName, bootstrapController.PostStartHook)
	m.GenericAPIServer.AddPreShutdownHookOrDie(controllerName, bootstrapController.PreShutdownHook)

	// 2. 注册核心资源
	if err := m.GenericAPIServer.InstallLegacyAPIGroup(genericapiserver.DefaultLegacyAPIPrefix, &apiGroupInfo); err != nil {
		return fmt.Errorf("error in registering group versions: %v", err)
	}
	return nil
	...
	// 3. 返回创建非核心资源 ApiGroupInfo 的 StorageProvider
	// The order here is preserved in discovery.
	// If resources with identical names exist in more than one of these groups (e.g. "deployments.apps"" and "deployments.extensions"),
	// the order of this list determines which group an unqualified resource name (e.g. "deployments") should prefer.
	// This priority order is used for local discovery, but it ends up aggregated in `k8s.io/kubernetes/cmd/kube-apiserver/app/aggregator.go
	// with specific priorities.
	// TODO: describe the priority all the way down in the RESTStorageProviders and plumb it back through the various discovery
	// handlers that we have.
	restStorageProviders := []RESTStorageProvider{
		apiserverinternalrest.StorageProvider{},
		authenticationrest.RESTStorageProvider{Authenticator: c.GenericConfig.Authentication.Authenticator, APIAudiences: c.GenericConfig.Authentication.APIAudiences},
		authorizationrest.RESTStorageProvider{Authorizer: c.GenericConfig.Authorization.Authorizer, RuleResolver: c.GenericConfig.RuleResolver},
		autoscalingrest.RESTStorageProvider{},
		batchrest.RESTStorageProvider{},
		certificatesrest.RESTStorageProvider{},
		coordinationrest.RESTStorageProvider{},
		discoveryrest.StorageProvider{},
		networkingrest.RESTStorageProvider{},
		noderest.RESTStorageProvider{},
		policyrest.RESTStorageProvider{},
		rbacrest.RESTStorageProvider{Authorizer: c.GenericConfig.Authorization.Authorizer},
		schedulingrest.RESTStorageProvider{},
		storagerest.RESTStorageProvider{},
		flowcontrolrest.RESTStorageProvider{InformerFactory: c.GenericConfig.SharedInformerFactory},
		// keep apps after extensions so legacy clients resolve the extensions versions of shared resource names.
		// See https://github.com/kubernetes/kubernetes/issues/42392
		// 6. 前面介绍的 APP StorageProvider
		appsrest.StorageProvider{},
		admissionregistrationrest.RESTStorageProvider{Authorizer: c.GenericConfig.Authorization.Authorizer, DiscoveryClient: discoveryClientForAdmissionRegistration},
		eventsrest.RESTStorageProvider{TTL: c.ExtraConfig.EventTTL},
		resourcerest.RESTStorageProvider{},
	}
	// 4. 注册非核心资源接口
	if err := m.InstallAPIs(c.ExtraConfig.APIResourceConfigSource, c.GenericConfig.RESTOptionsGetter, restStorageProviders...); err != nil {
		return nil, err
	}
}
```

### 3.1 核心组 API 接口注册
核心组 API 接口注册实现在 GenericAPIServer.InstallLegacyAPIGroup 中:

```go

// 此函数传入的 <apiGroupInfo> 不应在其他地方使用，因为底层存储将在此服务器关闭时被销毁。
func (s *GenericAPIServer) InstallLegacyAPIGroup(apiPrefix string, apiGroupInfo *APIGroupInfo) error {
	if !s.legacyAPIGroupPrefixes.Has(apiPrefix) {
		return fmt.Errorf("%q is not in the allowed legacy API prefixes: %v", apiPrefix, s.legacyAPIGroupPrefixes.List())
	}

	openAPIModels, err := s.getOpenAPIModels(apiPrefix, apiGroupInfo)
	if err != nil {
		return fmt.Errorf("unable to get openapi models: %v", err)
	}
    // 接口注册入口
	if err := s.installAPIResources(apiPrefix, apiGroupInfo, openAPIModels); err != nil {
		return err
	}

	// Install the version handler.
	// Add a handler at /<apiPrefix> to enumerate the supported api versions.
	legacyRootAPIHandler := discovery.NewLegacyRootAPIHandler(s.discoveryAddresses, s.Serializer, apiPrefix)
	if utilfeature.DefaultFeatureGate.Enabled(features.AggregatedDiscoveryEndpoint) {
		wrapped := discoveryendpoint.WrapAggregatedDiscoveryToHandler(legacyRootAPIHandler, s.AggregatedLegacyDiscoveryGroupManager)
		s.Handler.GoRestfulContainer.Add(wrapped.GenerateWebService("/api", metav1.APIVersions{}))
	} else {
		s.Handler.GoRestfulContainer.Add(legacyRootAPIHandler.WebService())
	}

	return nil
}
```

### 3.2 非核心组 API 接口注册
非核心组 API 接口注册实现从 Instance.InstallAPIs 开始:

```go
func (m *Instance) InstallAPIs(apiResourceConfigSource serverstorage.APIResourceConfigSource, restOptionsGetter generic.RESTOptionsGetter, restStorageProviders ...RESTStorageProvider) error {
	apiGroupsInfo := []*genericapiserver.APIGroupInfo{}

	// used later in the loop to filter the served resource by those that have expired.
	resourceExpirationEvaluator, err := genericapiserver.NewResourceExpirationEvaluator(*m.GenericAPIServer.Version)
	if err != nil {
		return err
	}
	
	for _, restStorageBuilder := range restStorageProviders {
		groupName := restStorageBuilder.GroupName()
		// 1. 调用每个 StorageProvider 的 NewRESTStorage 返回 APIGroupInfo
		apiGroupInfo, err := restStorageBuilder.NewRESTStorage(apiResourceConfigSource, restOptionsGetter)
		if err != nil {
			return fmt.Errorf("problem initializing API group %q : %v", groupName, err)
		}
		if len(apiGroupInfo.VersionedResourcesStorageMap) == 0 {
			// If we have no storage for any resource configured, this API group is effectively disabled.
			// This can happen when an entire API group, version, or development-stage (alpha, beta, GA) is disabled.
			klog.Infof("API group %q is not enabled, skipping.", groupName)
			continue
		}

		// Remove resources that serving kinds that are removed.
		// We do this here so that we don't accidentally serve versions without resources or openapi information that for kinds we don't serve.
		// This is a spot above the construction of individual storage handlers so that no sig accidentally forgets to check.
		resourceExpirationEvaluator.RemoveDeletedKinds(groupName, apiGroupInfo.Scheme, apiGroupInfo.VersionedResourcesStorageMap)
		if len(apiGroupInfo.VersionedResourcesStorageMap) == 0 {
			klog.V(1).Infof("Removing API group %v because it is time to stop serving it because it has no versions per APILifecycle.", groupName)
			continue
		}

		klog.V(1).Infof("Enabling API group %q.", groupName)

		if postHookProvider, ok := restStorageBuilder.(genericapiserver.PostStartHookProvider); ok {
			name, hook, err := postHookProvider.PostStartHook()
			if err != nil {
				klog.Fatalf("Error building PostStartHook: %v", err)
			}
			m.GenericAPIServer.AddPostStartHookOrDie(name, hook)
		}

		apiGroupsInfo = append(apiGroupsInfo, &apiGroupInfo)
	}
	// 2. 使用 APIGroupInfo 完成 API 注册
	if err := m.GenericAPIServer.InstallAPIGroups(apiGroupsInfo...); err != nil {
		return fmt.Errorf("error in registering group versions: %v", err)
	}
	return nil
}
```

实际注册实现在 GenericAPIServer.InstallLegacyAPIGroup 中:

```go
func (s *GenericAPIServer) InstallAPIGroups(apiGroupInfos ...*APIGroupInfo) error {
	for _, apiGroupInfo := range apiGroupInfos {
		// Do not register empty group or empty version.  Doing so claims /apis/ for the wrong entity to be returned.
		// Catching these here places the error  much closer to its origin
		if len(apiGroupInfo.PrioritizedVersions[0].Group) == 0 {
			return fmt.Errorf("cannot register handler with an empty group for %#v", *apiGroupInfo)
		}
		if len(apiGroupInfo.PrioritizedVersions[0].Version) == 0 {
			return fmt.Errorf("cannot register handler with an empty version for %#v", *apiGroupInfo)
		}
	}

	openAPIModels, err := s.getOpenAPIModels(APIGroupPrefix, apiGroupInfos...)
	if err != nil {
		return fmt.Errorf("unable to get openapi models: %v", err)
	}

	for _, apiGroupInfo := range apiGroupInfos {
		// 接口注册入口
		if err := s.installAPIResources(APIGroupPrefix, apiGroupInfo, openAPIModels); err != nil {
			return fmt.Errorf("unable to install api resources: %v", err)
		}

		// setup discovery
		// Install the version handler.
		// Add a handler at /apis/<groupName> to enumerate all versions supported by this group.
		apiVersionsForDiscovery := []metav1.GroupVersionForDiscovery{}
		for _, groupVersion := range apiGroupInfo.PrioritizedVersions {
			// Check the config to make sure that we elide versions that don't have any resources
			if len(apiGroupInfo.VersionedResourcesStorageMap[groupVersion.Version]) == 0 {
				continue
			}
			apiVersionsForDiscovery = append(apiVersionsForDiscovery, metav1.GroupVersionForDiscovery{
				GroupVersion: groupVersion.String(),
				Version:      groupVersion.Version,
			})
		}
		preferredVersionForDiscovery := metav1.GroupVersionForDiscovery{
			GroupVersion: apiGroupInfo.PrioritizedVersions[0].String(),
			Version:      apiGroupInfo.PrioritizedVersions[0].Version,
		}
		apiGroup := metav1.APIGroup{
			Name:             apiGroupInfo.PrioritizedVersions[0].Group,
			Versions:         apiVersionsForDiscovery,
			PreferredVersion: preferredVersionForDiscovery,
		}

		s.DiscoveryGroupManager.AddGroup(apiGroup)
		s.Handler.GoRestfulContainer.Add(discovery.NewAPIGroupHandler(s.Serializer, apiGroup).WebService())
	}
	return nil
}
```

可以看到，非核心资源的 API 接口注册与核心资源一样，在完成 APIGroup 实例化之后，最终都会调用 GenericAPIServer.installAPIResources。

```go
Instance.InstallLegacyAPI --> GenericAPIServer.InstallLegacyAPIGroup
Instance.InstallLegacyAPI --> Instance.InstallAPIs  --> GenericAPIServer.InstallLegacyAPIGroup
                               |
                               |
                               |
					GenericAPIServer.installAPIResources						                                                    
```
## 4. APIGroupVersion/APIInstaller
API 接口注册最终都会调用 GenericAPIServer.installAPIResources 函数，在这个函数的执行中:
1. 首先会调用 GenericAPIServer.getAPIGroupVersion 使用 ApiGroupInfo 生成 APIGroupVersion
2. 然后调用 APIGroupVersion.InstallREST 使用 APIGroupVersion 生成 APIInstaller 完成接口注册

```go
// installAPIResources is a private method for installing the REST storage backing each api groupversionresource
func (s *GenericAPIServer) installAPIResources(apiPrefix string, apiGroupInfo *APIGroupInfo, openAPIModels *spec.Swagger) error {
	var resourceInfos []*storageversion.ResourceInfo
	for _, groupVersion := range apiGroupInfo.PrioritizedVersions {
		if len(apiGroupInfo.VersionedResourcesStorageMap[groupVersion.Version]) == 0 {
			klog.Warningf("Skipping API %v because it has no resources.", groupVersion)
			continue
		}
		// 1. 创建 APIGroupVersion 
		apiGroupVersion, err := s.getAPIGroupVersion(apiGroupInfo, groupVersion, apiPrefix)
		if err != nil {
			return err
		}
		if apiGroupInfo.OptionsExternalVersion != nil {
			apiGroupVersion.OptionsExternalVersion = apiGroupInfo.OptionsExternalVersion
		}
		apiGroupVersion.OpenAPIModels = openAPIModels

		if openAPIModels != nil {
			typeConverter, err := fieldmanager.NewTypeConverter(openAPIModels, false)
			if err != nil {
				return err
			}
			apiGroupVersion.TypeConverter = typeConverter
		}

		apiGroupVersion.MaxRequestBodyBytes = s.maxRequestBodyBytes

		// 2. InstallREST 使用 APIGroupVersion 创建 APIInstaller 然后完成 API 接口注册
		discoveryAPIResources, r, err := apiGroupVersion.InstallREST(s.Handler.GoRestfulContainer)
        ...

	return nil
}

```

### 4.1 APIGroupVersion
APIGroupVersion 定义在 k8s.io/apiserver/pkg/endpoints/groupversion.go:

```go
// APIGroupVersion是一个帮助程序，通过go-restful将rest.Storage对象作为http.Handlers公开。
// 它处理以下格式的URL：
// /${storage_key}[/${object_name}]
// 其中'storage_key'指向存储在storage中的rest.Storage对象。
// 此对象应包含运行特定API版本所需的所有参数化
type APIGroupVersion struct {
	// 此版本下各个资源对应的操作类，key 为某一个具体的资源的实际名称
	// 例如常见资源 depployment/demonset 等等，value 则为以前文章中我们介绍的资源操作接口 rest.Storage 类型。
	Storage map[string]rest.Storage
	Root string

	// GroupVersion是外部组版本
	GroupVersion schema.GroupVersion

	// OptionsExternalVersion控制apiserver中常见对象（如api.Status、api.DeleteOptions和metav1.ListOptions）的Kubernetes APIVersion。
	// 其他实现者可能定义版本“v1beta1”，但想使用Kubernetes“v1”内部对象。如果为空，则默认为GroupVersion。
	OptionsExternalVersion *schema.GroupVersion
	// MetaGroupVersion默认为“meta.k8s.io/v1”，用于解码像ListOptions这样的常见API实现。将来的更改将允许此变化
	// 按组版本变化（用于不可避免的meta/v2组出现的情况）。
	MetaGroupVersion *schema.GroupVersion

	// RootScopedKinds是主GroupVersion的根作用域类型
	RootScopedKinds sets.String

	// Serializer用于确定如何将API方法的响应转换为要在线上发送的字节。
	Serializer     runtime.NegotiatedSerializer
	ParameterCodec runtime.ParameterCodec

	Typer                 runtime.ObjectTyper
	Creater               runtime.ObjectCreater
	Convertor             runtime.ObjectConvertor
	ConvertabilityChecker ConvertabilityChecker
	Defaulter             runtime.ObjectDefaulter
	Namer                 runtime.Namer
	UnsafeConvertor       runtime.ObjectConvertor
	TypeConverter         fieldmanager.TypeConverter

	EquivalentResourceRegistry runtime.EquivalentResourceRegistry

	// Authorizer确定用户是否被允许进行某个请求。处理程序使用请求URI进行初步授权检查，但可能需要进行其他检查，例如在创建-更新情况下
	Authorizer authorizer.Authorizer

	Admit admission.Interface

	MinRequestTimeout time.Duration

	// OpenAPIModels公开OpenAPI模型到每个单独的处理程序。
	OpenAPIModels *spec.Swagger

	//接受和解码写请求中将接受的请求体大小的限制。0表示无限制。
	MaxRequestBodyBytes int64

}
```

### 4.2 APIGroupVersion 创建

```go
func (s *GenericAPIServer) getAPIGroupVersion(apiGroupInfo *APIGroupInfo, groupVersion schema.GroupVersion, apiPrefix string) (*genericapi.APIGroupVersion, error) {
	storage := make(map[string]rest.Storage)
	for k, v := range apiGroupInfo.VersionedResourcesStorageMap[groupVersion.Version] {
		if strings.ToLower(k) != k {
			return nil, fmt.Errorf("resource names must be lowercase only, not %q", k)
		}
		storage[k] = v
	}
	version := s.newAPIGroupVersion(apiGroupInfo, groupVersion)
	version.Root = apiPrefix
	version.Storage = storage
	return version, nil
}

func (s *GenericAPIServer) newAPIGroupVersion(apiGroupInfo *APIGroupInfo, groupVersion schema.GroupVersion) *genericapi.APIGroupVersion {
	return &genericapi.APIGroupVersion{
		GroupVersion:     groupVersion,
		MetaGroupVersion: apiGroupInfo.MetaGroupVersion,

		ParameterCodec:        apiGroupInfo.ParameterCodec,
		Serializer:            apiGroupInfo.NegotiatedSerializer,
		Creater:               apiGroupInfo.Scheme,
		Convertor:             apiGroupInfo.Scheme,
		ConvertabilityChecker: apiGroupInfo.Scheme,
		UnsafeConvertor:       runtime.UnsafeObjectConvertor(apiGroupInfo.Scheme),
		Defaulter:             apiGroupInfo.Scheme,
		Typer:                 apiGroupInfo.Scheme,
		Namer:                 runtime.Namer(meta.NewAccessor()),

		EquivalentResourceRegistry: s.EquivalentResourceRegistry,

		Admit:             s.admissionControl,
		MinRequestTimeout: s.minRequestTimeout,
		Authorizer:        s.Authorizer,
	}
}
```

### 4.3 APIInstaller
APIInstaller 定义在 k8s.io/apiserver/pkg/endpoints/installer.go 

```go
type APIInstaller struct {
	group             *APIGroupVersion
	prefix            string // Path prefix where API resources are to be registered.
	minRequestTimeout time.Duration
}
```

### 4.4 APIGroupVersion.InstallREST
APIInstaller 对象来辅助注册安装 API:

```go
// InstallREST 将 REST 处理程序（存储，观察，代理和重定向）注册到 restful 容器中。
// 预期提供的路径根前缀将服务所有操作。 根目录不得以斜杠结尾。
func (g *APIGroupVersion) InstallREST(container *restful.Container) ([]apidiscoveryv2beta1.APIResourceDiscovery, []*storageversion.ResourceInfo, error) {
	prefix := path.Join(g.Root, g.GroupVersion.Group, g.GroupVersion.Version)
	// 创建 APIInstaller
	installer := &APIInstaller{
		group:             g,
		prefix:            prefix,
		minRequestTimeout: g.MinRequestTimeout,
	}
	// 执行接口注册
	apiResources, resourceInfos, ws, registrationErrors := installer.Install()
	versionDiscoveryHandler := discovery.NewAPIVersionHandler(g.Serializer, g.GroupVersion, staticLister{apiResources})
	versionDiscoveryHandler.AddToWebService(ws)
	container.Add(ws)
	aggregatedDiscoveryResources, err := ConvertGroupVersionIntoToDiscovery(apiResources)
	if err != nil {
		registrationErrors = append(registrationErrors, err)
	}
	return aggregatedDiscoveryResources, removeNonPersistedResources(resourceInfos), utilerrors.NewAggregate(registrationErrors)
}
```

### 4.5 APIInstaller.Install
APIInstaller.Install 主要是映射资源访问路径和资源处理类的对应关系:

```go
// Install handlers for API resources.
func (a *APIInstaller) Install() ([]metav1.APIResource, []*storageversion.ResourceInfo, *restful.WebService, []error) {
	var apiResources []metav1.APIResource
	var resourceInfos []*storageversion.ResourceInfo
	var errors []error
	ws := a.newWebService()

	// Register the paths in a deterministic (sorted) order to get a deterministic swagger spec.
	paths := make([]string, len(a.group.Storage))
	var i int = 0
	for path := range a.group.Storage {
		paths[i] = path
		i++
	}
	sort.Strings(paths)
	for _, path := range paths {
		// 映射路径到 handler
		apiResource, resourceInfo, err := a.registerResourceHandlers(path, a.group.Storage[path], ws)
		if err != nil {
			errors = append(errors, fmt.Errorf("error in registering resource: %s, %v", path, err))
		}
		if apiResource != nil {
			apiResources = append(apiResources, *apiResource)
		}
		if resourceInfo != nil {
			resourceInfos = append(resourceInfos, resourceInfo)
		}
	}
	return apiResources, resourceInfos, ws, errors
}
```

### 4.6 APIInstaller.registerResourceHandlers
APIInstaller.registerResourceHandlers 将资源访问路径和资源处理类，注册成相应的 REST API，另外 kubernetes 的 API 使用了 go-restful 这个 web 框架，我们在源码里可以明确的看到核心对象 webservice，利用它注册 http 方法 get, post 等，映射资源访问路径和资源处理类的对应关系。


```go
Instance.InstallLegacyAPI --> GenericAPIServer.InstallLegacyAPIGroup
Instance.InstallLegacyAPI --> Instance.InstallAPIs  --> GenericAPIServer.InstallLegacyAPIGroup
                               |
					GenericAPIServer.installAPIResources	
                               |
					GenericAPIServer.getAPIGroupVersion
                               |
					apiGroupVersion.InstallREST	
					           |
						APIInstaller.Install		
						       |
					APIInstaller.registerResourceHandlers		                                                    
```

registerResourceHandlers 如下两个对象:
1. ResourceInfo
2. APIResource

#### ResourceInfo
```go
// ResourceInfo 包含了注册资源到存储版本 API 所需的信息。
type ResourceInfo struct {
	GroupResource schema.GroupResource
	EncodingVersion string
	// 用于计算可解码版本，只能在 InstallREST 注册所有等效版本后使用。
	EquivalentResourceMapper runtime.EquivalentResourceRegistry

	// DirectlyDecodableVersions 是转换为 REST 存储器所知道如何转换的版本列表。
	// 即使我们不提供某些版本，它也包含类似于 apiextensions.k8s.io/v1beta1 的项目。
	DirectlyDecodableVersions []schema.GroupVersion
}

// EquivalentResourceRegistry 提供一个 EquivalentResourceMapper 接口，并允许注册已知的资源[/子资源] -> 种类（kind）
type EquivalentResourceRegistry interface {
	EquivalentResourceMapper
	// RegisterKindFor注册指定资源[ /子资源]及其预期种类（kind）的存在。
	RegisterKindFor(resource schema.GroupVersionResource, subresource string, kind schema.GroupVersionKind)
}

// EquivalentResourceMapper 提供关于与指定资源指向相同基础数据的资源的信息
type EquivalentResourceMapper interface {
	// EquivalentResourcesFor 返回一个资源列表，这些资源与 resource 指向相同的基础数据。
	// 如果指定了 subresource，则只包括具有相同 subresource 的等效资源。
	// 指定的 resource 可以包含在返回的列表中。
	EquivalentResourcesFor(resource schema.GroupVersionResource, subresource string) []schema.GroupVersionResource
	// KindFor 返回指定资源[/subresource]所期望的 kind。
	// 如果未知，则返回零值。
	KindFor(resource schema.GroupVersionResource, subresource string) schema.GroupVersionKind
}
```

#### APIResource

```go
// APIResource 指定了一个资源的名称和它是否是命名空间的。
type APIResource struct {
	// Name 是资源的复数名称。
	Name string json:"name" protobuf:"bytes,1,opt,name=name"
	// SingularName 是资源的单数名称。这允许客户端透明地处理复数和单数。
	// SingularName 对于报告单个项目的状态更正确，kubectl CLI 接口允许使用单数和复数。
	SingularName string json:"singularName" protobuf:"bytes,6,opt,name=singularName"
	// Namespaced 表示资源是否在命名空间中。
	Namespaced bool json:"namespaced" protobuf:"varint,2,opt,name=namespaced"
	// Group 是资源的首选组。空表示包含资源列表的组。
	// 对于子资源，它可能有不同的值，例如：Scale。
	Group string json:"group,omitempty" protobuf:"bytes,8,opt,name=group"
	// Version 是资源的首选版本。空表示包含资源列表的版本。
	// 对于子资源，它可能有不同的值，例如：v1（在核心资源组的 v1beta1 版本内）。
	Version string json:"version,omitempty" protobuf:"bytes,9,opt,name=version"
	// Kind 是资源的类型（例如，“Foo”是资源“foo”的类型）。
	Kind string json:"kind" protobuf:"bytes,3,opt,name=kind"
	// Verbs 是支持的 Kubernetes 动词列表（包括 get、list、watch、create、
	// update、patch、delete、deletecollection 和 proxy）。
	Verbs Verbs json:"verbs" protobuf:"bytes,4,opt,name=verbs"
	// ShortNames 是建议的资源短名称列表。
	ShortNames []string json:"shortNames,omitempty" protobuf:"bytes,5,rep,name=shortNames"
	// Categories 是资源所属的分组资源列表（例如，'all'）。
	Categories []string json:"categories,omitempty" protobuf:"bytes,7,rep,name=categories"
	// 存储版本的哈希值，将该资源写入数据存储时会被转换为该版本。
	// 客户端必须将该值视为不透明。仅对值进行相等比较是有效的。
	// 这是一个 Alpha 特性，可能会在将来更改或删除。
	// 只有启用了 StorageVersionHash 功能门卫，apiserver 才会填充该字段。
	// 即使该字段毕业，它仍将保持可选。
	// +optional
	StorageVersionHash string json:"storageVersionHash,omitempty" protobuf:"bytes,10,opt,name=storageVersionHash"
}
```