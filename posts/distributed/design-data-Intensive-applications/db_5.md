---
title: 5. 数据编码与演化
date: 2019-04-05
categories:
    - 分布式
tags:
    - 数据密集型应用
---

构建可适应变化的系统

<!-- more -->

## 1. 数据的演化
应用程序不可避免的需要随时间而变化，大多数情况下，应用程序的更改也需要更改其存储的数据: 增删字段或者以新的方式呈现数据。当数据格式或模式发生变化时，同样也需要对应用程序代码进行相应调整。

代码的升级往往需要一定时间，这意味着**新旧版本的代码**，以及**新旧数据格式**，可能会同时在系统内共存。此时我们就需要双向兼容:
1. 向后兼容: 新代码可以读取由旧代码编写的旧数据
2. 向前兼容: 就代码可以读取由新代码编写的新数据

向前兼容比较棘手，需要旧代码预知未来，忽略新版本的代码所做的添加。接下来将介绍多种编码数据的格式，包括 JSON，XML，Protocol Buffers、Thrift、Avro。我们将讨论它们如何处理**模式变化**、如何支持**新旧数据和新旧代码共存**。还将讨论这些格式如何用于**数据存储和通信**，包括 Web 服务，具象状态传输(REST)、远程过程调用以及消息传递系统。

向前向后兼容对于可演化性非常重要，通过允许独立升级系统的不同部分，而不是一次改变所有，是的更改更加容易。兼容性是**执行编码的一个进程有u执行解码的另一进程之间的关系**。

## 2. 数据编码格式
程序通常使用至少两种不同的数据表示形式:
1. 内存中，数据保存在对象、结构体等等数据结构中，这些数据结构针对 CPU 高效访问和操作进行了优化(使用指针)
2. 将数据写入文件或者通过网络发送时，必须将其编码为某种**自包含的字节序列**(指针对其他进程没有意义)

从内存中的表示到字节序列称为编码(序列化)，相反的过程称为解码(反序列化)。数据编码格式分为如下几类:
1. 语言特定格式
2. JSON、XML与二进制变体
3. Thrift 与 Protocol Buffers
4. Avro

### 2.1 语言特定格式
编程语言都内置架构内存中的对象编码为字节序列，比如 Java io.Serializable、Ruby Marshal、Python pickle。通常在语言内部使用起来非常方便，但他们都存在下面这些问题:
1. 跨语言非常困难
2. 安全问题
3. 便捷性是首要，通常忽略向前和向后兼容等问题
4. 效率问题

所以使用语言内置的编码方案通常不是个好主意，仅作为临时尝试。

### 2.2 JSON、XML与二进制变体
JSON，XML和CSV是文本格式，因此具有人类可读性，但它们都有一些微妙问题:
1. 数字的编码多有歧义之处:
    - XML和CSV不能区分数字和字符串（除非引用外部模式）
    - JSON 不区分整数和浮点数，而且不能指定精度
2. JSON和XML对Unicode字符串（即人类可读的文本）有很好的支持，但是它们不支持二进制数据（不带字符编码(character encoding)的字节序列），使用Base64将二进制数据编码为文本来绕开这个限制
3. XML 和 JSON都有可选的模式支持，但是学习和实现起来都比较复杂(模式，就是数据类型的说明)
4. CSV 没有任何模式，完全由应用程序定义

尽管存在这些那些缺陷，但JSON，XML和CSV已经足够用于很多目的。特别是作为**数据交换格式**（即将数据从一个组织发送到另一个组织），它们很可能仍然很受欢迎。这种情况下，只要人们对格式是什么意见一致，格式多么美观或者高效就没有关系。让不同的组织达成一致的难度超过了其他大多数问题。

### 2.3 二进制编码
数据到达一定规模后，数据格式的选择会产生很大的 影响。与二进制格式相比，JSON 和 XML 非常冗长，因此出现了大量二进制编码，用于 JSON和 XML 的补充。但是所有这些都没有规定**模式**，所以**需要在编码数据时包含所有的对象字段名称。**。而这些都可以通过引入带模式的编码格式来优化。

## 3. Thrift 与 Protocol Buffers
Apache Thrift(Facebook) 和 Protocol Buffers(Google) 是基于相同原理的两种二进制编码，都需要**模式**来编码任意的数据。

```json
{
    "userName": "Martin",
    "favoriteNumber": 1337,
    "interests": ["daydreaming", "hacking"]
}
```

使用Thrift 与 Protocol Buffers 编码上面的 JSON 数据，需要如下几个步骤:
1. 模式定义: 使用接口定义语言(IDL)来描述模式
2. 代码生成: 使用代码生成工具和定义的模式生成编程语言的特定类，编程语言可以直接使用生成的代码编码和解码改模式编码的数据

