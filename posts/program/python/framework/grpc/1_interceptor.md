---
weight: 1
title: "拦截器"
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

gRPC 作为一个完整的框架，实现了很多钩子来完成一些通用功能的开发。今天我们就来看看 gRPC 的高阶用法。这是 Python 篇，所有的内容整理自 
1. [python gRPC 的官方示例](https://github.com/grpc/grpc/tree/v1.46.3/examples/python)
2. [python gRPC 的官方博客](https://github.com/grpc/proposal)
3. [grpc-interceptor 文档](https://grpc-interceptor.readthedocs.io/en/latest/#id5)
4. [python gRPC 的官方文档](https://grpc.github.io/grpc/python/grpc.html)

## 1. 拦截器
[拦截器](https://github.com/grpc/proposal/blob/master/L13-python-interceptors.md)

拦截器是一种中间件，能够方便的在 gRPC 的请求处理前后，插入一些钩子，来完成一些非业务的功能代码。为了实现钩子，我们需要获取到当前 gRPC 请求的相关信息。我们先来看看 python gRPC 暴露给我们的获取 gRPC 请求元数据信息的接口。

### 1.1 Python gRPC 拦截器接口规范
#### Client Call Details
```python
class ClientCallDetails(six.with_metaclass(abc.ABCMeta)):
    """Describes an RPC to be invoked.

    Attributes:
      method: The method name of the RPC.
      timeout: An optional duration of time in seconds to allow for the RPC.
      metadata: Optional metadata to be transmitted to the service-side of the RPC.
      credentials: An optional CallCredentials for the RPC.
      wait_for_ready: This is an EXPERIMENTAL argument. An optional flag to enable wait for ready mechanism.
    """
```
ClientCallDetails 通过该接口可以检查和修改与特定调用相关的选项，它包含五个属性:
1. method: RPC 请求的方法名
2. timeout: gRPC 可以执行的时长
3. metadata: 传递给服务器端的元数据信息
4. credentials: An optional CallCredentials for the RPC.
5. wait_for_ready: This is an EXPERIMENTAL argument. An optional flag to enable wait for ready mechanism.

#### Server Handler Call Details
服务器端也有一个获取请求处理元数据信息的接口对象 HandlerCallDetails

```python
class HandlerCallDetails(six.with_metaclass(abc.ABCMeta)):
    """Describes an RPC that has just arrived for service.

    Attributes:
      method: The method name of the RPC.
      invocation_metadata: The metadata sent by the client.
    """
```
HandlerCallDetails，只有两个属性:
1. method: RPC 请求的方法名，只读的
2. invocation_metadata: client 传递过来的元数据信息

#### Continuation
延续函数是通过执行链中的下一个拦截器或调用底层通道上的实际RPC来继续调用的函数。调用延续是拦截器的责任，除非它决定终止RPC的处理。拦截器可以使用`response_future = continuation(client_call_details, request)`来继续处理RPC。延续返回一个对象，该对象既是RPC的调用，也是Future。在RPC完成的情况下，response_future.result 将是RPC的响应消息。如果事件以非ok状态终止，response_future.exception 将触发一个RpcError 异常。

### 1.2 客户端拦截器
有四种类型的客户端拦截器，对应四种 gRPC 方法。每一种拦截器对应一个拦截器抽象接口，对应如下:

```go
class UnaryUnaryClientInterceptor(six.with_metaclass(abc.ABCMeta)):
    @abc.abstractmethod
    def intercept_unary_unary(self, continuation, client_call_details,
                              request): pass

class UnaryStreamClientInterceptor(six.with_metaclass(abc.ABCMeta)):
    @abc.abstractmethod
    def intercept_unary_stream(self, continuation, client_call_details,
                               request): pass

class StreamUnaryClientInterceptor(six.with_metaclass(abc.ABCMeta)):
    @abc.abstractmethod
    def intercept_stream_unary(self, continuation, client_call_details,
                               request_iterator): pass

class StreamStreamClientInterceptor(six.with_metaclass(abc.ABCMeta)):
    @abc.abstractmethod
    def intercept_stream_stream(self, continuation, client_call_details,
                                request_iterator): pass
```

为了应用这些拦截器，python gRPC 框架提供了一个 intercept_channel 函数:

```python
def intercept_channel(channel, *interceptors):
    """Intercepts a channel through a set of interceptors.

    Args:
      channel: A Channel.
      interceptors: Zero or more objects of type
        UnaryUnaryClientInterceptor,
        UnaryStreamClientInterceptor,
        StreamUnaryClientInterceptor, or
        StreamStreamClientInterceptor.
        Interceptors are given control in the order they are listed.

    Returns:
      A Channel that intercepts each invocation via the provided interceptors.
```

传递的多个拦截器将按照如下的执行生效:

```
Application Invokes an RPC ->
    Interceptor A Start ->
        Interceptor B Start ->
            Interceptor C Start ->
                Invoke Original '*MultiCallable' ->
                Return the Response from the Server ->
            Interceptor C Returns ->
        Interceptor B Returns ->
    Interceptor A Returns ->
Application Gets the Response
```

这个应该还是比较好理解的，continuation 调用之前表示进入到当前装饰器，调用时表示调用下一层的装饰器，返回后表示底层的装饰器已经执行完成，回到当前装饰器。


### 1.3 服务器端拦截器
服务器端拦截器只有一种类型:

```python
class ServerInterceptor(six.with_metaclass(abc.ABCMeta)):
    @abc.abstractmethod
    def intercept_service(self, continuation, handler_call_details): pass
```
与客户端不同的是，服务器端拦截器包装的是 gRPC 的请求处理方法。拦截器的执行是下面这样的:

```
Server Receives a Request ->
    # 方法包装
    Interceptor A Start ->
        Interceptor B Start ->
            Interceptor C Start ->
                The Original Handler
            Interceptor C Returns Updated Handler C ->
        Interceptor B Returns Updated Handler B ->
    Interceptor A Returns Updated Handler A ->

    Invoke the Updated Handler A with the Request ->
    Updated Handler A Returns Response ->
Server Replies
```

与客户端相比，最显著的区别是拦截发生在应用程序行为的实际调用之前。因此拦截器函数将无法访问请求上下文或服务上下文。continuation 接受 handler_call_details 返回下一层拦截器返回的 grpc.RpcMethodHandler。

为了应用服务器端拦截器，python gRPC 在 server 端的初始化参数中提供了一个 interceptors 参数:

```python
class ExampleInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        ...

server_interceptor_1 = ExampleInterceptor(...)
server = grpc.server(..., interceptors=[server_interceptor_1])
```

在Python的拦截器实现中，只允许开发人员与调用元数据交互，或将RPC路由到新定义的方法处理程序。它无法控制实际用户定义的请求处理程序的调用，因此响应消息和引发的异常不会传播到拦截器函数。

## 2. python 拦截器的简化实现
Python grpc包提供了服务拦截器，但由于其灵活性，使用起来有点困难，并且拦截器中不能直接访问请求和响应对象或服务上下文。grpc_interceptor 提供了拦截器的更简化实现。grpc_interceptor 提供了如下接口:
1. ServerInterceptor
2. AsyncServerInterceptor
3. ExceptionToStatusInterceptor: 拦截 gRPC 中的异常，并设置相应的 gRPC 状态码
4. AsyncExceptionToStatusInterceptor
5. ClientInterceptor: 目前还没有与ClientInterceptor类似的 async 版本
An optional testing framework. If you’re writing your own interceptors, this is useful. If you’re just using ExceptionToStatusInterceptor then you don’t need this.

### 2.1 ServerInterceptor
#### a unary-unary RPC
下面是一个一元普通 gRPC 方法的拦截器示例。

```python
from grpc_interceptor import ServerInterceptor
from grpc_interceptor.exceptions import GrpcException

class ExceptionToStatusInterceptor(ServerInterceptor):

    def intercept(
        self,
        method: Callable,
        request: Any,
        context: grpc.ServicerContext,
        method_name: str,
    ) -> Any:
        """Override this method to implement a custom interceptor.

         You should call method(request, context) to invoke the
         next handler (either the RPC method implementation, or the
         next interceptor in the list).

         Args:
             method: The next interceptor, or method implementation.
             request: The RPC request, as a protobuf message.
             context: The ServicerContext pass by gRPC to the service.
             method_name: A string of the form
                 "/protobuf.package.Service/Method"

         Returns:
             This should generally return the result of
             method(request, context), which is typically the RPC
             method response, as a protobuf message. The interceptor
             is free to modify this in some way, however.
         """
        try:
            return method(request, context)
        except GrpcException as e:
            context.set_code(e.status_code)
            context.set_details(e.details)
            raise
```

#### Server Streaming Interceptors
上面的例子展示了如何为一元RPC编写拦截器。服务器流rpc需要以略微不同的方式处理，因为方法(请求、上下文)将返回一个生成器。因此，代码只有在遍历它之后才能真正运行。因此，如果我们继续从rpc捕获异常的例子，我们将需要这样做:

```python
class ExceptionToStatusInterceptor(ServerInterceptor):

    def intercept(
        self,
        method: Callable,
        request: Any,
        context: grpc.ServicerContext,
        method_name: str,
    ) -> Any:
        try:
            for response in method(request, context):
                yield response
        except GrpcException as e:
            context.set_code(e.status_code)
            context.set_details(e.details)
            raise
```

但是，这只适用于服务器流rpc。为了同时使用一元和流rpc，你需要分别处理一元情况和流情况，如下所示:

```python
class ExceptionToStatusInterceptor(ServerInterceptor):

    def intercept(self, method, request, context, method_name):
        # Call the RPC. It could be either unary or streaming
        try:
            response_or_iterator = method(request, context)
        except GrpcException as e:
            # If it was unary, then any exception raised would be caught
            # immediately, so handle it here.
            context.set_code(e.status_code)
            context.set_details(e.details)
            raise
        # Check if it's streaming
        if hasattr(response_or_iterator, "__iter__"):
            # Now we know it's a server streaming RPC, so the actual RPC method
            # hasn't run yet. Delegate to a helper to iterate over it so it runs.
            # The helper needs to re-yield the responses, and we need to return
            # the generator that produces.
            return self._intercept_streaming(response_or_iterator)
        else:
            # For unary cases, we are done, so just return the response.
            return response_or_iterator

    def _intercept_streaming(self, iterator):
        try:
            for resp in iterator:
                yield resp
        except GrpcException as e:
            context.set_code(e.status_code)
            context.set_details(e.details)
            raise
```

### 2.1 AsyncServerInterceptor
之所以存在一个 Async 版本的 ServerInterceptor 是因为，Python 的异步编程跟同步变成使用的语法是不兼容的。

```python
from grpc_interceptor.exceptions import GrpcException
from grpc_interceptor.server import AsyncServerInterceptor

class AsyncExceptionToStatusInterceptor(AsyncServerInterceptor):

    async def intercept(
        self,
        method: Callable,
        request_or_iterator: Any,
        context: grpc.ServicerContext,
        method_name: str,
    ) -> Any:
        try:
            response_or_iterator = method(request_or_iterator, context)
            if not hasattr(response_or_iterator, "__aiter__"):
                # Unary, just await and return the response
                return await response_or_iterator
        except GrpcException as e:
            await context.set_code(e.status_code)
            await context.set_details(e.details)
            raise

        # Server streaming responses, delegate to an async generator helper.
        # Note that we do NOT await this.
        return self._intercept_streaming(response_or_iterator, context)

    async def _intercept_streaming(self, iterator):
        try:
            async for r in iterator:
                yield r
        except GrpcException as e:
            await context.set_code(e.status_code)
            await context.set_details(e.details)
            raise
```

### 2.3 ClientInterceptor
```python
from grpc_interceptor import ClientCallDetails, ClientInterceptor

class MetadataClientInterceptor(ClientInterceptor):

    def intercept(
        self,
        method: Callable,
        request_or_iterator: Any,
        call_details: grpc.ClientCallDetails,
    ):
        """Override this method to implement a custom interceptor.

        This method is called for all unary and streaming RPCs. The interceptor
        implementation should call `method` using a `grpc.ClientCallDetails` and the
        `request_or_iterator` object as parameters. The `request_or_iterator`
        parameter may be type checked to determine if this is a singluar request
        for unary RPCs or an iterator for client-streaming or client-server streaming
        RPCs.

        Args:
            method: A function that proceeds with the invocation by executing the next
                interceptor in the chain or invoking the actual RPC on the underlying
                channel.
            request_or_iterator: RPC request message or iterator of request messages
                for streaming requests.
            call_details: Describes an RPC to be invoked.

        Returns:
            The type of the return should match the type of the return value received
            by calling `method`. This is an object that is both a
            `Call <https://grpc.github.io/grpc/python/grpc.html#grpc.Call>`_ for the
            RPC and a `Future <https://grpc.github.io/grpc/python/grpc.html#grpc.Future>`_.

            The actual result from the RPC can be got by calling `.result()` on the
            value returned from `method`.
        """
        new_details = ClientCallDetails(
            call_details.method,
            call_details.timeout,
            [("authorization", "Bearer mysecrettoken")],
            call_details.credentials,
            call_details.wait_for_ready,
            call_details.compression,
        )

        return method(request_or_iterator, new_details)
```

