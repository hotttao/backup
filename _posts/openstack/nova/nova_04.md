---
title: 4. API 接口服务(一)
date: 2021-03-05
categories:
    - 运维
tags:
	- Openstack
---

搞 Openstack 开发的大多数应该都或多或少都熟悉 Python 的 Web 开发。我准备花三节来讲讲 Nova 里面 API 接口服务，分别是:
1. Nova API 服务的 Web 框架
2. Nova 的 API 服务的并发管理
3. Nova 里的一个请求的处理流程

今天我们就先来讲讲 Nova 里的 Web 框架。
<!-- more -->

## 1. WSGI
熟悉 Web 开发的同学，应该都知道后端 Web 应用分成两个部分:
1. Web 服务器: Nginx 和 Apache，负责 HTTP 协议的解析
2. Web 开发框架: 以 Python 为例就是 flask、Django，提供动态的网页内容

Web 服务如何把解析的 HTTP 请求数据给 Web 框架，以及如何从 Web 框架接受响应内容呢？这就是 WSGI 协议规范所约定的事情。Web服务器网关接口（Python Web Server Gateway Interface，缩写为WSGI）是为Python语言定义的Web服务器和Web应用程序或框架之间的一种简单而通用的接口。

### 1.1. WSGI 接口
WSGI 约定的是一个如下的接口:

```python
class App:
    def __call__(self, environ: dict, start_response: t.Callable) -> t.Any:
        return body


def start_response(status: str, headers: List[Tuple[str, str]], exc_info: Optional[_OptExcInfo]) : 
    pass
```

Web 框架是一个可调用对象，其接受两个参数:
1. environ: 字典对象，包含了 http 请求被解析后的所有数据
2. start_response: 也是一个可调用对象，用于为 http 响应添加状态码和请求头信息

Web 框架被调用后，返回值作为 body，连同 start_response 写入的响应状态码和响应头信息返回给 Web 服务器用作 HTTP 请求的响应。

Flask 和 Openstack 里面的 Web 服务本质上都是类似的:
1. Web 服务需要能同时处理多个不同的请求，因此需要解决并发和路由问题
2. 除了基本功能，一个完整的 web 服务还要解决权限控制、流控等管理需求，基本上所有的 Web 都采用了面向切面的编程思想，提供了某种机制，以中间件的方式提供这些功能

所有这些 Web 框架中都有如下类似的概念:
1. Application/App: 一个 Web 应用
2. Router: 路由 
3. Request/Responce: 请求和响应对象
3. Resource/Controller: 请求处理函数
4. Middleware: 中间件
5. Service: 服务端的并发管理

这些概念将是我们接下来阅读源码的切入点。

### 1.2 Nova API 中的抽象
在 Nova 中上面所说对象的抽象都定义在 `nova.api.wsgi` 中(如下图4.1 和 图4.2 所示)

![4.1 Nova API 中的抽象](/images/openstack/wsgi.png)

![4.2 Nova API 中的抽象接口](/images/openstack/wsgi_detail.png)

其中:
1. Request: 请求对象，Nova API 的 Request 依赖 webob 第三方库，这个库也是我们接下来要了解的重点内容。因为 Request 不影响我们对整体框架的理解，我们在后面的请求处理再来详细讲解
5. Loader: Application 加载器，这个类跟与我们接下来要介绍的 paste.deploy 有关，它定义了如何加载我们的 Application 对象

其他几个核心对象的定义如下:

#### Application
Application 代表一个 Web 应用，其核心是定义 WSGI 接口的抽象方法 `__call__(self, environ, start_response):`

```python

class Application(object):
    """Base WSGI application wrapper. Subclasses need to implement __call__."""

    @classmethod
    def factory(cls, global_config, **local_config):
        """
        paste.deploy 约定调用的方法，用来实例化一个 Application 对象
        """
        return cls(**local_config)

    def __call__(self, environ, start_response):
        """
        WSGI 的接口实现
        """
        raise NotImplementedError(_('You must implement __call__'))
```

#### Middleware
Middleware 中间件，它利用了 Python 中类似装饰器的编程技巧，Middleware 会接收一个 Application
对象，并实现 Application 接口，这样就可以在 Application 处理的前后添加额外的功能。详见下面的代码。