### 3.1 模式定义

```
# Thrift
struct Person {
    1: required string       userName,
    2: optional i64          favoriteNumber,
    3: optional list<string> interests
}

# protobuf
message Person {
    required string user_name       = 1;
    optional int64  favorite_number = 2;
    repeated string interests       = 3;
}
```

### 3.2 数据格式
#### Thrift
Thrift有两种不同的二进制编码格式iii，分别称为BinaryProtocol和CompactProtocol。先来看看 BinaryProtocol :

注: 16 进制中，一个字节 8 个bit 位，需要两个 16 进制字符表示。

![BinaryProtocol](/images/db/BinaryProtocol.png)

如上图:
1. 编码数据包含数字类型的字段标签(field tag)，而不是具体的字段名，这样更加节省空间并且紧凑
2. 每个字段都有一个类型注释、并且在需要时指定长度，然后是字段的具体值

CompactProtocol 与 BinaryProtocol 类似，但是使用可变长的类型来编码数据。

![CompactProtocol](/images/db/CompactProtocol.png)

CompactProtocol 中:
1. 将字段类型和标签号打包到单个字节中
2. int64 使用可变长度整数来实现
    - 每个字节的最高位用来指示是否还有更多的字节来
    - 这意味着-64到63之间的数字被编码为一个字节，-8192和8191之间的数字以两个字节编码

#### Protocol Buffers
Protocol Buffers 与 Thrift的CompactProtocol非常相似:

![Protocol Buffers](/images/db/protocol_buffer.png)

需要注意的一个细节：在前面所示的模式中，每个字段被标记为必需或可选，但是这对字段如何编码没有任何影响（二进制数据中没有任何字段指示是否需要字段）。所不同的是，如果未设置该字段，则所需的运行时检查将失败，这对于捕获错误非常有用。

### 3.3 字段标签和模式演化
Thrift 与 Protocol Buffers 使用**字段标签号(1,2,3)**对于模式演化非常重要:
1. 可以轻松更改模式中字段的名称，而编码永远不直接引用字段名称
3. 但不能随便更改字段的标签号，它会导致所有编码数据无效
2. 一条编码记录只是一组编码字段的拼接，如果没有设置字段值，将其从编码的记录中简单忽略即可

模式演化:
1. 添加新字段时:
    - 必须给字段一个新的字段标识，并且不能是必需字段
    - 向前兼容: 旧代码读取新数据时，可以简单忽略新加的字段，实现时通过数据类型的注释来通知解析器跳过特定的字节数即可
    - 向后兼容: 只要字段标识唯一，新代码总是可以读取旧数据，只要新字段不是必需的，否则运行时检查失败
2. 删除字段: 
    - 与添加字段相同，只不过向前向后兼容正好相反
    - 只能删除非必须字段，而且不能再次使用删除的字段标识
3. 数据类型变更:
    - 数据类型变更是可能的，但是会有丢失精度和被截断的风险

Protobuf的一个奇怪的细节是，它没有列表或数组数据类型，而是有一个字段的重复标记 repeated（这是第三个选项旁边必要和可选）。，重复字段的编码正如它所说的那样：同一个字段标记只是简单地出现在记录中。这具有很好的效果，可以将**可选（单值）字段更改为重复（多值）字段**:
1. 读取旧数据的新代码会看到一个包含零个或一个元素的列表（取决于该字段是否存在）
2. 读取新数据的旧代码只能看到列表的最后一个元素

Thrift有一个专用的列表数据类型，它使用列表元素的数据类型进行参数化。这不允许Protocol Buffers所做的从单值到多值的相同演变，但是它具有支持嵌套列表的优点。

## 4. Avro
Apache Avro 是另一种二进制编码格式，与Protocol Buffers和Thrift有趣的不同。 它是作为Hadoop的一个子项目在2009年开始的，因为Thrift不适合Hadoop的用例。

Avro也使用模式来指定正在编码的数据的结构。 它有两种模式语言：
1. 一种（Avro IDL）用于人工编辑
2. 一种（基于JSON），更易于机器读取

```
# IDL
record Person {
    string                userName;
    union { null, long }  favoriteNumber = null;
    array<string>         interests;
}

# JSON
{
    "type": "record",
    "name": "Person",
    "fields": [
        {"name": "userName", "type": "string"},
        {"name": "favoriteNumber", "type": ["null", "long"], "default": null},
        {"name": "interests", "type": {"type": "array", "items": "string"}
    ] 
}
```

**Avro 的模式没有标签编号**，编码后的二进制数据如下:

