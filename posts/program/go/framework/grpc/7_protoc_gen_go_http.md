---
weight: 1
title: "go grpc 插件 protoc-gen-go-http"
date: 2021-06-24T22:00:00+08:00
lastmod: 2021-06-24T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "go grpc 插件 protoc-gen-go-http"
featuredImage: 

tags: ["go 框架"]
categories: ["Go"]

lightgallery: true

toc:
  auto: false
---

## 1.protoc-gen-go-http
protoc-gen-go-http 是一个用于在 gRPC 方法和一个或多个HTTP REST端点之间进行映射的插件。它允许开发人员构建一个支持 gRPC API 和 REST API 的单一 API 服务。包括
1. [谷歌api](https://github.com/googleapis/googleapis)
2. [Cloud endpoint](https://cloud.google.com/endpoints)
3. [gRPC Gateway](https://github.com/grpc-ecosystem/grpc-gateway)
4. [Envoy 代理](https://github.com/envoyproxy/envoy)
在内的许多系统都支持该特性，并将其用于大规模生产业务。

HttpRule 定义了gRPC/REST映射的模式。映射指定如何将gRPC请求消息的不同部分映射到URL路径、URL查询参数和HTTP请求正文。它还控制如何将gRPC响应消息映射到HTTP响应体。在gRPC方法上的http注释。每个映射指定一个URL路径模板和一个HTTP方法。路径模板可以引用 gRPC 请求消息中的一个或多个字段，只要每个字段都是原始(非 message)类型的非重复字段。路径模板控制如何将请求消息的字段映射到URL路径。

比如下面的 proto 定义:
```proto
service Messaging {
 rpc GetMessage(GetMessageRequest) returns (Message) {
   option (google.api.http) = {
       get: "/v1/{name=messages/*}"
   };
 }
}
message GetMessageRequest {
 string name = 1; // Mapped to URL path.
}
message Message {
 string text = 1; // The resource content.
}
```

对应的 HTTP REST到gRPC的映射如下:

```
  HTTP | gRPC
  -----|-----
  `GET /v1/messages/123456`  | `GetMessage(name: "messages/123456")`
```

如果没有HTTP body，请求消息中未绑定路径模板的字段将自动成为HTTP查询参数。比如:

```proto
      service Messaging {
        rpc GetMessage(GetMessageRequest) returns (Message) {
          option (google.api.http) = {
              get:"/v1/messages/{message_id}"
          };
        }
      }
      message GetMessageRequest {
        message SubMessage {
          string subfield = 1;
        }
        string message_id = 1; // Mapped to URL path.
        int64 revision = 2;    // Mapped to URL query parameter `revision`.
        SubMessage sub = 3;    // Mapped to URL query parameter `sub.subfield`.
      }
```

这使得HTTP JSON到RPC的映射如下:

```
  HTTP | gRPC
  -----|-----
  `GET /v1/messages/123456?revision=2&sub.subfield=foo` |
  `GetMessage(message_id: "123456" revision: 2 sub: SubMessage(subfield:
  "foo"))`
```

请注意，映射到URL查询参数的字段必须具有原始类型或重复原始类型或非重复消息类型。对于重复类型，参数可以在URL中重复为'…?param=A&param=B'。对于消息类型，消息的每个字段都映射到一个单独的参数，例如'…?foo.a=A&foo.b=B&foo.c=C'。

对于包含 body 的 HTTP方法，body 字段指定了 http body 的映射范围，

```proto
     service Messaging {
       rpc UpdateMessage(UpdateMessageRequest) returns (Message) {
         option (google.api.http) = {
           patch: "/v1/messages/{message_id}"
           body: "message"
         };
       }
     }
     message UpdateMessageRequest {
       string message_id = 1; // mapped to the URL
       Message message = 2;   // mapped to the body
     }
```

比如上面的 body 字段表明，"/v1/messages/{message_id}" 请求的 body 体，对应的内容为 Message message type。

```
 HTTP | gRPC
 -----|-----
 `PATCH /v1/messages/123456 { "text": "Hi!" }` | `UpdateMessage(message_id:
 "123456" message { text: "Hi!" })`
```

特殊名称' * '可以在body映射中使用，以定义每个没有被路径模板绑定的字段都应该映射到请求body。这样就可以实现以下更新方法的替代定义:

```proto
     service Messaging {
       rpc UpdateMessage(Message) returns (Message) {
         option (google.api.http) = {
           patch: "/v1/messages/{message_id}"
           body: "*"
         };
       }
     }
     message Message {
       string message_id = 1;
       string text = 2;
     }
```

grpc 到 http 的映射关系如下:

```
 HTTP | gRPC
 -----|-----
 `PATCH /v1/messages/123456 { "text": "Hi!" }` | `UpdateMessage(message_id:
 "123456" text: "Hi!")`
```

注意，当在主体映射中使用' * '时，不可能有HTTP参数，因为所有不受路径绑定的字段都以主体结束。这使得在定义REST api时很少使用这个选项。' * '的常见用法是在自定义方法中，这些方法根本不使用URL来传输数据。

可以使用' additional_bindings '选项为一个RPC定义多个HTTP方法。例子:

```proto
     service Messaging {
       rpc GetMessage(GetMessageRequest) returns (Message) {
         option (google.api.http) = {
           get: "/v1/messages/{message_id}"
           additional_bindings {
             get: "/v1/users/{user_id}/messages/{message_id}"
           }
         };
       }
     }
     message GetMessageRequest {
       string message_id = 1;
       string user_id = 2;
     }
```
上面的定义，对应的映射关系如下:

```
 HTTP | gRPC
 -----|-----
 `GET /v1/messages/123456` | `GetMessage(message_id: "123456")`
 `GET /v1/users/me/messages/123456` | `GetMessage(user_id: "me" message_id:
 "123456")`
```

### Rules for HTTP mapping
1. google.api.http 定义 http 请求中，作为入参的 message 在 http 请求中通过三个路径进行传递:
  - 路径模板引用的字段。它们通过URL路径传递。
  - 由`[HttpRule.body][google.api.HttpRule.body]`引用的字段。它们通过HTTP body 传递。
  - 所有其他字段通过URL查询参数传递，参数名称是请求消息中的字段路径。重复字段可以表示为同名下的多个查询参数。
2. 如果`[HttpRule.body] [google.api.HttpRule。body]`为 *，没有URL查询参数，所有字段通过URL路径和HTTP body 传递。
3. 如果`[HttpRule.body][google.api.HttpRule.body]` 省略，没有HTTP请求正文，所有字段通过URL路径和URL查询参数传递。

### Path template syntax
```

     Template = "/" Segments [ Verb ] ;
     Segments = Segment { "/" Segment } ;
     Segment  = "*" | "**" | LITERAL | Variable ;
     Variable = "{" FieldPath [ "=" Segments ] "}" ;
     FieldPath = IDENT { "." IDENT } ;
     Verb     = ":" LITERAL ;
```
1. 语法' * '匹配单个URL路径段。语法' ** '匹配零个或多个URL路径段，这些URL路径段必须位于URL路径的最后一部分，除了' Verb '。
2. Variable 语法匹配模板中指定的部分URL路径。变量模板不能包含其他变量。如果一个变量匹配单个路径段，它的模板可能会被省略，例如:“{var}”等价于“{var=*}”。
3. LITERAL 语法匹配URL路径中的字面文本。如果“LITERAL”包含任何保留字符，则应该在匹配之前对这些字符进行百分比编码。
4. 如果一个变量只包含一个路径段，例如 "{var}" 或 "{var=\*}" ，当这样的变量在客户端展开为一个URL路径时，除`[-_.~0-9a-zA-Z]`外都会被百分比编码。这样的变量在[发现文档](https://developers.google.com/discovery/v1/reference/apis)中显示为'{var}'。
5. 如果一个变量包含多个路径段，例如' "{var=foo/*}" '或' "{var=**}" '，当该变量在客户端展开为URL路径时，除`[-_.~/0-9a-zA-Z]`都会被百分比编码。服务器端执行反向解码，除了“%2F”和“%2F”保持不变。 这些情况参见[Discovery Document](https://developers.google.com/discovery/v1/reference/apis).

### Using gRPC API Service Configuration
gRPC API Service Configuration (Service config)是一种配置语言，用于将gRPC服务配置为面向用户的产品。服务配置只是google.api的YAML表示。服务的原型消息。作为注释您的概要文件的另一种方法，您可以在您的服务配置YAML文件中配置gRPC转码。为此，您可以指定一个“HttpRule”，它将gRPC方法映射到REST端点，实现与proto注释相同的效果。如果您有一个可以在多个服务中重用的原型，这可能特别有用。请注意，在服务配置中指定的任何转码都将覆盖原型中任何匹配的转码配置。

### spcial note
当使用gRPC转码将gRPC映射到JSON REST端点时，proto到JSON的转换必须遵循[proto3规范](https://developers.google.com/protocol-buffers/docs/proto3#json)。虽然单段变量遵循[RFC 6570](https://tools.ietf.org/html/rfc6570)章节3.2.2简单字符串扩展的语义，但多段变量**不**遵循RFC 6570章节3.2.3保留扩展。原因是保留扩展不扩展特殊字符，如' ?'和' # '，这将导致无效的url。因此，gRPC转码对多段变量使用了自定义编码。路径变量**不能**引用任何重复的或映射的字段，因为客户端库无法处理这样的变量扩展。路径变量**不能**捕获开头的“/”字符。原因是最常见的用例“{var}”不捕获开头的“/”字符。为了一致性，所有路径变量必须共享相同的行为。重复的消息字段不能映射到URL查询参数，因为没有客户端库可以支持这样复杂的映射。如果API需要对请求或响应体使用JSON数组，它可以将请求或响应体映射到重复字段。但是，一些gRPC转码实现可能不支持此特性。