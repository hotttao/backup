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

## 1. API Server 创建流程
API Server 的启动入口在 cmd/kube-apiserver/apiserver.go 使用的 Cobra 解析命令行参数。

```go
// NewAPIServerCommand creates a *cobra.Command object with default parameters
func NewAPIServerCommand() *cobra.Command {
	s := options.NewServerRunOptions()
	cmd := &cobra.Command{
		// API Server 启动入口
		RunE: func(){} 
	}

	fs := cmd.Flags()
	namedFlagSets := s.Flags()
	verflag.AddFlags(namedFlagSets.FlagSet("global"))
	globalflag.AddGlobalFlags(namedFlagSets.FlagSet("global"), cmd.Name(), logs.SkipLoggingConfigurationFlags())
	options.AddCustomGlobalFlags(namedFlagSets.FlagSet("generic"))
	for _, f := range namedFlagSets.FlagSets {
		fs.AddFlagSet(f)
	}

	cols, _, _ := term.TerminalSize(cmd.OutOrStdout())
	cliflag.SetUsageAndHelpFunc(cmd, namedFlagSets, cols)

	return cmd
}
```

### 1.1 API Server 参数解析和收集
API Server 参数配置和解析集中在下面的代码中:

```go
s := options.NewServerRunOptions()
fs := cmd.Flags()
namedFlagSets := s.Flags()
// 添加 version flag
verflag.AddFlags(namedFlagSets.FlagSet("global"))
// 添加 log 内，通过标准库 flag 定义的参数，兼容逻辑
globalflag.AddGlobalFlags(namedFlagSets.FlagSet("global"), cmd.Name(), logs.SkipLoggingConfigurationFlags())
// 添加定义在其他地方的，通过标准库 flag 定义的全局参数
options.AddCustomGlobalFlags(namedFlagSets.FlagSet("generic"))
for _, f := range namedFlagSets.FlagSets {
		fs.AddFlagSet(f)
}
```

API Server 用到的配置存在在以下几个目录中:

|模块|option位置|作用|
|:---|:---|:---|
|cmd|cmd/kube-apiserver/app/options|定义了 ServerRunOptions，收集了不同模块的所有 options|
|apiserver|k8s.io/apiserver/pkg/server/options|服务启动的所有 options|
|kubeapiserver|pkg/kubeapiserver/options|kubeapiserver 包包含了既适用于 kube-apiserver 也适用于 federation-apiserver 的代码，但不是通用 API 服务器的一部分。例如，非委托授权选项被这两个服务器使用，但没有通用的 API 服务器会使用它们。|
|component-base|k8s.io/component-base/metrics/options.go|监控相关 options|
||k8s.io/component-base/logs/logs.go|日志相关 options|

为了分模块定义 option，API Server 定义了一个 NamedFlagSets:

```go
// NamedFlagSets stores named flag sets in the order of calling FlagSet.
type NamedFlagSets struct {
	// Order is an ordered list of flag set names.
	Order []string
	// FlagSets stores the flag sets by name.
	FlagSets map[string]*pflag.FlagSet
	// NormalizeNameFunc is the normalize function which used to initialize FlagSets created by NamedFlagSets.
	NormalizeNameFunc func(f *pflag.FlagSet, name string) pflag.NormalizedName
}

// FlagSet returns the flag set with the given name and adds it to the
// ordered name list if it is not in there yet.
func (nfs *NamedFlagSets) FlagSet(name string) *pflag.FlagSet {
	if nfs.FlagSets == nil {
		nfs.FlagSets = map[string]*pflag.FlagSet{}
	}
	if _, ok := nfs.FlagSets[name]; !ok {
		flagSet := pflag.NewFlagSet(name, pflag.ExitOnError)
		flagSet.SetNormalizeFunc(pflag.CommandLine.GetNormalizeFunc())
		if nfs.NormalizeNameFunc != nil {
			flagSet.SetNormalizeFunc(nfs.NormalizeNameFunc)
		}
		nfs.FlagSets[name] = flagSet
		nfs.Order = append(nfs.Order, name)
	}
	return nfs.FlagSets[name]
}
```
NamedFlagSets:
1. FlagSet 方法会创建一个新的 pflag.FlagSet
2. 上面每个模块的 options 都会接收一个 pflag.FlagSet，收集这个模块定义的所有参数

以 Etcd 的 options 为例，整个 options 到 flag 的创建过程如下:

首先 `options.NewServerRunOptions()` 会创建所有 options 对应的实例:

```go
// cmd/kube-apiserver/app/options/options.go
// 1. NewServerRunOptions使用默认参数创建一个新的ServerRunOptions对象
func NewServerRunOptions() *ServerRunOptions {
	s := ServerRunOptions{
		GenericServerRunOptions: genericoptions.NewServerRunOptions(),
        // 2. 创建 ETCD Options 实例
		Etcd:                    genericoptions.NewEtcdOptions(storagebackend.NewDefaultConfig(kubeoptions.DefaultEtcdPathPrefix, nil))
        ...
    }
	// Overwrite the default for storage data format.
	s.Etcd.DefaultStorageMediaType = "application/vnd.kubernetes.protobuf"

	return &s
}
// apiserver/pkg/server/options/etcd.go
// 2. etcd opitons
func NewEtcdOptions(backendConfig *storagebackend.Config) *EtcdOptions {
	options := &EtcdOptions{
		StorageConfig:           *backendConfig,
		DefaultStorageMediaType: "application/json",
		DeleteCollectionWorkers: 1,
		EnableGarbageCollection: true,
		EnableWatchCache:        true,
		DefaultWatchCacheSize:   100,
	}
	options.StorageConfig.CountMetricPollPeriod = time.Minute
	return options
}
```

