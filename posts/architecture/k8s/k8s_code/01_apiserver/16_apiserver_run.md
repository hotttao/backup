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


#### CreateServerChain
CreateServerChain 返回一个 APIAggregator:

```go
// APIAggregator包含Kubernetes集群master/api服务器的状态。
type APIAggregator struct {
    GenericAPIServer *genericapiserver.GenericAPIServer // GenericAPIServer是泛型API服务器，用于处理请求。
    // 为更容易嵌入提供的
    APIRegistrationInformers informers.SharedInformerFactory // APIRegistrationInformers 用于注册API。

    delegateHandler http.Handler // delegateHandler 是 HTTP处理程序。

    // proxyCurrentCertKeyContent 持有用于识别此代理的客户端证书。后备 APIServices 使用此信息确认代理的身份
    proxyCurrentCertKeyContent certKeyFunc // certKeyFunc是一个函数类型，返回证书和密钥。

    proxyTransport             *http.Transport // proxyTransport是HTTP传输。

    // proxyHandlers 是当前注册的代理处理程序，由 apiservice.name 键入。
    proxyHandlers map[string]*proxyHandler // proxyHandlers是代理处理程序的集合，由API服务的名称作为键。

    // handledGroups是已经具有路由的组。
    handledGroups sets.String // sets.String是一个字符串集合。

    // lister 用于添加组处理以进行 /apis/<group> 聚合器查找基于控制器状态
    lister listers.APIServiceLister // listers.APIServiceLister是一个接口，用于列出APIService对象。

    // 用于确定聚合器路由的信息。
    serviceResolver ServiceResolver // ServiceResolver是一个接口，用于解析API服务和服务实例。

    // 如果这些配置是非零，则启用swagger和/或OpenAPI。
    openAPIConfig *openapicommon.Config // openapicommon.Config包含OpenAPI的通用配置。

    // 如果这些配置是非零，则启用OpenAPI V3。
    openAPIV3Config *openapicommon.Config // openapicommon.Config包含OpenAPI的通用配置。

    // openAPIAggregationController下载并合并OpenAPI v2规范。
    openAPIAggregationController *openapicontroller.AggregationController // openapicontroller.AggregationController负责聚合API服务的OpenAPI定义。

    // openAPIV3AggregationController 下载和缓存OpenAPI v3规范。
    openAPIV3AggregationController *openapiv3controller.AggregationController // openapiv3controller.AggregationController负责聚合API服务的OpenAPI v3定义。

    // discoveryAggregationController 从所有聚合的 apiservice 下载和缓存发现文档，
    // 以便在请求具有资源的发现文档时可以从 /apis 端点获取。
    discoveryAggregationController DiscoveryAggregationController // DiscoveryAggregationController负责聚合API服务的发现文档。

    // egressSelector选择适当的出口拨号器与自定义apiserver通信，如果不为nil，则覆盖proxyTransport拨号器
    egressSelector *egressselector.EgressSelector // egressselector.EgressSelector是一个接口，用于选择适当的出口代理以进行聚合操作。

    // rejectForwardingRedirects是是否允许转发重定向响应。
    rejectForwardingRedirects bool // 如果设置为true，则拒绝转发重定向响
}
```

CreateServerChain 执行过程如下:

```go
func CreateServerChain(completedOptions completedServerRunOptions) (*aggregatorapiserver.APIAggregator, error) {
    // 1. CreateKubeAPIServerConfig 创建用于运行API服务器的所有资源，但不运行其中任何资源
	kubeAPIServerConfig, serviceResolver, pluginInitializer, err := CreateKubeAPIServerConfig(completedOptions)
	if err != nil {
		return nil, err
	}

	// If additional API servers are added, they should be gated.
	apiExtensionsConfig, err := createAPIExtensionsConfig(*kubeAPIServerConfig.GenericConfig, kubeAPIServerConfig.ExtraConfig.VersionedInformers, pluginInitializer, completedOptions.ServerRunOptions, completedOptions.MasterCount,
		serviceResolver, webhook.NewDefaultAuthenticationInfoResolverWrapper(kubeAPIServerConfig.ExtraConfig.ProxyTransport, kubeAPIServerConfig.GenericConfig.EgressSelector, kubeAPIServerConfig.GenericConfig.LoopbackClientConfig, kubeAPIServerConfig.GenericConfig.TracerProvider))
	if err != nil {
		return nil, err
	}
    // New 返回一个 HTTP 处理程序，该处理程序旨在在委托链的末尾执行。
    // 它检查是否在服务器安装所有已知的 HTTP 路径之前发出了请求。
    // 在这种情况下，它返回一个 503 响应，否则返回 404。
    //
    // 注意，我们不希望在 readyz 路径中添加其他检查，因为它可能会阻止修复损坏的集群。
    // 此特定处理程序旨在“保护”在路径和处理程序完全初始化之前到达的请求。
	notFoundHandler := notfoundhandler.New(kubeAPIServerConfig.GenericConfig.Serializer, genericapifilters.NoMuxAndDiscoveryIncompleteKey)

    // CRD 的 APIExtensionsServer
	apiExtensionsServer, err := createAPIExtensionsServer(apiExtensionsConfig, genericapiserver.NewEmptyDelegateWithCustomHandler(notFoundHandler))
	if err != nil {
		return nil, err
	}
    // API Server
	kubeAPIServer, err := CreateKubeAPIServer(kubeAPIServerConfig, apiExtensionsServer.GenericAPIServer)
	if err != nil {
		return nil, err
	}

	// AggregatorServer
	aggregatorConfig, err := createAggregatorConfig(*kubeAPIServerConfig.GenericConfig, completedOptions.ServerRunOptions, kubeAPIServerConfig.ExtraConfig.VersionedInformers, serviceResolver, kubeAPIServerConfig.ExtraConfig.ProxyTransport, pluginInitializer)
	if err != nil {
		return nil, err
	}
	aggregatorServer, err := createAggregatorServer(aggregatorConfig, kubeAPIServer.GenericAPIServer, apiExtensionsServer.Informers)
	if err != nil {
		// we don't need special handling for innerStopCh because the aggregator server doesn't create any go routines
		return nil, err
	}

	return aggregatorServer, nil
}
```

