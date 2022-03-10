---
weight: 4
title: "go 工程化项目结构"
date: 2021-04-01T22:00:00+08:00
lastmod: 2021-04-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Go 工程化实践"
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


### 1.2 /pkg
/pkg
- 作用: 
    - 应用程序对外暴露的代码，可以其他应用和库导入使用
    - /pkg 目录可以显式地表示该目录中的代码对于其他人来说是可以安全使用的
- 说明: 

### 1.3 /internal
/internal
- 作用: 应用程序私有的库代码，存放不希望被其他应用或库导入的代码
- 说明: internal 是 Go1.4 提供的机制隔离机制

### 1.4 其他文件夹
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

## 2. 基础库/框架的项目结构
基础库 kit 为独立项目，公司级建议只有一个，按照功能目录来拆分会带来不少的管理工作，因此建议合并整合。kit 项目必须具备的特点:
- 统一
- 标准库方式布局
- 高度抽象
- 支持插件

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

### 3.2 /web
/web:
- 作用: 存放 Web 应用程序特定的组件：静态Web资源，服务器端模板和单页应用（Single-Page App，SPA）

## 4. 微服务的项目结构
前面我们介绍了标准应用和服务类应用的标注项目结构。这个结构对于一个项目来说通常是固定，也通常不会有太大的变化。但是设计到应用本身业务目录结构就需要跟不同的应用需求结合起来。这里我们就不讨论一些特殊应用的设计，而专注于微服务的业务项目结构设计。

微服务的项目结构与微服务背后的设计思想密切相关，也在不断的演化中，下面将分成几个阶段来介绍微服务的项目结构的演化过程。

### 4.1 微服务项目结构 V1

## 参考
1. [极客时间-毛剑老师的 Go 工程化实践](https://u.geekbang.org/subject/intro/100107201)
2. [Go项目标准布局](https://github.com/golang-standards/project-layout/blob/master/README_zh-CN.md)