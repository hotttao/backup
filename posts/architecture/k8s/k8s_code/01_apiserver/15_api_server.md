---
weight: 1
title: "API Server 组成概述"
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

## 1. API Server 命令行参数解析 
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

### 1.1 API Server 参数收集
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

### 1.2 NamedFlagSets

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

## 2. API Server 的核心对象
### 2.1 API Server 启动入口
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

### 2.2 信号捕捉
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

### 2.3 服务启动
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

我把 Run 执行过程画成了下面的脑图，其中:
1. ①红色字体标注的是 APIServer 实例在 apiExtensionsServer、kubeAPIServer、aggregatorServer 中的传递过程
2. 其他数字标识了 Config 的初始化顺序和依赖关系
3. ⑨标识了，一些重要的基础对象

![API Server 启动过程](/images/k8s/k8s_use/kube_apiserver_start.png)

apiExtensionsServer、kubeAPIServer、aggregatorServer 各个对象之间的关系如下图所示:

![API Server 核心对象之间的关系](/images/k8s/k8s_use/kube_apiserver.png)