## 2. Server 定义
API Server 的定义如下，结构非常庞大。在我们深入学习 API Server 启动和请求处理流程之前，我们得先弄清楚，他的每个成员的具体含义。其中比较特殊的是:
1. discoveryAddresses discovery.Addresses
2. LoopbackClientConfig *restclient.Config
3. admissionControl admission.Interface
3. Serializer runtime.NegotiatedSerializer
4. Handler *APIServerHandler
5. DiscoveryGroupManager discovery.GroupManager
6. AggregatedDiscoveryGroupManager discoveryendpoint.ResourceManager
7. AggregatedLegacyDiscoveryGroupManager discoveryendpoint.ResourceManager
8. AuditBackend audit.Backend
9. Authorizer authorizer.Authorizer
9. EquivalentResourceRegistry runtime.EquivalentResourceRegistry
10. delegationTarget DelegationTarget
11. StorageVersionManager storageversion.Manager

```go
// GenericAPIServer 包含了一个 Kubernetes 集群 API 服务器的状态。
type GenericAPIServer struct {
    // discoveryAddresses 用于构建发现的集群 IP。
    discoveryAddresses discovery.Addresses
    // LoopbackClientConfig 是用于与 API 服务器建立特权环回连接的配置
    LoopbackClientConfig *restclient.Config

    // minRequestTimeout 是请求超时的最短时间。这用于构建 RESTHandler
    minRequestTimeout time.Duration

    // ShutdownTimeout 是服务器关闭时使用的超时时间。这指定了服务器在优雅关闭之前的超时时间。
    ShutdownTimeout time.Duration

    // legacyAPIGroupPrefixes 用于设置用于授权和验证 InstallLegacyAPIGroup 请求的 URL 解析。
    legacyAPIGroupPrefixes sets.String

    // admissionControl 用于构建支持 API 组的 REST 存储。
    admissionControl admission.Interface

    // SecureServingInfo 包含 TLS 服务器的配置。
    SecureServingInfo *SecureServingInfo

    // ExternalAddress 是应用于此 GenericAPIServer 的外部（公共互联网） URL 的地址（主机名或 IP 和端口）。
    ExternalAddress string

    // Serializer Codec
    Serializer runtime.NegotiatedSerializer

    // Handler 持有此 API 服务器使用的处理程序。
    Handler *APIServerHandler

    // UnprotectedDebugSocket 用于在 unix 域套接字中提供 pprof 信息。此套接字未受身份验证/授权保护。
    UnprotectedDebugSocket *routes.DebugSocket

    // listedPathProvider 是一个列表，提供要在/处显示的路径集。
    listedPathProvider routes.ListedPathProvider

    // DiscoveryGroupManager 在未聚合的形式下提供/ apis。
    DiscoveryGroupManager discovery.GroupManager

    // AggregatedDiscoveryGroupManager 以聚合形式提供/ apis。
    AggregatedDiscoveryGroupManager discoveryendpoint.ResourceManager

    // AggregatedLegacyDiscoveryGroupManager 以聚合形式提供/api。
    AggregatedLegacyDiscoveryGroupManager discoveryendpoint.ResourceManager

    // 如果这些配置是非零，则启用 swagger 和/或 OpenAPI。
    openAPIConfig *openapicommon.Config

    // 如果这些配置是非零，则启用 swagger 和/或 OpenAPI V3。
    openAPIV3Config *openapicommon.Config

    // SkipOpenAPIInstallation 表示不安装 OpenAPI 处理程序
    // 在 PrepareRun 期间。
    // 当特定的 API Server 拥有自己的 OpenAPI 处理程序时将其设置为 true
    // （例如 kube-aggregator）
    skipOpenAPIInstallation bool

    // OpenAPIVersionedService 控制 /openapi/v2 端点，并可用于更新提供的规范。
    // 如果 openAPIConfig 非零，则在 PrepareRun 期间设置它，除非 skipOpenAPIInstallation 为 true。
    OpenAPIVersionedService *handler.OpenAPIService

    // OpenAPIV3VersionedService 控制 /openapi/v3 端点，并可用于更新服务规范。
    // 如果 `openAPIConfig` 非空，它将在 PrepareRun 期间设置，除非 `skipOpenAPIInstallation` 为 true。
    OpenAPIV3VersionedService *handler3.OpenAPIService

    // StaticOpenAPISpec是从restful容器端点派生出的规范。
    // 在PrepareRun期间设置。
    StaticOpenAPISpec *spec.Swagger
    // PostStartHooks在服务器开始侦听后每个都被调用，每个都在单独的go func中调用，
    // 没有任何顺序保证。映射键用于错误报告。
    // 如果希望，它可以通过返回错误来杀死进程。
    postStartHookLock      sync.Mutex
    postStartHooks         map[string]postStartHookEntry
    postStartHooksCalled   bool
    disabledPostStartHooks sets.String

    preShutdownHookLock    sync.Mutex
    preShutdownHooks       map[string]preShutdownHookEntry
    preShutdownHooksCalled bool

    // 健康检查
    healthzLock            sync.Mutex
    healthzChecks          []healthz.HealthChecker
    healthzChecksInstalled bool
    // livez检查
    livezLock            sync.Mutex
    livezChecks          []healthz.HealthChecker
    livezChecksInstalled bool
    // readyz检查
    readyzLock            sync.Mutex
    readyzChecks          []healthz.HealthChecker
    readyzChecksInstalled bool
    livezGracePeriod      time.Duration
    livezClock            clock.Clock

    // 审计。后端在服务器开始侦听之前启动。
    AuditBackend audit.Backend

    // Authorizer确定用户是否允许进行某个请求。Handler使用请求URI进行初步的授权检查，
    // 但可能需要进行其他检查，例如在创建更新的情况下
    Authorizer authorizer.Authorizer

    // EquivalentResourceRegistry提供与给定资源等效的资源信息，
    // 以及与给定资源关联的类型。随着资源的安装，它们在这里注册。
    EquivalentResourceRegistry runtime.EquivalentResourceRegistry

    // delegationTarget是链中的下一个委托对象。这永远不为空。
    delegationTarget DelegationTarget

    // NonLongRunningRequestWaitGroup允许您等待与非长时间运行请求相关联的所有链处理程序
    // 在服务器关闭时完成。
    NonLongRunningRequestWaitGroup *utilwaitgroup.SafeWaitGroup

    // ShutdownDelayDuration允许阻止关闭一段时间，例如，直到指向此API服务器的端点在所有节点上汇聚。
    // 在此期间，API服务器将继续服务，/healthz将返回200，但/readyz将返回失败。
    ShutdownDelayDuration time.Duration

    // write请求中接受和解码的请求体大小限制。
    // 0表示无限制。
    maxRequestBodyBytes int64

    // APIServerID是此API服务器的ID
    APIServerID string

    // StorageVersionManager保存此服务器安装的API资源的存储版本。
    StorageVersionManager storageversion.Manager

    // 如果非空，则Version将启用/version端点
    Version *version.Info

    // lifecycleSignals提供对API服务器生命周期中发生的各种信号的访问。
    lifecycleSignals lifecycleSignals

    // destroyFns 包含应在关闭时调用的清理资源的函数列表。
    destroyFns []func()

    // muxAndDiscoveryCompleteSignals 包含指示已注册所有已知 HTTP 路径的信号。
    // 它存在的主要目的是避免在资源实际存在但我们尚未安装到处理程序路径时返回 404 响应。
    // 它公开以便更容易组合各个服务器。
    // 此字段的主要用户是 WithMuxCompleteProtection 过滤器和 NotFoundHandler。
    muxAndDiscoveryCompleteSignals map[string]<-chan struct{}

    // ShutdownSendRetryAfter 决定何时在 apiserver 优雅终止期间启动 HTTP 服务器的关闭。
    // 如果为 true，则等待正在进行的非长时间运行请求被耗尽，然后启动 HTTP 服务器的关闭。
    // 如果为 false，则在 ShutdownDelayDuration 经过后立即启动 HTTP 服务器的关闭。
    // 如果启用了，当 ShutdownDelayDuration 经过后，任何传入的请求都将以 429 状态代码和 'Retry-After' 响应被拒绝。
    ShutdownSendRetryAfter bool

}
```

### 1.1 discovery.Addresses 
discovery.Addresses 是一个接口:

```go
type Addresses interface {
	ServerAddressByClientCIDRs(net.IP) []metav1.ServerAddressByClientCIDR
}

// ServerAddressByClientCIDR helps the client to determine the server address that they should use, depending on the clientCIDR that they match.
type ServerAddressByClientCIDR struct {
	// The CIDR with which clients can match their IP to figure out the server address that they should use.
	ClientCIDR string `json:"clientCIDR" protobuf:"bytes,1,opt,name=clientCIDR"`
	// Address of this server, suitable for a client that matches the above CIDR.
	// This can be a hostname, hostname:port, IP or IP:port.
	ServerAddress string `json:"serverAddress" protobuf:"bytes,2,opt,name=serverAddress"`
}
```

Addresses 有个默认实现: DefaultAddresses

```go

```