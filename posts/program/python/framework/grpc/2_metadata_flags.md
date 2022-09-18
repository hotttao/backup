---
weight: 1
title: "wait-for-ready"
date: 2021-06-24T22:00:00+08:00
lastmod: 2021-06-24T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "grpc 用法进阶，包括元数据获取、拦截器、认证"
featuredImage: 

tags: ["python grpc"]
categories: ["Python"]

lightgallery: true

toc:
  auto: false
---

## 1. wait-for-ready
[wait-for-ready](https://github.com/grpc/proposal/blob/master/L42-python-metadata-flags.md)

如果RPC发出，但通道处于TRANSIENT_FAILURE或SHUTDOWN状态，则RPC无法及时传输。默认情况下，gRPC实现应该立即使此类rpc失效。这就是所谓的“快速失败”。但是某些情况下我们希望能让 RPC 请求等一等，以便在服务器端就绪的时候再进行请求。即 rpc 不应该因为通道处于其他状态(连接、READY或IDLE)而失败。

gRPC实现可以提供一个每个rpc选项，以避免rpc由于通道处于TRANSIENT_FAILURE状态而失败。相反，该实现将rpc放入队列，直到通道就绪。这就是所谓的“等待准备”。如果有不相关的原因，例如通道是SHUTDOWN或RPC的截止日期到了，那么在READY之前RPC仍然会失败。

当开发人员同时启动gRPC客户端和服务器时，很可能会因为服务器不可用而导致前两个RPC调用失败。如果开发人员没有为这种情况做好准备，结果可能是灾难性的。但是使用'wait-for-ready'语义，开发人员可以以任何顺序初始化客户端和服务器，这在测试中特别有用。此外，开发人员可以在启动客户端之前确保服务器已启动。但是在某些情况下，比如短暂的网络故障可能会导致服务器暂时不可用。使用'wait-for-ready'语义，那些RPC调用将自动等待，直到服务器准备好接受传入的请求。

## 2. 指定压缩算法
[指定压缩算法](https://github.com/grpc/proposal/blob/master/L46-python-compression-api.md)

gRPC的Java、Go和c++实现提供了允许客户端和服务器为请求和响应指定压缩算法的API，而Python没有提供类似的API。所以 python gRPC 添加了下面接口:

```python
class Compression(enum.IntEnum):
    NoCompression = _cygrpc.GRPC_COMPRESS_NONE
    Deflate = _cygrpc.GRPC_COMPRESS_DEFLATE
    Gzip = _cygrpc.GRPC_COMPRESS_GZIP
```

另外在，gRPC server 所有方法请求都添加了 compression 关键字参数，用于指定压缩算法:

```python
class UnaryUnaryMultiCallable(six.with_metaclass(abc.ABCMeta)):

    @abc.abstractmethod
    def __call__(self,
                 request,
                 timeout=None,
                 metadata=None,
                 credentials=None,
                 wait_for_ready=None,
                 compression=None):
        ...

    @abc.abstractmethod
    def with_call(self,
                  request,
                  timeout=None,
                  metadata=None,
                  credentials=None,
                  wait_for_ready=None,
                  compression=None):
        ...
```

同事 ClientCallDetails 也添加了 compression 关键字参数:

```python
class ClientCallDetails(six.with_metaclass(abc.ABCMeta)):
    """Describes an RPC to be invoked.
    This is an EXPERIMENTAL API.
    Attributes:
      method: The method name of the RPC.
      timeout: An optional duration of time in seconds to allow for the RPC.
      metadata: Optional :term:`metadata` to be transmitted to
        the service-side of the RPC.
      credentials: An optional CallCredentials for the RPC.
      wait_for_ready: This is an EXPERIMENTAL argument. An optional flag t
        enable wait for ready mechanism.
      compression: An optional value specifying the type of compression to be
        used.
    """

```

此外，compression关键字参数将被用于insecure_channel、secure_channel和服务器函数。这将定义在通道或服务器的整个生命周期中使用的压缩方法。最后，set_response_compression方法将被添加到ServicerContext接口。这将允许服务器为单个响应设置压缩方法。

下面是设置压缩算法的示例:

```python
# client
with grpc.insecure_channel('localhost:50051',
                            compression=grpc.compression.Gzip) as channel:
    stub = helloworld_pb2_grpc.GreeterStub(channel)
    response = stub.SayHello(helloworld_pb2.HelloRequest(name='you'))

with grpc.insecure_channel('localhost:50051') as channel:
    stub = helloworld_pb2_grpc.GreeterStub(channel)
    response = stub.SayHello(
                helloworld_pb2.HelloRequest(name='you'),
                compression=grpc.compression.Gzip)

# server
server = grpc.server(
            futures.ThreadPoolExecutor(max_workers=10),
            compression=grpc.DEFLATE)
helloworld_pb2_grpc.add_GreeterServicer_to_server(Greeter(), server)
server.add_insecure_port('[::]:50051')
server.start()

class Greeter(helloworld_pb2_grpc.GreeterServicer):

    def SayHello(self, request, context):
        context.set_response_compression(grpc.compression.NoCompression)
        return helloworld_pb2.HelloReply(message='Hello, %s!' % request.name)
```

## 3. Runtime Proto Parsing
[Runtime Proto Parsing](https://github.com/grpc/proposal/blob/master/L64-python-runtime-proto-parsing.md)

## 4. python gRPC package
[python-package-name.md](https://github.com/grpc/proposal/blob/master/L65-python-package-name.md)
grpc
grpc-status
grpc-channelz
grpc-tools
grpc-reflection
grpc-testing
grpc-health-checking

## 5. rich server context
[rich server context](https://github.com/grpc/proposal/blob/master/L78-python-rich-server-context.md)

## 6. python-bazel-rules
[python-bazel-rules](https://github.com/grpc/proposal/blob/master/L86-aspect-based-python-bazel-rules.md)
