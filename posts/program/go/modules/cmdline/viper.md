---
weight: 1
title: "配置管理神 Viper"
date: 2021-06-21T22:00:00+08:00
lastmod: 2021-06-21T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go 项目的配置管理"
featuredImage: 

tags: ["go 库"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1. viper 
### 1.1 viper 简介
Viper 是适用于Go应用程序的完整配置解决方案。可以处理所有类型的配置需求和格式。作为配置管理器，Viper 按照如下的从高到低的优先级加载配置:
1. 代码显示调用Set设置值
2. 命令行参数（flag）
3. 环境变量
4. 配置文件
5. key/value存储
6. 默认值

Viper支持JSON、TOML、YAML、HCL、envfile和Java properties格式的配置文件。Viper可以搜索多个路径，但目前单个Viper实例只支持单个配置文件。Viper 不默认任何配置搜索路径，将默认决策留给应用程序。下面是一个如何使用Viper搜索和读取配置文件的示例。Viper 的使用大家可以参考: [Go语言配置管理神器——Viper中文教程](https://www.liwenzhou.com/posts/Go/viper/) 这里不在赘述，我们直接看源码。通过 [dumels](https://www.dumels.com/) 为 viper 生成的 UML 类图如下: 
1. 第一部分，位于 viper.go 这个文件，核心是定义了 Viper 这个 struct
2. 第二部分，位于 internal 内的 encoder/decoder，这一部分定义了各种配置文件解析和编码的方法。

![Viper 数据结构](/images/go/module/viper_1.png)


![编解码](/images/go/module/viper_2.png)

### 1.2 Viper 
前面我们简述了 Viper 配置加载的顺序。我们可以把 Viper 理解成一个大的容器，它支持上面所说的这么多种数据源:

```go
type Viper struct {
	// Delimiter that separates a list of keys
	// used to access a nested value in one go
	keyDelim string

	// A set of paths to look for the config file in
	configPaths []string

	// The filesystem to read config from.
	fs afero.Fs

	// A set of remote providers to search for the configuration
	remoteProviders []*defaultRemoteProvider

	// Name of file to look for inside the path
	configName        string
	configFile        string
	configType        string
	configPermissions os.FileMode
	envPrefix         string

	// Specific commands for ini parsing
	iniLoadOptions ini.LoadOptions

	automaticEnvApplied bool
	envKeyReplacer      StringReplacer
	allowEmptyEnv       bool

	parents        []string
	config         map[string]interface{}
	override       map[string]interface{}
	defaults       map[string]interface{}
	kvstore        map[string]interface{}
	pflags         map[string]FlagValue
	env            map[string][]string
	aliases        map[string]string
	typeByDefValue bool

	onConfigChange func(fsnotify.Event)

	logger Logger

	// TODO: should probably be protected with a mutex
	encoderRegistry *encoding.EncoderRegistry
	decoderRegistry *encoding.DecoderRegistry
}
```

不同的数据源可以通过如下方法进行设置:
1. 显示调用Set设置值: `viper.Set("redis.port", 5381)`
2. 命令行参数（flag）: `viper.BindPFlags(pflag.CommandLine)`
3. 环境变量: 
    - 绑定全部环境变量: `viper.AutomaticEnv()`
    - 绑定特定环境变量; `viper.BindEnv("redis.port")`
4. 配置文件: 见下
5. key/value存储: 见下
6. 默认值: `viper.SetDefault("redis.port", 6381)`

```go
// 4. 配置文件 
viper.SetConfigName("config")
viper.SetConfigType("toml")
viper.AddConfigPath(".")
viper.SetDefault("redis.port", 6381)
err := viper.ReadInConfig()
if err != nil {
log.Fatal("read config failed: %v", err)
}

// 5. key/value 存储
import _ "github.com/spf13/viper/remote"

viper.AddRemoteProvider("etcd3", "http://127.0.0.1:4001","/config/hugo.json")
viper.SetConfigType("json") // because there is no file extension in a stream of bytes, supported extensions are "json", "toml", "yaml", "yml", "properties", "props", "prop", "env", "dotenv"
err := viper.ReadRemoteConfig()
```

我们简单看一下，这些方法是如何把不同数据源的配置绑定到  Viper 内的:

```go
// 1. Set 值，值会绑定到 Viper override 属性上
func (v *Viper) Set(key string, value interface{}) {
	// If alias passed in, then set the proper override
	key = v.realKey(strings.ToLower(key))
	value = toCaseInsensitiveValue(value)

	path := strings.Split(key, v.keyDelim)
	lastKey := strings.ToLower(path[len(path)-1])
	deepestMap := deepSearch(v.override, path[0:len(path)-1])

	// set innermost value
	deepestMap[lastKey] = value
}

// 6. 设置默认值，默认值会绑定到 Viper defaults 属性上
func (v *Viper) SetDefault(key string, value interface{}) {
	// If alias passed in, then set the proper default
	key = v.realKey(strings.ToLower(key))
	value = toCaseInsensitiveValue(value)

	path := strings.Split(key, v.keyDelim)
	lastKey := strings.ToLower(path[len(path)-1])
	deepestMap := deepSearch(v.defaults, path[0:len(path)-1])

	// set innermost value
	deepestMap[lastKey] = value
}

// 2. 命令行参数，pflag 会绑定到 Viper pflags 属性上
func (v *Viper) BindPFlags(flags *pflag.FlagSet) error {
	return v.BindFlagValues(pflagValueSet{flags})
}
func (v *Viper) BindFlagValues(flags FlagValueSet) (err error) {
	flags.VisitAll(func(flag FlagValue) {
		if err = v.BindFlagValue(flag.Name(), flag); err != nil {
			return
		}
	})
	return nil
}
func (v *Viper) BindFlagValue(key string, flag FlagValue) error {
	if flag == nil {
		return fmt.Errorf("flag for %q is nil", key)
	}
	v.pflags[strings.ToLower(key)] = flag
	return nil
}

// 3. 环境变量，环境变量会绑定到 Viper env 属性上
func (v *Viper) BindEnv(input ...string) error {
	if len(input) == 0 {
		return fmt.Errorf("missing key to bind to")
	}

	key := strings.ToLower(input[0])

	if len(input) == 1 {
		v.env[key] = append(v.env[key], v.mergeWithEnvPrefix(key))
	} else {
		v.env[key] = append(v.env[key], input[1:]...)
	}

	return nil
}
```

### 1.3 Viper 配置文件解析
Viper 为配置文件加载和编码抽象出来了两个接口:

```go
type Decoder interface {
	Decode(b []byte, v map[string]interface{}) error
}

type Encoder interface {
	Encode(v map[string]interface{}) ([]byte, error)
}
```

以 json 为例，internal/encoding/json/codec.go 实现了这两个接口:

```go
package json

import (
	"encoding/json"
)

// Codec implements the encoding.Encoder and encoding.Decoder interfaces for JSON encoding.
type Codec struct{}

func (Codec) Encode(v map[string]interface{}) ([]byte, error) {
	// TODO: expose prefix and indent in the Codec as setting?
	return json.MarshalIndent(v, "", "  ")
}

func (Codec) Decode(b []byte, v map[string]interface{}) error {
	return json.Unmarshal(b, &v)
}
```

在初始化 Viper 会调用 viper.resetEncoding 方法，这个方法会注册所有配置文件解析的 Codec:

```go
// New returns an initialized Viper instance.
func New() *Viper {
	v := new(Viper)
	v.keyDelim = "."
	v.configName = "config"
	v.configPermissions = os.FileMode(0o644)
	v.fs = afero.NewOsFs()
	v.config = make(map[string]interface{})
	v.parents = []string{}
	v.override = make(map[string]interface{})
	v.defaults = make(map[string]interface{})
	v.kvstore = make(map[string]interface{})
	v.pflags = make(map[string]FlagValue)
	v.env = make(map[string][]string)
	v.aliases = make(map[string]string)
	v.typeByDefValue = false
	v.logger = jwwLogger{}

	v.resetEncoding()

	return v
}

func (v *Viper) resetEncoding() {
	encoderRegistry := encoding.NewEncoderRegistry()
	decoderRegistry := encoding.NewDecoderRegistry()

	{
		codec := yaml.Codec{}

		encoderRegistry.RegisterEncoder("yaml", codec)
		decoderRegistry.RegisterDecoder("yaml", codec)

		encoderRegistry.RegisterEncoder("yml", codec)
		decoderRegistry.RegisterDecoder("yml", codec)
	}
    ....
}
```

这里用到了一个 NewEncoderRegistry，其实内部就是一个 map，维护了格式名到 Codec 的映射:

```go
// EncoderRegistry can choose an appropriate Encoder based on the provided format.
type EncoderRegistry struct {
	encoders map[string]Encoder

	mu sync.RWMutex
}

// NewEncoderRegistry returns a new, initialized EncoderRegistry.
func NewEncoderRegistry() *EncoderRegistry {
	return &EncoderRegistry{
		encoders: make(map[string]Encoder),
	}
}

// RegisterEncoder registers an Encoder for a format.
// Registering a Encoder for an already existing format is not supported.
func (e *EncoderRegistry) RegisterEncoder(format string, enc Encoder) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, ok := e.encoders[format]; ok {
		return ErrEncoderFormatAlreadyRegistered
	}

	e.encoders[format] = enc

	return nil
}

func (e *EncoderRegistry) Encode(format string, v map[string]interface{}) ([]byte, error) {
	e.mu.RLock()
	encoder, ok := e.encoders[format]
	e.mu.RUnlock()

	if !ok {
		return nil, ErrEncoderNotFound
	}

	return encoder.Encode(v)
}
```

有了解析配置文件的方法，接下来就可以使用配置文件了:

```go
// 解析配置文件
// 注意: 单个 viper 实例支持一种配置文件
viper.SetConfigName("config")
viper.SetConfigType("toml")
viper.AddConfigPath(".")
err := viper.ReadInConfig()

func (v *Viper) SetConfigName(in string) {
	if in != "" {
		v.configName = in
		v.configFile = ""
	}
}

func (v *Viper) SetConfigType(in string) {
	if in != "" {
		v.configType = in
	}
}

func (v *Viper) AddConfigPath(in string) {
	if in != "" {
		absin := absPathify(v.logger, in)

		v.logger.Info("adding path to search paths", "path", absin)
		if !stringInSlice(absin, v.configPaths) {
			v.configPaths = append(v.configPaths, absin)
		}
	}
}
// 按照添加的路径搜索配置文件，并解析，解析后的配置存放在 Viper config 属性下
func (v *Viper) ReadInConfig() error {
	v.logger.Info("attempting to read in config file")
	filename, err := v.getConfigFile()
	if err != nil {
		return err
	}

	if !stringInSlice(v.getConfigType(), SupportedExts) {
		return UnsupportedConfigError(v.getConfigType())
	}

	v.logger.Debug("reading file", "file", filename)
	file, err := afero.ReadFile(v.fs, filename)
	if err != nil {
		return err
	}

	config := make(map[string]interface{})

	err = v.unmarshalReader(bytes.NewReader(file), config)
	if err != nil {
		return err
	}

	v.config = config
	return nil
}
```

### 1.4 Viper Key/Value 存储
#### RemoteConfig 读取方法的注册
使用 key/value 存储首先要导入 `import _ "github.com/spf13/viper/remote"`，目的是让 remote.go 内部的 init 函数执行:

```go
// remote.go
func init() {
	viper.RemoteConfig = &remoteConfigProvider{}
}

// viper.go
type remoteConfigFactory interface {
	Get(rp RemoteProvider) (io.Reader, error)
	Watch(rp RemoteProvider) (io.Reader, error)
	WatchChannel(rp RemoteProvider) (<-chan *RemoteResponse, chan bool)
}

// RemoteConfig is optional, see the remote package
var RemoteConfig remoteConfigFactory

type RemoteProvider interface {
	Provider() string
	Endpoint() string
	Path() string
	SecretKeyring() string
}
```
从上面的定义可以看到:
1. remoteConfigProvider 实现了接口 remoteConfigFactory
2. remoteConfigFactory 定义的所有方法接受 RemoteProvider 接口作为参数。

#### RemoteConfig 配置读取
我们以 etcd3 为例看看，viper 如何从 k/v 存储中读取配置:

```go
viper.AddRemoteProvider("etcd3", "http://127.0.0.1:4001","/config/hugo.json")
viper.SetConfigType("json") // because there is no file extension in a stream of bytes, supported extensions are "json", "toml", "yaml", "yml", "properties", "props", "prop", "env", "dotenv"
err := viper.ReadRemoteConfig()

// 添加 provider
func (v *Viper) AddRemoteProvider(provider, endpoint, path string) error {
	if !stringInSlice(provider, SupportedRemoteProviders) {
		return UnsupportedRemoteProviderError(provider)
	}
	if provider != "" && endpoint != "" {
		v.logger.Info("adding remote provider", "provider", provider, "endpoint", endpoint)

		rp := &defaultRemoteProvider{
			endpoint: endpoint,
			provider: provider,
			path:     path,
		}
		if !v.providerPathExists(rp) {
			v.remoteProviders = append(v.remoteProviders, rp)
		}
	}
	return nil
}

// 从 k/v store 读取数据
func (v *Viper) ReadRemoteConfig() error {
	return v.getKeyValueConfig()
}

// Retrieve the first found remote configuration.
func (v *Viper) getKeyValueConfig() error {
	if RemoteConfig == nil {
		return RemoteConfigError("Enable the remote features by doing a blank import of the viper/remote package: '_ github.com/spf13/viper/remote'")
	}

	if len(v.remoteProviders) == 0 {
		return RemoteConfigError("No Remote Providers")
	}

	for _, rp := range v.remoteProviders {
		val, err := v.getRemoteConfig(rp)
		if err != nil {
			v.logger.Error(fmt.Errorf("get remote config: %w", err).Error())

			continue
		}

		v.kvstore = val

		return nil
	}
	return RemoteConfigError("No Files Found")
}

// key/value 存储读取的配置，最终也是保存在 Viper 的 kvstore 属性上
func (v *Viper) getRemoteConfig(provider RemoteProvider) (map[string]interface{}, error) {
	reader, err := RemoteConfig.Get(provider)
	if err != nil {
		return nil, err
	}
	err = v.unmarshalReader(reader, v.kvstore)
	return v.kvstore, err
}
```

读取配置最终调用的 RemoteConfig.Get 即 remoteConfigProvider 的 Get 方法:

```go
// remote.go remoteConfigProvider
func (rc remoteConfigProvider) Get(rp viper.RemoteProvider) (io.Reader, error) {
	cm, err := getConfigManager(rp)
	if err != nil {
		return nil, err
	}
	b, err := cm.Get(rp.Path())
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(b), nil
}

func getConfigManager(rp viper.RemoteProvider) (crypt.ConfigManager, error) {
	var cm crypt.ConfigManager
	var err error

	endpoints := strings.Split(rp.Endpoint(), ";")
	if rp.SecretKeyring() != "" {
		var kr *os.File
		kr, err = os.Open(rp.SecretKeyring())
		if err != nil {
			return nil, err
		}
		defer kr.Close()
		switch rp.Provider() {
		case "etcd":
			cm, err = crypt.NewEtcdConfigManager(endpoints, kr)
		case "etcd3":
			cm, err = crypt.NewEtcdV3ConfigManager(endpoints, kr)
		case "firestore":
			cm, err = crypt.NewFirestoreConfigManager(endpoints, kr)
		default:
			cm, err = crypt.NewConsulConfigManager(endpoints, kr)
		}
	} else {
		switch rp.Provider() {
		case "etcd":
			cm, err = crypt.NewStandardEtcdConfigManager(endpoints)
		case "etcd3":
			cm, err = crypt.NewStandardEtcdV3ConfigManager(endpoints)
		case "firestore":
			cm, err = crypt.NewStandardFirestoreConfigManager(endpoints)
		default:
			cm, err = crypt.NewStandardConsulConfigManager(endpoints)
		}
	}
	if err != nil {
		return nil, err
	}
	return cm, nil
}

type defaultRemoteProvider struct {
	provider      string
	endpoint      string
	path          string
	secretKeyring string
}

func (rp defaultRemoteProvider) Provider() string {
	return rp.provider
}

func (rp defaultRemoteProvider) Endpoint() string {
	return rp.endpoint
}

func (rp defaultRemoteProvider) Path() string {
	return rp.path
}

func (rp defaultRemoteProvider) SecretKeyring() string {
	return rp.secretKeyring
}
```

#### 监听 RemoteConfig 配置变化
Viper 还提供了监听 k/v 存储配置变化的方法:

```go
// alternatively, you can create a new viper instance.
var runtime_viper = viper.New()

runtime_viper.AddRemoteProvider("etcd", "http://127.0.0.1:4001", "/config/hugo.yml")
runtime_viper.SetConfigType("yaml") // because there is no file extension in a stream of bytes, supported extensions are "json", "toml", "yaml", "yml", "properties", "props", "prop", "env", "dotenv"

// read from remote config the first time.
err := runtime_viper.ReadRemoteConfig()

// unmarshal config
runtime_viper.Unmarshal(&runtime_conf)

// open a goroutine to watch remote changes forever
go func(){
	for {
		time.Sleep(time.Second * 5) // delay after each request

		// currently, only tested with etcd support
		err := runtime_viper.WatchRemoteConfig()
		if err != nil {
			log.Errorf("unable to read remote config: %v", err)
			continue
		}

		// unmarshal new config into our runtime config struct. you can also use channel
		// to implement a signal to notify the system of the changes
		runtime_viper.Unmarshal(&runtime_conf)
	}
}()
```

监听的机制，由 remoteConfigProvider 提供:

```go
func WatchRemoteConfig() error { return v.WatchRemoteConfig() }
func (v *Viper) WatchRemoteConfig() error {
	return v.watchKeyValueConfig()
}

func (v *Viper) WatchRemoteConfigOnChannel() error {
	return v.watchKeyValueConfigOnChannel()
}

// Retrieve the first found remote configuration.
func (v *Viper) watchKeyValueConfig() error {
	if len(v.remoteProviders) == 0 {
		return RemoteConfigError("No Remote Providers")
	}

	for _, rp := range v.remoteProviders {
		val, err := v.watchRemoteConfig(rp)
		if err != nil {
			v.logger.Error(fmt.Errorf("watch remote config: %w", err).Error())

			continue
		}
		v.kvstore = val
		return nil
	}
	return RemoteConfigError("No Files Found")
}

func (v *Viper) watchRemoteConfig(provider RemoteProvider) (map[string]interface{}, error) {
	reader, err := RemoteConfig.Watch(provider)
	if err != nil {
		return nil, err
	}
	err = v.unmarshalReader(reader, v.kvstore)
	return v.kvstore, err
}

// Retrieve the first found remote configuration.
func (v *Viper) watchKeyValueConfigOnChannel() error {
	if len(v.remoteProviders) == 0 {
		return RemoteConfigError("No Remote Providers")
	}

	for _, rp := range v.remoteProviders {
		respc, _ := RemoteConfig.WatchChannel(rp)
		// Todo: Add quit channel
		go func(rc <-chan *RemoteResponse) {
			for {
				b := <-rc
				reader := bytes.NewReader(b.Value)
				v.unmarshalReader(reader, v.kvstore)
			}
		}(respc)
		return nil
	}
	return RemoteConfigError("No Files Found")
}
```

remoteConfigProvider 提供的
1. watch 方法跟 Get 方法实现完全一致，相当于重新读取一次 K/V 中的数据
2. WatchChannel 方法，利用的是 crypt.ConfigManager 提供的 List/Watch 机制

### 1.5 Viper 监听配置文件修改
Viper支持让应用程序在运行时实时读取配置文件的能力。

```go
viper.OnConfigChange(func(e fsnotify.Event) {
	fmt.Println("Config file changed:", e.Name)
})
viper.WatchConfig()

// WatchConfig starts watching a config file for changes.
func (v *Viper) WatchConfig() {
	initWG := sync.WaitGroup{}
	initWG.Add(1)
	go func() {
		watcher, err := newWatcher()
		if err != nil {
			log.Fatal(err)
		}
		defer watcher.Close()
		// we have to watch the entire directory to pick up renames/atomic saves in a cross-platform way
		filename, err := v.getConfigFile()
		if err != nil {
			log.Printf("error: %v\n", err)
			initWG.Done()
			return
		}

		configFile := filepath.Clean(filename)
		configDir, _ := filepath.Split(configFile)
		realConfigFile, _ := filepath.EvalSymlinks(filename)

		eventsWG := sync.WaitGroup{}
		eventsWG.Add(1)
		go func() {
			for {
				select {
				case event, ok := <-watcher.Events:
					if !ok { // 'Events' channel is closed
						eventsWG.Done()
						return
					}
					currentConfigFile, _ := filepath.EvalSymlinks(filename)
					// we only care about the config file with the following cases:
					// 1 - if the config file was modified or created
					// 2 - if the real path to the config file changed (eg: k8s ConfigMap replacement)
					if (filepath.Clean(event.Name) == configFile &&
						(event.Has(fsnotify.Write) || event.Has(fsnotify.Create))) ||
						(currentConfigFile != "" && currentConfigFile != realConfigFile) {
						realConfigFile = currentConfigFile
						err := v.ReadInConfig()
						if err != nil {
							log.Printf("error reading config file: %v\n", err)
						}
						if v.onConfigChange != nil {
							v.onConfigChange(event)
						}
					} else if filepath.Clean(event.Name) == configFile && event.Has(fsnotify.Remove) {
						eventsWG.Done()
						return
					}

				case err, ok := <-watcher.Errors:
					if ok { // 'Errors' channel is not closed
						log.Printf("watcher error: %v\n", err)
					}
					eventsWG.Done()
					return
				}
			}
		}()
		watcher.Add(configDir)
		initWG.Done()   // done initializing the watch in this go routine, so the parent routine can move on...
		eventsWG.Wait() // now, wait for event loop to end in this go-routine...
	}()
	initWG.Wait() // make sure that the go routine above fully ended before returning
}
```

用到的监听本地文件变化的方法由 fsnotify 提供:

```go
package viper

import "github.com/fsnotify/fsnotify"

type watcher = fsnotify.Watcher

func newWatcher() (*watcher, error) {
	return fsnotify.NewWatcher()
}
```