```python
class Middleware(Application):

    @classmethod
    def factory(cls, global_config, **local_config):
        """
        paste.deploy 约定调用的方法，用来实例化一个 Middleware 对象
        """
        def _factory(app):
            return cls(app, **local_config)
        return _factory

    def __init__(self, application):
        # 接收一个 Application 对象
        self.application = application

    def process_request(self, req):
        """Called on each request.

        If this returns None, the next application down the stack will be
        executed. If it returns a response then that response will be returned
        and execution will stop here.

        """
        return None

    def process_response(self, response):
        """Do whatever you'd like to the response."""
        return response

    @webob.dec.wsgify(RequestClass=Request)
    def __call__(self, req):
        """
        实现了 WSGI 接口，目的是在调用 self.application 处理请求的前后，调用
        自定义的 self.process_request 和 self.process_response 方法。
        """
        response = self.process_request(req) 
        if response:
            return response
        # 调用被包装的 application 对象
        response = req.get_response(self.application)
        return self.process_response(response)
```
#### Router
Router 路由对象，用于路由的管理，借助于 `@webob.dec.wsgify` 装饰器，Router 也实现了 WSGI 接口，从某种意义上来说 Routes 更像一个直接可用的 Application 对象。

```python
class Router(object):

    def __init__(self, mapper):
        """
        路由管理器，nova 中的路由管理使用到了第三方库 routers，这是我们接下来学习的一个重点
        """
        self.map = mapper
        self._router = routes.middleware.RoutesMiddleware(self._dispatch,
                                                          self.map)

    @webob.dec.wsgify(RequestClass=Request)
    def __call__(self, req):
        """
        @webob.dec.wsgify 再次使得 Router 实现了 WSGI 接口，
        Router 的实例更像是一个完整的 Application
        """
        return self._router

    @staticmethod
    @webob.dec.wsgify(RequestClass=Request)
    def _dispatch(req):
        """
        路由匹配的核心处理函数，这里返回的 app 就是我们前面调到的 Resource/Controller 对象
        """
        match = req.environ['wsgiorg.routing_args'][1]
        if not match:
            return webob.exc.HTTPNotFound()
        app = match['controller']
        return app
```

Application/Middlewar/Router 源码我都添加了注释，这里面有两个值的注意的点:
1. Application/Middlewar 都定义了一个 factory 类方法用于实例化，这是它们与 paste.deploy 的约定，paste.deploy 下一节我们就会介绍
2. webob.dec.wsgify(RequestClass=Request) 装饰器，它对 WSGI 接口做了转化，它是我们理解 Nova API 的关键点

### 1.3 webob.dec.wsgify
webob.dec.wsgify 的源码如下(注: wsgify 有很多方法，装饰器功能是我们关注的重点):

```python
class wsgify(object):
    RequestClass = Request

    def __init__(self, func=None, RequestClass=None,
                 args=(), kwargs=None, middleware_wraps=None):
        self.func = func
        if (RequestClass is not None
            and RequestClass is not self.RequestClass):
            self.RequestClass = RequestClass
        self.args = tuple(args)
        if kwargs is None:
            kwargs = {}
        self.kwargs = kwargs
        self.middleware_wraps = middleware_wraps
    
    def _prepare_args(self, args, kwargs):
        args = args or self.args
        kwargs = kwargs or self.kwargs
        if self.middleware_wraps:
            args = (self.middleware_wraps,) + args
        return args, kwargs
    
    def clone(self, func=None, **kw):
        """Creates a copy/clone of this object, but with some
        parameters rebound
        """
        kwargs = {}
        if func is not None:
            kwargs['func'] = func
        if self.RequestClass is not self.__class__.RequestClass:
            kwargs['RequestClass'] = self.RequestClass
        if self.args:
            kwargs['args'] = self.args
        if self.kwargs:
            kwargs['kwargs'] = self.kwargs
        kwargs.update(kw)
        return self.__class__(**kwargs)

    def call_func(self, req, *args, **kwargs):
        """Call the wrapped function; override this in a subclass to
        change how the function is called."""
        return self.func(req, *args, **kwargs)

    def __call__(self, req, *args, **kw):
        """Call this as a WSGI application or with a request"""
        func = self.func
        if func is None:
            if args or kw:
                raise TypeError(
                    "Unbound %s can only be called with the function it "
                    "will wrap" % self.__class__.__name__)
            # 1. 实现了一个带参数的装饰器
            func = req
            return self.clone(func)
        if isinstance(req, dict):
            # 2. WSGI 接口的参数检查
            # 这里的 req 对应的即使 WSGI 接口中的 environ 参数
            if len(args) != 1 or kw:
                # args 里面保存的就是 WSGI 接口的另一个 start_response 参数
                raise TypeError(
                    "Calling %r as a WSGI app with the wrong signature" %
                    self.func)
            environ = req
            start_response = args[0]

            # 3. 请求对象初始化
            req = self.RequestClass(environ)
            req.response = req.ResponseClass()
            
            try:
                # 3. 调用被包装函数
                args, kw = self._prepare_args(None, None)
                # resp 是被包装函数返回的结果，根据结果有不同的处理
                resp = self.call_func(req, *args, **kw)
            except HTTPException as exc:
                resp = exc
            if resp is None:
                ## FIXME: I'm not sure what this should be?
                resp = req.response
            if isinstance(resp, text_type):
                resp = bytes_(resp, req.charset)
            if isinstance(resp, bytes):
                body = resp
                resp = req.response
                resp.write(body)
            # 被包装函数返回了一个新的 Response
            if resp is not req.response:
                resp = req.response.merge_cookies(resp)
            # 4. 所有情况都经过统一处理成 resp 对象，resp 也是实现 WSGI 接口的对象
            # resp 可以是请求处理的终点，直接向 http 服务器返回响应
            # 也可以是一个新的 Application 执行新的请求处理逻辑，这就是上面 Middleware 返回 self.router 的逻辑
            return resp(environ, start_response)
        else:
            # 如果不是 WSGi 的调用，直接调用被装饰函数
            args, kw = self._prepare_args(args, kw)
            return self.call_func(req, *args, **kw)
```

