---
weight: 4
title: "go 工程化项目结构"
date: 2021-04-01T22:00:00+08:00
lastmod: 2021-04-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 工程化实践-项目结构"
featuredImage: 

tags: ["go 惯例"]
categories: ["Go"]

lightgallery: true

---

最近几篇文章与 Go 工程化方面有关，算是我们 Go 语言学习的第二部分，了解一门语言的惯例，即最佳实践。无论是做什么开发，在做之前先 google 一下 best practice 是一个非常好的习惯。今天这篇文章与 go 工程化项目结构有关，知识来自于 [极客时间-毛剑老师的 Go 工程化实践](https://u.geekbang.org/subject/intro/100107201)。

## 1. 标准应用的项目结构
一个标准的 Go 项目通常会包含下面这些目录:

### 1.1 /cmd
/cmd
- 作用: 存放应用程序的启动入口
- 内容:
    - /cmd/myapp
    - /cmd/myapp-build
- 说明:
    - go 在编译时默认生成二进制文件与文件夹同名，因此为了生成有意义的二进制文件，通常需要在 cmd 在创建一个与项目同名的目录，存放程序的入口 main.go
    - main.go 内通常只做这么几个事情:
        - 资源初始化，包括数据连接等等
        - 启动监听
        - 信号拦截
        - 服务发现和注册
    - main.go 里面所做的事情就是一个**应用的生命周期管理**，可以参考 [kratos](https://github.com/go-kratos/kratos/blob/main/README_zh.md) 里面的设计

```shell
.
└── cmd
    ├── demo
    │   ├── demo
    │   └── main.go
    └── myapp
        ├── main.go
        └── myapp

```

### 1.2 /pkg
/pkg
- 作用: 
    - 应用程序对外暴露的代码，可以其他应用和库导入使用
    - /pkg 目录可以显式地表示该目录中的代码对于其他人来说是可以安全使用的
- 说明: 

```
└── pkg
    ├── cache
    │   ├── memcache
    │   └── redis
    └── conf
        ├── dsn
        ├── env
        ├── flagvar
        └── paladin

```

### 1.3 /internal
/internal
- 作用: 应用程序私有的库代码，存放不希望被其他应用或库导入的代码
- 说明: internal 是 Go1.4 提供的机制隔离机制

internal 内的第一层目录通常是与 /cmd 定义的应用相对的，比如像下面这样，表示每个服务私有的代码库
```bash
└── internal
    ├── demo
    ├── myapp
```

同时 internal 下也可以有 pkg 目录(/internal/pkg)，表示跨应用的私有库共享库目录。具体到 /internal/myapp 下具体应用包含的内容与应用在编写时所采纳的编程思想有关，后面我们在着重介绍微服务时，会更详细的探讨这一层级的目录应该如何组织。

### 1.4 其他文件夹
除了前面介绍了两个重要的顶级目录 /internal 和  /pkg 外，一个标准应用通常还会包含如下目录:
1. /init: 系统初始化（systemd、upstart、sysv）和进程管理（runit、supervisord）配置。
2. /scripts: 
    - 用于执行各种构建，安装，分析等操作的脚本。
    - 这些脚本使根级别的Makefile变得更小更简单（例如 [Makefile](https://github.com/hashicorp/terraform/blob/master/Makefile) ）。
    - 更多样例查看[/scripts](https://github.com/golang-standards/project-layout/blob/master/scripts/README.md)。
3. /build: 
    - 打包和持续集成
    - 将云（AMI），容器（Docker），操作系统（deb，rpm，pkg）软件包配置和脚本放在/build/package目录中
    - 将CI（travis、circle、drone）配置文件和就脚本放在build/ci目录中。
    - 请注意，有一些CI工具（如，travis CI）对于配置文件的位置有严格的要求。尝试将配置文件放在/build/ci目录，然后链接到CI工具想要的位置
4. /deploy
    - IaaS，PaaS，系统和容器编排部署配置和模板（docker-compose，kubernetes/helm，mesos，terraform，bosh）
    - 请注意，在某些存储库中（尤其是使用kubernetes部署的应用程序），该目录的名字是/deploy
5. /test
    - 外部测试应用程序和测试数据。随时根据需要构建/test目录。
    - 对于较大的项目，有一个数据子目录更好一些。
    - 例如，如果需要Go忽略目录中的内容，则可以使用/test/data或/test/testdata这样的目录名字。
    - 请注意，Go还将忽略以“.”或“_”开头的目录或文件，因此可以更具灵活性的来命名测试数据目录。
    - 更多样例查看[/test](https://github.com/golang-standards/project-layout/blob/master/test/README.md)。
6. /docs: 
    - 设计和用户文档（除了godoc生成的文档）
    - 更多样例查看[/docs](https://github.com/golang-standards/project-layout/blob/master/docs/README.md)。
7. /tools
    - 此项目的支持工具
    - 请注意，这些工具可以从/pkg和/internal目录导入代码。
    - 更多样例查看[/tools](https://github.com/golang-standards/project-layout/blob/master/tools/README.md)。
8. /examples
    - 应用程序或公共库的示例。
    - 更多样例查看[/examples](https://github.com/golang-standards/project-layout/blob/master/examples/README.md)。
9. /third_party
    - 外部辅助工具，fork的代码和其他第三方工具（例如Swagger UI）。
10. /githooks
    - Git的钩子
11. /assets
    - 项目中使用的其他资源（图像，Logo等）。
12. /website
    - 如果不使用Github pages，则在这里放置项目的网站数据。
    - 更多样例查看[/website](https://github.com/golang-standards/project-layout/blob/master/website/README.md)。

最后不要再项目中包含 /src 目录。

### 1.5 多应用的项目的目录结构
上面描述的标准应用目录结构式针对的是单应用的，如果你公司内部有很多 app，如果为每个 app 都创建一个 git 仓库，可能也会难以管理。而且有些应用在领域驱动的划分中虽然属于不同的服务但是彼此之间又有比较密切的联系，这时候我们就可以在一个 git 仓库中存放多个 app。此时我们可以在顶层目录中加一个 /app 目录，如下图所示。然后每个 /app/account 子应用的目录内是一个标准应用的目录结构，包含上面介绍的多个目录。

```bash
├── app
│   ├── account  # account 服务应用目录
│   │   ├── pkg
│   │   ├── internal
│   ├── video    # video 服务应用目录
│   │   ├── pkg
│   │   ├── internal
└── pkg
```

## 2. 基础库/框架的项目结构
每个公司应该为不同的微服务项目建立一个统一的 kit 工具包项目(基础库和框架)。统一的 kit 工具可以对微服务的项目结构、配置管理等做统一的强制性约束，避免管理上的混乱。基础库 kit 为独立项目，公司级建议只有一个，因为按照功能目录来拆分会带来不少的管理工作，因此建议合并整合。kit 项目必须具备如下的特点:
- 统一
- 标准库方式布局
- 高度抽象
- 支持插件

kit 库的项目结构以及功能可以参考 B 站开源的 [kratos](https://github.com/go-kratos/kratos) 框架，后面我们会有专门的系列来解析这个库的源码。下面是其目录结构:

```bash
tree . -L 2
.
tree -L 1  -s
.
├── [         37]  api
├── [       4403]  app.go
├── [       4722]  app_test.go
├── [         71]  cmd
├── [         39]  codecov.yml
├── [       5219]  CODE_OF_CONDUCT.md
├── [       4096]  config
├── [         73]  contrib
├── [       4402]  CONTRIBUTING.md
├── [         48]  docs
├── [       4096]  encoding
├── [       4096]  errors
├── [        653]  go.mod
├── [      18279]  go.sum
├── [       4096]  hack
├── [        104]  internal
├── [       1066]  LICENSE
├── [       4096]  log
├── [       2795]  Makefile
├── [         47]  metadata
├── [         39]  metrics
├── [       4096]  middleware
├── [       2129]  options.go
├── [       3091]  options_test.go
├── [       8096]  README.md
├── [       7111]  README_zh.md
├── [         40]  registry
├── [       1510]  ROADMAP.md
├── [        560]  SECURITY.md
├── [       4096]  selector
├── [         63]  third_party
├── [         71]  transport
└── [         83]  version.go
```


### 3. 服务类应用的项目结构
服务类应用相对于标准应用，会多出如下几个目录

### 3.1 /api
/api
- 作用: api 协议定义目录，例如存放 OpenAPI/Swagger规范，JSON模式文件，xxxapi.protobuf
- 示例: [/api](https://github.com/golang-standards/project-layout/blob/master/api/README.md)
- 说明:
    - 如果有项目依赖 /api 里面定义的 protobuf 文件，项目应该把这个 pb 文件拷贝到自己的项目中，并自己生成访问的 client 代码
    - /api pb 生成的 server 代码则应该放到 /internel 目录中，从而避免其他人可以依赖生成的 server 代码

### 3.2 /cmd
对于微服务，/cmd 内服务的入口，有一些特殊的约定的命名规范。微服务中的 app 服务类型分为4类：
1. interface: 对外的 BFF 服务，接受来自用户的请求，比如暴露了 HTTP/gRPC 接口
2. service: 对内的微服务，仅接受来自内部其他服务或者网关的请求，比如暴露了gRPC 接口只对内服务
3. job: 流式任务处理的服务，上游一般依赖 message broker
4. admin: 区别于 service，更多是面向运营测的服务，通常数据权限更高，隔离带来更好的代码级别安全
5. task: 定时任务，类似 cronjob，部署到 task 托管平台中

```bash
└── cmd
    └── myapp
        ├── myapp-admin
        ├── myapp-interface
        ├── myapp-job
        ├── myapp-services
        └── myapp-task
```

### 3.2 /web
/web:
- 作用: 存放 Web 应用程序特定的组件：静态Web资源，服务器端模板和单页应用（Single-Page App，SPA）

## 4. 微服务的项目结构
前面我们介绍了标准应用和服务类应用的标注项目结构。这个结构对于一个项目来说通常是固定，也通常不会有太大的变化。而唯一会变化的则是需要结合应用需求设计的 /internal 目录。这里我们就不讨论一些特殊应用的设计，而专注于微服务的业务项目结构设计。

微服务的项目结构与微服务背后的设计思想密切相关，也在不断的演化中，下面将分成几个阶段来介绍微服务的项目结构的演化过程。

### 4.1 微服务的 /cmd
微服务中的 app 服务类型分为4类：interface、service、job、admin。
1. interface: 对外的 BFF 服务，接受来自用户的请求，比如暴露了 HTTP/gRPC 接口。
2. service: 对内的微服务，仅接受来自内部其他服务或者网关的请求，比如暴露了gRPC 接口只对内服务。
3. admin：区别于 service，更多是面向运营测的服务，通常数据权限更高，隔离带来更好的代码级别安全。
4. job: 流式任务处理的服务，上游一般依赖 message broker。
5. task: 定时任务，类似 cronjob，部署到 task 托管平台中。

所以微服务应用的 /cmd 目录会包含如下几个入口:

```shell
myapp-interface
myapp-service
myapp-admin
myapp-job
myapp-task
```

### 4.1 微服务项目结构 V1
V1 版本的项目结构采用的是典型的 MVCC 三层架构，/internal/myapp 下包含了如下几个目录:
1. /model: 
    - 作用: 公共模型层，面向数据库表，即服务层
    - 说明: 放对应“存储层”的结构体，是对存储的一一隐射
2. /dao: 
    - 作用: 数据访问层，面向业务需求，即展示层
    - 说明: 数据读写层，数据库和缓存全部在这层统一处理，包括 cache miss 处理。
3. /service: 
    - 作用: 业务逻辑层
    - 说明: 组合各种数据访问来构建业务逻辑
4. /server: 
    - 作用: 存放路由以及一些 DTO 对象转换的代码，依赖 proto 定义的服务作为入参，提供快捷的启动服务全局方法

在 MVCC 的模型中，项目的依赖路径为: model -> dao -> service -> api，model struct 串联各个层，直到 api 需要做 DTO 对象转换。

/api 定义了 API proto 文件，和生成的 stub 代码，它生成的 interface，其实现者在 service 中。service 的方法签名因为实现了 API 的 接口定义，DTO 直接在业务逻辑层直接使用了，更有 dao 直接使用，最简化代码。

### 4.2 微服务项目结构 V2
V2 版本的项目结构采用的是领域编程的思想，/internal/myapp 下包含了如下几个目录:
1. biz: 
    - 作用: 业务逻辑的组装层，类似 DDD 的 domain 领域层
    - 说明: data 类似 DDD的 repo，repo 接口在这里定义，使用依赖倒置的原则
    - 目的: 由业务层去定义数据访问的接口，data 去实现业务定义的接口，抽象数据的访问
2. data: 
    - 作用: 业务数据访问，包含 cache、db 等封装，实现了 biz 的 repo接口
    - 说明: 我们可能会把 data 与 dao 混淆在一起，data 偏重业务的含义，它所要做的是将领域对象重新拿出来，我们去掉了 DDD 的 infra 层。
3. service: 
    - 作用: 实现了 api 定义的服务层，类似 DDD 的 application 层，处理 /api 内定义的 grpc 到 biz 领域实体的转换(DTO -> DO)，同时协同各类 biz 交互，但是不应处理复杂逻辑。

![V2中的对象转换过程](/images/go/practice/domain_trans.png)

注:
1. DO(Domain Object): 领域对象，就是从现实世界中抽象出来的有形或无形的业务实体。
2. PO(Persistent Object): 持久化对象，它跟持久层（通常是关系型数据库）的数据结构形成一一对应的映射关系，如果持久层是关系型数据库，那么数据表中的每个字段（或若干个）就对应 PO 的一个（或若干个）属性。https://github.com/facebook/ent 

#### 设计思想
V2 的结构设计就是将 DDD 设计中的一些思想和工程结构做了一些简化，映射到 api、service、biz、data 各层。

![V2设计思想](/images/go/practice/ddd.png)

## 5. 应用的声明周期 LifeCycle
Lifecycle 需要考虑服务应用的对象初始化以及生命周期的管理，所有 HTTP/gRPC 依赖的前置资源初始化，包括 data、biz、service，之后再启动监听服务。我们可以使用 https://github.com/google/wire ，来管理所有资源的依赖注入。

## 参考
1. [极客时间-毛剑老师的 Go 工程化实践](https://u.geekbang.org/subject/intro/100107201)
2. [Go项目标准布局](https://github.com/golang-standards/project-layout/blob/master/README_zh-CN.md)
2. [DDD 设计思想]()
3. [洋葱架构/整洁架构]()