每个 Options 对象都会实现以下方法:
1. AddFlags: 将 Options Struct 中的成员变量注册为 flag
2. Validate: 参数验证
3. Complete: 填充参数
4. ApplyTo: 将 Options Struct 实例转换成，每个子模块使用的 Config Struct 实例，本质上就是完成配置到程序所需对象的创建过程。

EtcdOptions AddFlags 实现如下，从实现可以看出，Struct 实例化时，相当于已经初始化了所有变量，直接使用结构体中的成员变量注册 flag 即可，而且可以直接省略变量在赋值的过程。

```go
func (s *EtcdOptions) AddFlags(fs *pflag.FlagSet) {
	if s == nil {
		return
	}

	fs.StringSliceVar(&s.EtcdServersOverrides, "etcd-servers-overrides", s.EtcdServersOverrides, ""+
		"Per-resource etcd servers overrides, comma separated. The individual override "+
		"format: group/resource#servers, where servers are URLs, semicolon separated. "+
		"Note that this applies only to resources compiled into this server binary. ")
}
```

创建完所有 Etcd Options 实例之后，ServerRunOptions 的 Flags 方法会使用 NamedFlagSets.FlagSet 创建一个新的 FlagSet 传递给 EtcdOptions.AddFlags:

```go
func (s *ServerRunOptions) Flags() (fss cliflag.NamedFlagSets) {
	// Add the generic flags.
	s.GenericServerRunOptions.AddUniversalFlags(fss.FlagSet("generic"))
	s.Etcd.AddFlags(fss.FlagSet("etcd"))

	// 添加 ServerRunOptions 内定义的参数
	fs := fss.FlagSet("misc")
	fs.DurationVar(&s.EventTTL, "event-ttl", s.EventTTL,
		"Amount of time to retain events.")

	fs.BoolVar(&s.AllowPrivileged, "allow-privileged", s.AllowPrivileged,
		"If true, allow privileged containers. [default=false]")
}
```

最终 NamedFlagSets 中的所有 FlagSet 的所有 Flag 都会添加到 Cobra Command 的 flag 中:

```go
fs := cmd.Flags()
for _, f := range namedFlagSets.FlagSets {
		fs.AddFlagSet(f)
}

func (f *FlagSet) AddFlagSet(newSet *FlagSet) {
	if newSet == nil {
		return
	}
	newSet.VisitAll(func(flag *Flag) {
		if f.Lookup(flag.Name) == nil {
			f.AddFlag(flag)
		}
	})
}
```

### 1.2 API Server 启动概述
当我们启动 API Server 时，Cobra 就会调用上面 Command 定义的 RunE，具体的过程如下:

```go
        func(cmd *cobra.Command, args []string) error {
			verflag.PrintAndExitIfRequested()
            // 1. 如上所述，所有 Options 都已经添加到 flag 中，fs 就可以获取到所有参数
			fs := cmd.Flags()

			// Activate logging as soon as possible, after that
			// show flags with the final logging configuration.
			if err := logsapi.ValidateAndApply(s.Logs, utilfeature.DefaultFeatureGate); err != nil {
				return err
			}
			cliflag.PrintFlags(fs)

			// 2. 参数填充
			completedOptions, err := Complete(s)
			if err != nil {
				return err
			}

			// v3. 参数验证
			if errs := completedOptions.Validate(); len(errs) != 0 {
				return utilerrors.NewAggregate(errs)
			}
			// add feature enablement metrics
			utilfeature.DefaultMutableFeatureGate.AddMetrics()
            // 4. 启动服务
			return Run(completedOptions, genericapiserver.SetupSignalHandler())
		}
```

`genericapiserver.SetupSignalHandler()` 返回一个捕捉信号的 chan:

```go
var shutdownSignals = []os.Signal{os.Interrupt}

// SetupSignalHandler注册了SIGTERM和SIGINT信号的处理函数，返回一个停止信道，在接收到这些信号时会关闭。
// 如果接收到第二个信号，程序将以退出码1退出。
// 只能调用SetupSignalContext和SetupSignalHandler之一，且只能调用一次。
func SetupSignalHandler() <-chan struct{} {
    return SetupSignalContext().Done()
}

// SetupSignalContext与SetupSignalHandler相同，但返回一个context.Context。
// 只能调用SetupSignalContext和SetupSignalHandler之一，且只能调用一次。
func SetupSignalContext() context.Context {
    close(onlyOneSignalHandler) // 第二次调用时会panic
    shutdownHandler = make(chan os.Signal, 2)

    ctx, cancel := context.WithCancel(context.Background())
    signal.Notify(shutdownHandler, shutdownSignals...)
    go func() {
        <-shutdownHandler
        cancel()
        <-shutdownHandler
        os.Exit(1) // 第二个信号，直接退出。
    }()

    return ctx
}
```

Run 启动 API Server:

```go
func Run(completeOptions completedServerRunOptions, stopCh <-chan struct{}) error {
	// To help debugging, immediately log version
	klog.Infof("Version: %+v", version.Get())

	klog.InfoS("Golang settings", "GOGC", os.Getenv("GOGC"), "GOMAXPROCS", os.Getenv("GOMAXPROCS"), "GOTRACEBACK", os.Getenv("GOTRACEBACK"))
    // 创建 API Server Chain
	server, err := CreateServerChain(completeOptions)
	if err != nil {
		return err
	}

    // PrepareRun 函数用于准备 API 聚合器运行，具体操作包括：
    // 1. 设置 OpenAPI 规范和聚合发现文档。
    // 2. 调用通用的 PrepareRun 函数。
	prepared, err := server.PrepareRun()
	if err != nil {
		return err
	}

	return prepared.Run(stopCh)
}
```
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