webob.dec.wsgify 的实现中掺杂着前面所说的 Request/Response 逻辑，如果你现在就想知道的更细可以先自己追追源码。这里面更重要的是最后 `resp(environ, start_response)` 的调用逻辑，假如我有三个 Application 对象的实例，它们 WSGI 接口都是通过 webob.dec.wsgify 装饰所实现，并且具有这样的包装关系: `app1(app2(app3))`，它们就会形成这样的一个调用链: `app1.__call__ -> app2.__call__ -> app3.__call__`。这就是中间件、路由、Application 对象之间的结合逻辑。

## 2. paste.deploy
paste.deploy 用来配置和管理 WSGI 应用，对应到源码就是用来定义如何实例化 Application 对象。Nova 正是使用这个库来对 API 服务进行配置和管理，结合 setuptools 和  paste.deploy 我们就可以找到 Nova API 服务的真正入口，因此我们有必要先对它有一定了解。

### 2.1 paste.deploy 配置文件
paste.deploy 的配置文件是形如下面的一个 ini 风格配置文件。

```ini

```

待补充.....

所以像这样使用 paste.deploy 我们就可以得到一个带有中间件功能的 Application 实例。相信到这大家也就明白了中间件跟 Application 之间的关系。

### 2.2 加载 Application 的 Loader 类
Nova 为 paste.deploy 解析加载 Application 提供了一个加载器类 Loader，位于 `nova.api.wsgi`，其源码如下。其核心就是通过 oslo.config 提供的配置文件以及变量查找机制，找到 paste.deploy 配置文件的位置，然后通过传入的 name 查找到对应的 Application 执行初始化并返回。oslo.config 的作用不了解的同学，可以查看前面的章节。

```python
class Loader(object):
    """Used to load WSGI applications from paste configurations."""

    def __init__(self, config_path=None):
        """
        搜索 paste.deploy 配置文件的位置，加载 Application 对象
        """
        self.config_path = None

        config_path = config_path or CONF.wsgi.api_paste_config
        if not os.path.isabs(config_path):
            self.config_path = CONF.find_file(config_path)
        elif os.path.exists(config_path):
            self.config_path = config_path

        if not self.config_path:
            raise exception.ConfigNotFound(path=config_path)

    def load_app(self, name):
        """Return the paste URLMap wrapped WSGI application.

        :param name: Name of the application to load.
        :returns: Paste URLMap object wrapping the requested application.
        :raises: `nova.exception.PasteAppNotFound`
        """
        try:
            LOG.debug("Loading app %(name)s from %(path)s",
                      {'name': name, 'path': self.config_path})
            return deploy.loadapp("config:%s" % self.config_path, name=name)
        except LookupError:
            LOG.exception("Couldn't lookup app: %s", name)
            raise exception.PasteAppNotFound(name=name, path=self.config_path)
```

CONF.wsgi.api_paste_config 默认值为 api-paste.ini，对应的配置文件预定义在 nova/etc 目录下，nova 包被安装时会默认拷贝到 etc/nova/api-paste.ini，这个目录默认就在 oslo.conf 的搜索条件内。

### 2.3 Nova API 服务加载的示例
想必到这，你再去看 api-paste.ini 配置文件，自然就能看懂 Nova 都创建了哪些 API 服务，以及他们初始化的位置，我们就以其中的 osapi_compute api 服务为例，看看他是如何进行路由管理的。

