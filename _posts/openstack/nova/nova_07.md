---
title: 7. Nova RPC 服务(一)
date: 2021-03-08
categories:
    - 运维
tags:
	- Openstack
---


<!-- more -->

## 1. stevedore

### 1.1 nova.rpc.py
```python

```

rpc transport:
![7.1 RPC Transport](/images/openstack/message_transport.png)

```python
from stevedore import driver


def _get_transport(conf, url=None, allowed_remote_exmods=None,
                   transport_cls=RPCTransport):
    allowed_remote_exmods = allowed_remote_exmods or []
    conf.register_opts(_transport_opts)

    if not isinstance(url, TransportURL):
        url = TransportURL.parse(conf, url)

    kwargs = dict(default_exchange=conf.control_exchange,
                  allowed_remote_exmods=allowed_remote_exmods)

    try:
        mgr = driver.DriverManager('oslo.messaging.drivers',
                                   url.transport.split('+')[0],
                                   invoke_on_load=True,
                                   invoke_args=[conf, url],
                                   invoke_kwds=kwargs)
    except RuntimeError as ex:
        raise DriverLoadFailure(url.transport, ex)

    return transport_cls(mgr.driver)
```

rpc target:
![7.2 RPC Target](/images/openstack/message_target.png)

rpc services
![7.3 RPC Service](/images/openstack/oslo_messaging_rpc_server.png)

rpc client:
![7.4 RPC Client](/images/openstack/message_client.png)

notifier:
![7.5 Notify notifier](/images/openstack/notifier.png)

notifier middleware:
![7.6 Notify notifier nofigy_middleware](/images/openstack/nofigy_middleware.png)

notifier dispatcher:
![7.7 Notify notifier notify_dispatcher](/images/openstack/notify_dispatcher.png)

notifier listener:
![7.8 Notify notifier notify_listener](/images/openstack/notify_listener.png)

notifier driver:
![7.9 Notify notifier notify_driver](/images/openstack/notify_messaging.png)


## 1. Target

```python
class Target(object):

    """Identifies the destination of messages.

    A Target encapsulates all the information to identify where a message
    should be sent or what messages a server is listening for.

    Different subsets of the information encapsulated in a Target object is
    relevant to various aspects of the API:

      an RPC Server's target:
        topic and server is required; exchange is optional
      an RPC endpoint's target:
        namespace and version is optional
      an RPC client sending a message:
        topic is required, all other attributes optional
      a Notification Server's target:
        topic is required, exchange is optional; all other attributes ignored
      a Notifier's target:
        topic is required, exchange is optional; all other attributes ignored

    Its attributes are:

    :param exchange: A scope for topics. Leave unspecified to default to the
      control_exchange configuration option.
    :type exchange: str
    :param topic: A name which identifies the set of interfaces exposed by a
      server. Multiple servers may listen on a topic and messages will be
      dispatched to one of the servers selected in a best-effort round-robin
      fashion (unless fanout is ``True``).
    :type topic: str
    :param namespace: Identifies a particular RPC interface (i.e. set of
      methods) exposed by a server. The default interface has no namespace
      identifier and is referred to as the null namespace.
    :type namespace: str
    :param version: RPC interfaces have a major.minor version number associated
      with them. A minor number increment indicates a backwards compatible
      change and an incompatible change is indicated by a major number bump.
      Servers may implement multiple major versions and clients may require
      indicate that their message requires a particular minimum minor version.
    :type version: str
    :param server: RPC Clients can request that a message be directed to a
      specific server, rather than just one of a pool of servers listening on
      the topic.
    :type server: str
    :param fanout: Clients may request that a copy of the message be delivered
      to all servers listening on a topic by setting fanout to ``True``, rather
      than just one of them.
    :type fanout: bool
    :param legacy_namespaces: A server always accepts messages specified via
      the 'namespace' parameter, and may also accept messages defined via
      this parameter. This option should be used to switch namespaces safely
      during rolling upgrades.
    :type legacy_namespaces: list of strings
    """

    def __init__(self, exchange=None, topic=None, namespace=None,
                 version=None, server=None, fanout=None,
                 legacy_namespaces=None):
        self.exchange = exchange
        self.topic = topic
        self.namespace = namespace
        self.version = version
        self.server = server
        self.fanout = fanout
        self.accepted_namespaces = [namespace] + (legacy_namespaces or [])

    def __call__(self, **kwargs):
        for a in ('exchange', 'topic', 'namespace',
                  'version', 'server', 'fanout'):
            kwargs.setdefault(a, getattr(self, a))
        return Target(**kwargs)

    def __eq__(self, other):
        return vars(self) == vars(other)

    def __ne__(self, other):
        return not self == other

    def __repr__(self):
        attrs = []
        for a in ['exchange', 'topic', 'namespace',
                  'version', 'server', 'fanout']:
            v = getattr(self, a)
            if v:
                attrs.append((a, v))
        values = ', '.join(['%s=%s' % i for i in attrs])
        return '<Target ' + values + '>'

    def __hash__(self):
        return id(self)
```