![Avro](/images/db/avro.png)

在 Avro 编码的数据中:
1. 没有字段标识号和数据类型
2. 编码只是长度加值，但是编码数据里没有告诉你值的类型
3. 整数使用可变长度编码
4. 为了解析数据，需要按照他们在模式中的顺序遍历这些字段，由模式确定字段类型

### 4.1 读/写模式
Avro 写模式指的是，应用程序使用模式的任何版本来编码数据，读模式指的是应用程序解码时，期望数据符合某个模式。Avro 的关键思想是**写模式和读模式不必是完全一模一样，它们只需保持兼容**:
1. 当读取时，Avro 库通过对比查看写模式和读模式并将数据从写模式转换为读模式来解决其差异
2. 即便读写模式字段顺序不同也可以，模式解析通过字段名匹配字段，原理入下图所示

![Avro](/images/db/avro_reader.png)


### 4.2 模式演化
使用 Avro，向前兼容意味着可以将新版本的模式作为 writer，旧版本的模式作为 reader；向后兼容意味着可以将新版本的模式作为 reader，旧版本的模式作为 writer。具体实现如下:
1. 新增/删除字段:
    - 读模式遇到出现在写模式但不在读模式的字段则忽略
    - 读模式需要但是写模式不包含，则使用在读模式中**声明的默认值填充**
2. 类型变化: 只要 Avro 可以转换类型，就可以改变字段的数据类型
3. 更改字段名: 
    - 更改字段名是可能的，reader 模式可以包含字段名称的别名，因此可以将旧 writer 模式字段名称与别名进行匹配。这意味更改字段名可以向后兼容(新代码知道旧模式的别名，但是旧代码不知道新增的别名)
    - 同理向联合类型添加分支也是向后兼容的

在 Avro 中如果要允许字段为 null，必须使用联合类型，例如 `union{null, long, string}`。只有 null 是联合的分支之一时，才可以使用它作为默认值。因此**Avro 不像Protocol Buffers和 Thrift 那样具有可选和必需的标签，而是有联合类型和默认值**。

### 4.3 如何记录写模式
目前为止忽略了一个重要问题: reader 如何知道特定的数据采用哪个版本的 writer。这取决于 Avro 的使用上下文:
1. 有很多记录的大文件
    - eg: hadoop 的上下文中
    - 在文件的开头包含 writer 的模式信息
2. 具有单独写入记录的数据库:
    - 不同记录可能使用不同的 writer 模式
    - 解决方案是在每条记录中包含一个版本号，并在数据库保留一个模式版本列表
3. 通过网络连接发送记录
    - 通过网络交互的进程可以在建立连接是协商模式版本

### 4.4 Avro 优势
Avro的一个优点是不包括任何标签号，这对于动态生成的模式更友好。因为 Avro 通过字段名自动关联记录和读取模式，相比于明确写死的字段标签号更加灵活。更加适用于动态类型的编程语言。如果一个 Avro 对象容器嵌入了 writer 模式，该文件就是自描述的，可以使用 Avro 库直接查看，就像查看 JSON 文件一样。

## 5. 模式的优点
Protocol Buffer、Thrift、Avro 都使用了模式来描述二进制编码格式，相比于 JSON和XML 的模式他们更加简单，并支持更详细的验证规则。它们有如下的优点:
1. 比各种二进制JSON变体更加紧凑，可以节省空间
2. 模式数据库允许在部署任何内容之前检查模式更改的向前和向后兼容

通过支持演化支持与读时模式的 JSON 数据库相同的灵活性，同时还提供了相关数据和工具方面更好的保障。


## 6. 数据流模式
所谓数据流模式指的是**进程间数据流动的方式**，常见的包括:
1. 通过数据库
2. 通过服务调用，包括 REST和RPC
3. 通过异步消息传递

### 6.1 基于数据库的数据流
基于数据库的数据流有以下特点:
1. 写入数据库相当于编码，读取数据时相当于解码
2. 因为服务的滚动升级，数据库通常也需要向前向后兼容
3. 在模式更改时，将数据库中的所有进行重写的代价是昂贵的。因此大多数据库都避免此操作。大多数关系型数据库允许简单的模式变更，例如添加具有默认值的新列，而不重写现有数据。读取就行时，数据库自动为磁盘上编码数据缺失的列添加默认值。
5. **模式演化支持整个数据库看起来像是单个编码模式，即便底层存储可能包含各个版本模式所编码的记录**
6. 应用程序可能随时变化，但是数据库内容包含的多年前的数据可能一直未变，除非明确的重写它，即所谓**数据比代码更长久**