```ini
[composite:osapi_compute]
use = call:nova.api.openstack.urlmap:urlmap_factory
/: oscomputeversions
/v2: oscomputeversion_legacy_v2
/v2.1: oscomputeversion_v2
# v21 is an exactly feature match for v2, except it has more stringent
# input validation on the wsgi surface (prevents fuzzing early on the
# API). It also provides new features via API microversions which are
# opt into for clients. Unaware clients will receive the same frozen
# v2 API feature set, but with some relaxed validation
/v2/+: openstack_compute_api_v21_legacy_v2_compatible
/v2.1/+: openstack_compute_api_v21

[composite:openstack_compute_api_v21]
use = call:nova.api.auth:pipeline_factory_v21
keystone = cors http_proxy_to_wsgi compute_req_id faultwrap request_log sizelimit osprofiler authtoken keystonecontext osapi_compute_app_v21
# DEPRECATED: The [api]auth_strategy conf option is deprecated and will be
# removed in a subsequent release, whereupon this pipeline will be unreachable.
noauth2 = cors http_proxy_to_wsgi compute_req_id faultwrap request_log sizelimit osprofiler noauth2 osapi_compute_app_v21

[app:osapi_compute_app_v21]
paste.app_factory = nova.api.openstack.compute:APIRouterV21.factory
```
osapi_compute_app_v21 对应的 Application 的初始化在 `nova.api.openstack.compute:APIRouterV21.factory`，下面是其核心源码:

```python
def _create_controller(main_controller, action_controller_list):
    """This is a helper method to create controller with a
    list of action controller.
    """

    controller = wsgi.Resource(main_controller())
    for ctl in action_controller_list:
        controller.register_actions(ctl())
    return controller

flavor_controller = functools.partial(_create_controller,
    flavors.FlavorsController,
    [
        flavor_manage.FlavorManageController,
        flavor_access.FlavorActionController
    ]
)

ROUTE_LIST = (
    # NOTE: This is a redirection from '' to '/'. The request to the '/v2.1'
    # or '/2.0' without the ending '/' will get a response with status code
    # '302' returned.
    ('', '/'),
    ('/', {
        'GET': [version_controller, 'show']
    }),
    ('/flavors', {
        'GET': [flavor_controller, 'index'],
        'POST': [flavor_controller, 'create']
    }),
    ('/flavors/detail', {
        'GET': [flavor_controller, 'detail']
    }),
    ('/flavors/{id}', {
        'GET': [flavor_controller, 'show'],
        'PUT': [flavor_controller, 'update'],
        'DELETE': [flavor_controller, 'delete']
    }),
    ('/flavors/{id}/action', {
        'POST': [flavor_controller, 'action']
    }),
)

class APIRouterV21(base_wsgi.Router):
    """Routes requests on the OpenStack API to the appropriate controller
    and method. The URL mapping based on the plain list `ROUTE_LIST` is built
    at here.
    """
    def __init__(self, custom_routes=None):
        """:param custom_routes: the additional routes can be added by this
               parameter. This parameter is used to test on some fake routes
               primarily.
        """
        super(APIRouterV21, self).__init__(nova.api.openstack.ProjectMapper())

        if custom_routes is None:
            custom_routes = tuple()

        for path, methods in ROUTE_LIST + custom_routes:
            # NOTE(alex_xu): The variable 'methods' is a dict in normal, since
            # the dict includes all the methods supported in the path. But
            # if the variable 'method' is a string, it means a redirection.
            # For example, the request to the '' will be redirect to the '/' in
            # the Nova API. To indicate that, using the target path instead of
            # a dict. The route entry just writes as "('', '/)".
            if isinstance(methods, str):
                self.map.redirect(path, methods)
                continue

            for method, controller_info in methods.items():
                # TODO(alex_xu): In the end, I want to create single controller
                # instance instead of create controller instance for each
                # route.
                controller = controller_info[0]()
                action = controller_info[1]
                self.map.create_route(path, method, controller, action)

    @classmethod
    def factory(cls, global_config, **local_config):
        """Simple paste factory, :class:`nova.wsgi.Router` doesn't have one."""
        return cls()
```

其中:
1. nova.api.openstack.wsgi.Resource + 各种 Controller 就是我们的请求处理函数
2. APIRouterV21: 就是我们新定义的路由管理对象，它继承自 `nova.api.wsgi.Router`，继承关系如图 4.3 所示

![4.3 路由的继承关系](/images/openstack/routes.png)

APIRouterV21 只是定义了url 与请求处理函数之间的路由关系，因此要想搞明白路由管理，我们还是要回到 nova.api.wsgi.Router 上。

写到这内容已经很多了，API 服务的路由管理，我们放到下一节继续介绍。