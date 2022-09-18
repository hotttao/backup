---
weight: 1
title: "grpc status"
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

## 1. gRPC status
[gRPC Spec](https://github.com/grpc/proposal/blob/master/L44-python-rich-status.md)定义了两个数据来指示RPC调用的状态 gRPC-status和 gRPC-message。然而，状态码和文本消息本身不足以表达更复杂的情况。该特性的一个主要用例是谷歌云API。谷歌Cloud API需要它将富状态从服务器传输到客户机。因此，gRPC团队引入了一个新的内部跟踪元数据条目gRPC-status-details-bin来实现这一目的。它接收序列化的proto google.rpc.status.Status 消息二进制，并作为二进制元数据传输。

### 1.1 Status 定义
下面是Status的定义，完整版本请参阅 status.proto。

```proto
message Status {
  int32 code = 1;
  string message = 2;
  repeated google.protobuf.Any details = 3;
}
```

对应的 Python 实现:

```python
class Status(six.with_metaclass(abc.ABCMeta)):
    """Describes the status of an RPC.

    This is an EXPERIMENTAL API.

    Attributes:
      code: A StatusCode object to be sent to the client.
      details: An ASCII-encodable string to be sent to the client upon
        termination of the RPC.
      trailing_metadata: The trailing :term:`metadata` in the RPC.
    """
```

为了 python grpc 框架中使用新的 Status 并与老的 set_code/set_detail 接口兼容。python grpc 的框架中添加了 abort_with_status 接口。

```python
def abort_with_status(self, status):
    """Raises an exception to terminate the RPC with a non-OK status.

    The status passed as argument will supercede any existing status code,
    status message and trailing metadata.

    This is an EXPERIMENTAL API.

    Args:
      status: A grpc.Status object. The status code in it must not be
        StatusCode.OK.

    Raises:
      Exception: An exception is always raised to signal the abortion the
        RPC to the gRPC runtime.
    """
```

在新的 Status 接口下，python gRPC 的请求和响应将变成下面这样:

```python
# Client side
from grpc_status import rpc_status

stub = ...Stub(channel)

try:
    resp = stub.AMethodHandler(...)
except grpc.RpcError as rpc_error:
    rich_status = rpc_status.from_rpc_error(rpc_error)
    # `rich_status` here is a ProtoBuf instance of `google.rpc.status.Status` proto message

# Server side
from grpc_status import rpc_status
from google.protobuf import any_pb2

def ...Servicer(...):
    def ARPCCall(request, context):
        ...
        detail = any_pb2.Any()
        detail.Pack(
            rpc_status.error_details_pb2.DebugInfo(
                stack_entries=traceback.format_stack(),
                detail="Can't recognize this argument",
            )
        )
        rich_status = grpc_status.status_pb2.Status(
            code=grpc_status.code_pb2.INVALID_ARGUMENT,
            message='API call quota depleted',
            details=[detail]
        )
        context.abort_with_status(rpc_status.to_status(rich_status))
        # The method handler will abort
```


