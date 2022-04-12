---
weight: 1
title: "OpenTelemetry 概念"
date: 2021-04-01T22:00:00+08:00
lastmod: 2021-04-01T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "微服务里的分布式链路追踪"
featuredImage: 

tags: ["opentelemetry"]
categories: ["architecture"]

lightgallery: true
---

Distributed Tracing(分布式跟踪)或者更进一步叫 APM(Application Performance Monitoring) 是微服务中非常重要的基础设施。接下来的几篇文章里面，我们就来简单学习一下分布式链路事实上的标准 OpenTelemetry。OpenTelemetry 谷歌到的学习资料并不是非常多，以下是博客参考的资料来源:
1. [https://alovn.cn](https://alovn.cn/docs/opentelemetry/)
2. [OpenTelemetry 概念](https://github.com/open-telemetry/docs-cn/blob/main/specification/overview.md)
3. [OpenTelemetry 快速入门](https://github.com/open-telemetry/docs-cn/blob/main/QUICKSTART.md)
4. [OpenTelemetry for Kubernetes](https://github.com/open-telemetry/docs-cn/blob/main/community/opentelemtryCollector/kubernetes-guide.md)
5. [OpenTelemetry Instrumentation](https://opentelemetry.io/docs/instrumentation/python/)
6. [Kratos OpenTelemetry](https://go-kratos.dev/blog/go-kratos-opentelemetry-practice)


## 1. OpenTelemetry 简介
OpenTelemetry 的简介推荐大家可以读一读[https://alovn.cn](https://alovn.cn/docs/opentelemetry/)。可以说 OpenTelemetry 终极目标是为了实现 **Metrics、Tracing、Logging** 的融合及大一统，作为APM的数据采集终极解决方案。
1. Tracing：提供了一个请求从接收到处理完成整个生命周期的跟踪路径，一次请求通常过经过N个系统，因此也被称为分布式链路追踪
2. Metrics：例如cpu、请求延迟、用户访问数等Counter、Gauge、Histogram指标
3. Logging：传统的日志，提供精确的系统记录

这三者的组合可以形成大一统的APM解决方案：
1. 基于Metrics告警发现异常
2. 通过Tracing定位到具体的系统和方法
3. 根据模块的日志最终定位到错误详情和根源
4. 调整Metrics等设置，更精确的告警/发现问题

如果在结合 Code Profiling 技术和 Watchdog 就可以为我们定位线上问题提供一个非常完善的工具链。但是 Tracing、Metrics、Logging 该如何融合呢？在以往对APM的理解中，这三者都是完全独立的，但是随着时间的推移，人们逐步发现了三者之间的关联，例如我们可以**把Tracing的TraceID打到Logging的日志中**，这样可以把分布式链路跟踪和日志关联到一起，彼此数据互通，但是还存在以下问题：
1. 如何把Metrics和其他两者关联起来
2. 如何提供更多维度的关联，例如请求的方法名、URL、用户类型、设备类型、地理位置等
3. 关联关系如何一致，且能够在分布式系统下传播

在OpenTelemetry中试图使用Context为Metrics、Logging、Tracing提供统一的上下文，三者均可以访问到这些信息，同时Context可以随着请求链路的深入，不断往下传播
1. Context数据在Task/Request的执行周期中都可以被访问到
2. 提供统一的存储层，用于保存Context信息，并保证在各种语言和处理模型下都可以工作（例如单线程模型、线程池模型、CallBack模型、Go Routine模型等）
3. 多种维度的关联基于元信息(标签)实现，元信息由业务确定，例如：通过Env来区别是测试还是生产环境等
4. 提供分布式的Context传播方式，例如通过W3C的traceparent/tracestate头、GRPC协议等

OpenTelemetry 的自身定位很明确：数据采集和标准规范的统一，对于数据如何去使用、存储、展示、告警，官方是不涉及的(目前推荐使用Prometheus + Grafana做Metrics存储、展示，使用Jaeger做分布式跟踪的存储和展示)。这样一个定位和目的，对 OpenTelemetry 的实现提出了很多要求:
1. 多语言支持低侵入: 显然作为基础设施， OpenTelemetry 必然要支持多种语言，而不能过于侵入代码
2. 多实现支持: 兼容已有的分布式链路实现
3. 低性能损耗: 不能过多的抢占线上业务的资源

显然，OpenTelemetry 必然是高度抽象，在设计上也有很多技巧，而这两个方面正是我们学习 OpenTelemetry 的关键。

![Reference_Architecture](/images/opentelemetry/Reference_Architecture.svg)



## 3. OpenTelemetry 的抽象
### 3.1 Traces(分布式链路追踪)
#### Traces
Traces 代表分布式链路追踪，在OpenTelemetry中 Traces 是通过 Spans 来进一步定义的. 我们可以把一个Trace想像成由 Spans组成的有向无环图（DAG）, 图的每条边代表了Spans之间的关系——父子关系。下面是一个 Traces 的示例:
```shell
下图展示了在一个Trace中Spans之间常见的关系


        [Span A]  ←←←(根Span(root span)))
            |
     +------+------+
     |             |
 [Span B]      [Span C] ←←←(Span C是Span A的孩子)
     |             |
 [Span D]      +---+-------+
               |           |
           [Span E]    [Span F] 
```

有时候我们可以用时间轴的方式来更简单的可视化Traces，如下图：

```shell
––|–––––––|–––––––|–––––––|–––––––|–––––––|–––––––|–––––––|–> 时间轴

 [Span A···················································]
   [Span B··············································]
      [Span D··········································]
    [Span C········································]
         [Span E·······]        [Span F··]
```

#### Span
Span 代表了Trace中的某一个片段，每个Span都封装了以下状态:
1. 一个操作名An operation name
2. 开始/结束时间戳A start and finish timestamp
3. Key:Value形式的属性集合，Key必须是字符串，Value可以是字符串、布尔或者数字类型
4. 0个或者多个事件(Event), 每个事件都是一个Key:Value Map和一个时间戳
5. 该Span的父Span ID
6. Links(链接)到0个或多个有因果关系的Spans (通过那些Spans的SpanContext).
7. 一个Span的SpanContext ID

#### SpanContext
SpanContext 是 span 的上下文，包含所有能够识别 Trace 中某个Span的信息，而且该信息必须要跨越进程边界传播到子Span中。一个SpanContext包含了将会由父Span传播到子Span的跟踪ID和一些设置选项。
1. TraceId 是一条Trace的全局唯一ID，由16个随机生成的字节组成,TraceID用来把该次请求链路的所有Spans组合到一起
2. SpanId 是Span的全局唯一ID，由8个随机生成的字节组成，当一个SpanID被传播到子Span时，该ID就是子Span的父SpanID
3. TraceFlags 代表了一条Trace的设置标志，由一个字节组成(里面8个bit都是设置位) 例如采样Bit位用于设置了该Trace是否要被采样（掩码0x1).
4. Tracestate 携带了具体的跟踪内容，表现为`[{key:value}]`的键指对形式,Tracestate 允许不同的 APM 提供商加入额外的自定义内容和对于旧ID的转换处理，更多内容请查看[这里](https://w3c.github.io/trace-context/#tracestate-field).

#### Span Links
一个Span可以和多个其它Span产生具有因果关系的链接(通过SpanContext定义)。这些链接可以指向某一个Trace内部的SpanContexts，也可以指向其它的Traces。

Links可以用来代表如下一些操作：
1. 一个Span需要多个Span进行初始化。
2. 申明原始trace和后续trace之间的关系，例如Trace进入了一个受信边界，进入后需要重新生成一个新的Trace。新的被链接的Trace也可以用来代表，被许多快速进入的请求所依赖的一个长时间运行的异步数据处理操作。

在上述分散/聚合模式下，当根操作开启多个下游处理时，这些都会最终聚合到一个Span中，这个最后的Span被链接到它所聚合的多个操作中。最后的 Span 将会被进行聚合其操作的 Span 所链接，这些 Span 都是来自同一个Trace，类似于 Span 的 parent 字段。 但是建议在这个场景下，建议不要设置 Span 的 parent字段，因为从语义上来说，parent字段表示单亲场景，父 Span 将完全包含子Span的所有范围，但是在分散/聚合模式和批处理场景下并不是如此。

### 3.2 Metrics(指标)
Metrics 约定了以下内容:
1. 如何采集指标的原始数据
2. 如何对原始数据进行聚合以生成指标值

因此在 Metrics 中有三个核心的抽象:
1. Measure 表示通过使用某一个库采集到的独立的数据。同时它还在采集数据和聚合数据之间定义了一个合约，最终结果会进入 Metric。 Measure 由名称、描述和一系列单位值组成。
2. Measurement 描述了该如何采集数据（采集的数据就是 Measure）。Measurement 是一个空的API接口，这个接口由具体的采集SDK实现。
3. Metric：指标的抽象
   1. 继承自Metric的类定义了聚合的类型，定义了基本的指标属性：名称、标签。
   2. 包含一些独立的 Measurements，用于收集指标原始数据
   3. 记录一些上下文信息，可以自定义如何聚合 Measurement，同时可以使用上下文信息对最终指标结果进行额外的定义。

我们的API预定义了一些预聚合的指标：
1. Counter(计数器)指标，瞬时测量值。Counter的值可以增长也可以保持不变，但是不降低。Counter的值不能为负数， Counter有两种类型：double和long
2. Gauge(实时值)指标，它也是一种瞬时测量值。与Counter不同的是，Gauges可以上下变动，也可以为负数。Gauges也有两种类型： double和long

所以显然 Metrics 与 Measurement 的实现之间的数据交换需要有一个约束，这就是指标数据模型（Metrics Data Model）。

指标数据模型是在SDK中定义的，基于 [metrics.proto](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/metrics/v1/metrics.proto)协议。该数据模型被所有 OpenTelemetry 导出器(**exporters**)作为数据输入来使用。不同的导出器有不同的能力(例如支持哪种数据类型)， 还有不同的限制(例如在标签Key中哪些字符被允许)。所有的导出器都通过OpenTelemetry SDK中定义的**指标生产者接口(Metric Producer interface)**从数据指标模型中消费数据，

因为上面的原因，指标对于数据本身是做了最小限制的(例如在标签Key中支持哪些字符)，处理指标的代码应该避免对这些指标数据进行 验证和净化。你应该做的是：把这些数据传到服务器端，让服务器端来做验证，然后从服务器端接收错误。

### 3.3 Logs
日志与 OpenTelemetry 交互是简单的，只要约定好日志的解析格式即可。[Log数据模型](https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/logs/data-model.md) 定义了OpenTelemetry如何解析日志和事件。

### 3.4 Baggage
除了Trace传播之外，OpenTelemetry还提供了一个简单的机制来传播键指对，这一机制被称为Baggage。Baggage 可以为一个服务查看可观测事件提供索引， 其属性则是**由同一个事务的前一个服务提供**。这有助于在各个事件之间建立因果关系。虽然Baggage也为其他横切关注点的实现提供了原型，但是这一机制主要还是为了**在OpenTelemetry所观测的系统之间进行值传递**。

下面这些值可以在Baggage中进行使用，并提供额外维度的metric指标或者为trace追踪和log日志提供额外的上下文内容。下面是一些例子：
1. 一个web服务提供方可以在上下文中得到服务的调用方的信息
2. Saas提供者可以在上下文中记录API的使用者及其持有令牌的信息
3. 可以确定特定的浏览器版本与图像处理服务的故障的关联关系

为了让 OpenTracing 向后兼容，当使用 OpenTracing bridge 的时候 Baggage 将以 Baggage 进行传播。具有不同标准的新的关注点应该去新建一个横切关注点来覆盖其用例。 这些新的关注点可能受益于 W3C 编码格式，但是需要使用新的 HTTP 头来在分布式追踪中传播数据。

### 3.4 Resources
Resource记录当前发生采集的实体的信息(虚拟机、容器等)，例如，Metrics如果是通过Kubernetes容器导出的，那么resource可以记录 Kubernetes集群、命名空间、Pod和容器名称等信息。Resource也可以包含实体信息的层级结构，例如它可以描述云服务器/容器和跑在其中的应用。

### 3.5 Propagators(传播者)
Propagators 用来序列化和反序列化中的关注点，比如 Span（通常仅限于SpanContext部分）和Baggage。 不同的Propagator的类型定义了特定传输方式下的限制并将其绑定到一个数据类型上。传播者Propagators API定义了一个Propagator类型：TextMapPropagator 可以将值注入文本，也可以从文本当中提取值。

### 3.6 Collector
OpenTelemetry collector是由一系列组件组成的，这些组件可以使用OpenTelemetry或三方SDK(Jaeger、Prometheus等)收集trace跟踪、metric指标和日志等数据， 然后对这些数据进行聚合、智能采样，再导出到一个监控后端。Collector将允许加工转换收集到的数据（比如添加额外属性或者删除隐私数据）。

OpenTelemetry服务由两个主要的模型：Agent(一个本地代理)和Collector(一个独立运行的服务)。

### 3.7 Instrumentation Library
一个库实现了 OpenTelemetry观测能力的库叫做Instrumentation Library。这么做的目的是让各个库和应用程序通过直接调用 OpenTelemetry的API来达到开箱即用的目标。但是，大部分库不会做这样的集成，因此需要一个单独的库来注入 这样这样的调用，通过诸如包装接口，订阅特定库的回调或者将当前的监测模型改为OpenTelemetry模型等机制来实现。一个Instrumentation Library的命名应该遵循任意关于对于这个库的命名规范(比如web框架的'中间件')。如果没有已经确定的名称，建议在包前面加上“opentelemetry instrumentation”前缀，然后加上被集成的库名称本身。

## 4. OpenTelemetry 库的设计层次