有一个坑，较新的代码将该新字段的值写入数据库。随后，旧版本的代码（尚不知道新字段）将读取记录，更新记录并将其写回。在这种情况下，理想的行为通常是旧代码保持新的领域完整，即使它不能被解释。需要特别注意应用程序中的 ORM 模型对象，它很可能在读取和重新生成记录的过程中丢失未知字段。

基于数据库的数据流的模式演化取决于所使用的数据库。关系数据库通常假设数据库中的所有数据都符合一种模式，尽管模式可以改变，但是任意给定时间点都只有一个有效模式，数据库的模式必须是所有应用程序模式的交集。相比之下，**读时模式**数据库不强制执行模式，数据库包含了不同时间写入的新旧数据混合体，此时需要额外的方法记录数据的模式，数据库支持或者应用程序本身做兼容，这个依数据库自身使用的编码技术而异。

### 6.2 REST/RPC
需要通过网络技术进行通信的继承，有多种不同的通信方式，最常见的就是 REST和RPC。

#### REST
REST 是基于 HTTP 协议的，它不是一个协议，而是一个基于 HTTP 原则的设计理念，它强调简单的使用方式，并使用 HTTP 功能就行缓存控制、身份验证和内容类型协商。通常涉及较少的代码生成和自动化工具。定义格式入 OpenAPI 也称为 **Swagger**，可用于描述 RESTful API 并帮助生成文档。

#### RPC
RPC(Remote Procedure Call)模型试图是向远程网络服务发出请求看起来与在同一进程中调用编程语言中的函数和方法相同。这种方法在根本上是有缺陷的，网络请求与本地函数调用非常不同:
1. 本地函数调用是可预测的，要么成功要么失败要么永远不返回(死循环)。网络请求是不可预知的：由于网络问题，请求或响应可能会丢失，所以必须有所准备，例如通过重试失败的请求
2. 网络请求超时，根本不知道发生了什么，如果重试失败的网络请求，可能会发生请求实际上正在通过，只有响应丢失。在这种情况下，重试将导致该操作被执行多次，除非您在协议中引入除重（ 幂等（idempotence））机制。本地函数调用没有这个问题。
3. 网络请求很因为网络波动而导致延迟变化很大
4. 调用本地函数时，可以高效地将引用（指针）传递给本地内存中的对象。当你发出一个网络请求时，所有这些参数都需要被编码成可以通过网络发送的一系列字节。没关系，如果参数是像数字或字符串这样的基本类型，但是对于较大的对象很快就会变成问题。

尽管有这样那样的问题，RPC不会消失。在本章提到的所有编码的基础上构建了各种RPC框架：例如，Thrift和Avro带有RPC支持，gRPC是使用Protocol Buffers的RPC实现，Finagle也使用Thrift，Rest.li使用JSON over HTTP。gRPC支持流，其中一个调用不仅包括一个请求和一个响应，还包括一系列的请求和响应。

这种新一代的RPC框架更加明确的是，远程请求与本地函数调用不同。使用二进制编码格式的自定义RPC协议可以实现比通用的JSON over REST更好的性能。但是，RESTful API还有其他一些显著的优点：对于实验和调试（只需使用Web浏览器或命令行工具curl，无需任何代码生成或软件安装即可向其请求），它是受支持的所有的主流编程语言和平台，还有大量可用的工具（服务器，缓存，负载平衡器，代理，防火墙，监控，调试工具，测试工具等）的生态系统。由于这些原因，REST似乎是公共API的主要风格。 RPC框架的主要重点在于同一组织拥有的服务之间的请求，通常在同一数据中心内。

RPC 方案的向前向后兼容性取决于它所使用的具体编码技术。

### 6.3 基于消息传递的数据流
与直接RPC相比，使用消息代理有几个优点：
1. 如果收件人不可用或过载，可以充当缓冲区，从而提高系统的可靠性。
2. 它可以自动将消息重新发送到已经崩溃的进程，从而防止消息丢失。
3. 避免发件人需要知道收件人的IP地址和端口号（这在虚拟机经常出入的云部署中特别有用）。
4. 它允许将一条消息发送给多个收件人。
5. 将发件人与收件人逻辑分离（发件人只是发布邮件，不关心使用者）

然而，与RPC相比，差异在于消息传递通信通常是单向的：发送者通常不期望收到其消息的回复。一个进程可能发送一个响应，但这通常是在一个单独的通道上完成的。

#### 消息代理
最近像RabbitMQ，ActiveMQ，HornetQ，NATS和Apache Kafka这样的开源实现已经流行起来。详细的**传递语义**因实现和配置而异。消息代理通常不会强制任何特定的数据模型，消息只是包含一些元数据的字节序列，因此可以使用任何编码格式。