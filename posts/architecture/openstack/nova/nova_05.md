---
title: 5. API 接口服务(二)路由管理
date: 2021-03-05
categories:
    - 运维
tags:
	- Openstack
---

今天我们来介绍 Nova API 服务的第二篇内容: API 服务的路由管理。

<!-- more -->

## 1. 路由的实现
上一节我们说到路由管理，我们要回到 nova.api.wsgi.Router 上。Nova API 服务的请求处理函数其实相当复杂，原因在于它承担了部分路由功能 -- 分发了一个可用 RESETful 资源上可执行的动作。如果你自己阅读过源码就会发现，Nova 的代码中有多个 wsgi.py(注这里的nova/ 指的是 nova/nova/):
1. nova/wsgi.py: 并发管理
2. nova/api/wsgi.py: web 应用的接口定义
3. nova/api/openstack/wsgi.py: web 应用的接口实现

路由实现的核心类 Resource 和 Control 就定义在 nova/api/openstack/wsgi.py 中 ，这里面的 UML 继承关系如下图 4.4 所示:

![4.4 wsgi 之间的关联关系](/images/openstack/wsgi_relaitons.png)

其中:
1. Resource 同样继承了 Application 实现了 WSGI 接口，它实现了一个可用 RESETful 资源上可执行的动作，即一个 URL 上不同 GET/POST/DELETE/UPDATE http 方法对应的请求处理函数
2. Control 类中包含的众多方法是请求处理函数的具体实现 
3. ActionDispatcher 定义了如何对 http body 中的  json 字符串进行序列化和反序列

注: 这里我先告诉你结论，后面我们在结合代码详细解释。

至此我们总结一下 Nova API 中的路由实现:
1. nova.api.wsgi.Router: 路由实现的核心类，它使用了 routes 第三方库实现了url 到 Resource 对象的路由匹配
2. nova.api.openstack.wsgi.Resource: 实现了 http 方法到请求处理函数的路由匹配
3. nova.api.openstack.wsgi.Control: 类中的方法就是具体的请求处理函数

在我们串联起这些对象之前，我们先来熟悉一下 routes 第三方库，这是我们理解 nova.api.wsgi.Router 的关键。

### 1.1 routes 库
routes 是一个 url 匹配的第三方库，我们通过几个示例看看它到底是做什么的。

#### Mapper 和 Connect

Mapper 用来创建路由实例对象，Connect 用来在 Mapper 注册 url 的匹配规则。

```Python
from routes import Mapper

# 1. 创建 mapper 路由实例对象
url_map = Mapper()

# 2. connect 注册路由信息。
# 2.1 路由名称'lixin'， 路径是 ‘/blog’, controller为请求处理对象， action为在请求处理处理对象上调用的方法名
url_map.connect('lixin', '/blog', controller='main', action='index')
url_map.connect(None, '/error/{action}/{id}', controller='error')
# 2.2 action可以从匹配路由中获得
url_map.connect(None, '/error/{action:index|lixin}/{id:\d+}', controller='error')
# 2.3 conditions 控制只匹配 GET、HEAD请求
url_map.connect('/user/list', controller = 'user', action = 'list',
                conditions={'method' : ['GET', 'HEAD']})
# 2.4 指定路由匹配规则
url_map.connect(r'/blog/{id:\d+}')
url_map.connect(r'/blog/{platfrom}/{filename}', requirements={'platform':r'windows|linux'})
# 2.5 通过{.format}来指定匹配格式   
url_map.connect('/entries/{id}{.format:mp8}', controller = 'main', action = 'index')

# 3. 匹配路由
result = url_map.match('/blog')
print(result)
# 输出 {'controller': 'main', 'action': 'index'}
```

#### Resource
有时候为了简化 url 注册，可以使用 Resource 批量注册一组 url 规则。

`resource(self, member_name, collection_name, **kwargs):`
- member_name: 指定单数操作对象的路由名称
- collection_name: 指定复数操作对象的路由名称
- kwargs: 可以指定额外控制参数
    - collection: 注册单数操作对象的额外操作
    - member: 注册多数操作对象的额外操作

比如 `resource("message","messages",controller=a)` 可以代替下面这些规则:
1. `connect('/messages',controller=a,action='index',conditions={'method':['GET']})`
2. `connect('/messages',controller=a,action='create',conditions={'method':['POST']})`
3. `connect('/messages/{id}',controller=a,action='show',conditions={'method':['GET']})`
4. `connect('/messages/{id}',controller=a,action='update',conditions={'method':['PUT']})`
5. `connect('/messages/{id}',controller=a,action='delete',conditions={'method':['DELETE']})`

```python
resource('message', 'messages',controller="a",path_prefix='/{projectid}',
                    collection={'list_many':'GET','create_many':'POST'},
                    member={'update_many':'POST','delete_many':'POST'})
```

比如上面面的 resource 会额外注册一下url:
1. `/proj1/messages/list_many`: 
    - match 后的结果: {'action': u'list_many', 'projectid': u'proj1', 'controller': 'a'}
2. `/proj1/messages/member_3/update_many`: 
    - match 后的结果: {'action': u'update_many', 'projectid': u'proj1', 'controller': 'a', 'id': u'member_3'}

routes 的 Mapper.resouce 方法有很多种用法，不过到这里对于我们理解 Nova API 的路由注册已经足够了，其他用法就不再赘述了。

理解 routes 的重点在于:
1. url 的注册方式，特别是 resource，其实感觉很不直观，而且 url 的注册跟请求处理函数分离的太远，真心感觉没有 flask 直观好用
2. Mapper.match 的结果:
    - controller: 是匹配成功对应的请求处理函数，这里保存的就是之后要讲的 nova.api.openstack.wsgi.Resouce 对象
    - action: 要调用的 controller 方法名
    - 其他参数，比如上面示例中的 projectid，id，都是 url 中注册的请求参数

### 1.2 nova.api.wsgi.Router

```python
class Router(object):

    def __init__(self, mapper):
        """
        路由管理器，nova 中的路由管理使用到了第三方库 routers，这是我们接下来学习的一个重点
        """
        self.map = mapper
        # 路由管理的核心
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

前面我们已经解析了 Router 类的源码，Router 路由管理的核心是 
`self._router = routes.middleware.RoutesMiddleware(self._dispatch,self.map)`
- `self.map`: 是 routes.Mapper 路由实例对象
- `self._dispatch`: 是路由匹配成功后的方法调用
- `self._router`: 本身也实现了 wsgi 接口，`Router.__call__` 会在内部继续调用 `self._router.__call__`

所以接下来我们就来看看 routes.middleware.RoutesMiddleware 中做了什么，下面是其源码

```python
"""Routes WSGI Middleware"""
import re
import logging

from webob import Request

from routes.base import request_config
from routes.util import URLGenerator

log = logging.getLogger('routes.middleware')


class RoutesMiddleware(object):
    """解析 url 并将解析结果添加到 environ 中
    """
    def __init__(self, wsgi_app, mapper, use_method_override=True,
                 path_info=True, singleton=True):
        """Create a Route middleware object
        """
        self.app = wsgi_app
        self.mapper = mapper
        self.singleton = singleton
        self.use_method_override = use_method_override
        self.path_info = path_info
        self.log_debug = logging.DEBUG >= log.getEffectiveLevel()
        if self.log_debug:
            log.debug("Initialized with method overriding = %s, and path "
                      "info altering = %s", use_method_override, path_info)

    def __call__(self, environ, start_response):
        """解析 url 路径，并将解析结果添加到 environ['wsgiorg.routing_args']"""
        old_method = None
        # 1. method 重置规则
        if self.use_method_override:
            req = None

            # In some odd cases, there's no query string
            try:
                # ('QUERY_STRING','id=1234&name=tom')
                qs = environ['QUERY_STRING']
            except KeyError:
                qs = ''
            if '_method' in qs:
                req = Request(environ)
                req.errors = 'ignore'

                try:
                    method = req.GET.get('_method')
                except UnicodeDecodeError:
                    method = None

                if method:
                    old_method = environ['REQUEST_METHOD']
                    environ['REQUEST_METHOD'] = method.upper()
                    if self.log_debug:
                        log.debug("_method found in QUERY_STRING, altering "
                                  "request method to %s",
                                  environ['REQUEST_METHOD'])
            elif environ['REQUEST_METHOD'] == 'POST' and is_form_post(environ):
                if req is None:
                    req = Request(environ)
                    req.errors = 'ignore'

                try:
                    method = req.POST.get('_method')
                except UnicodeDecodeError:
                    method = None

                if method:
                    old_method = environ['REQUEST_METHOD']
                    environ['REQUEST_METHOD'] = method.upper()
                    if self.log_debug:
                        log.debug("_method found in POST data, altering "
                                  "request method to %s",
                                  environ['REQUEST_METHOD'])

        # Run the actual route matching
        # -- Assignment of environ to config triggers route matching
        # 2. 这里没太明白，单例是为了什么
        if self.singleton:
            config = request_config()
            config.mapper = self.mapper
            config.environ = environ
            match = config.mapper_dict
            route = config.route
        else:
            results = self.mapper.routematch(environ=environ)
            if results:
                match, route = results[0], results[1]
            else:
                match = route = None

        if old_method:
            environ['REQUEST_METHOD'] = old_method

        if not match:
            match = {}
            if self.log_debug:
                urlinfo = "%s %s" % (environ['REQUEST_METHOD'],
                                     environ['PATH_INFO'])
                log.debug("No route matched for %s", urlinfo)
        elif self.log_debug:
            urlinfo = "%s %s" % (environ['REQUEST_METHOD'],
                                 environ['PATH_INFO'])
            log.debug("Matched %s", urlinfo)
            log.debug("Route path: '%s', defaults: %s", route.routepath,
                      route.defaults)
            log.debug("Match dict: %s", match)

        # 3. 在 environ 中记录 url 解析的结果
        # route 是 routes.route.Route 类实例，是 mapper 中注册的一条特定的路由项
        # match 就是前面介绍的路由匹配结果
        url = URLGenerator(self.mapper, environ)
        environ['wsgiorg.routing_args'] = ((url), match)
        environ['routes.route'] = route
        environ['routes.url'] = url

        if route and route.redirect:
            route_name = '_redirect_%s' % id(route)
            location = url(route_name, **match)
            log.debug("Using redirect route, redirect to '%s' with status"
                      "code: %s", location, route.redirect_status)
            start_response(route.redirect_status,
                           [('Content-Type', 'text/plain; charset=utf8'),
                            ('Location', location)])
            return []

        # If the route included a path_info attribute and it should be used to
        # alter the environ, we'll pull it out
        if self.path_info and 'path_info' in match:
            oldpath = environ['PATH_INFO']
            newpath = match.get('path_info') or ''
            environ['PATH_INFO'] = newpath
            if not environ['PATH_INFO'].startswith('/'):
                environ['PATH_INFO'] = '/' + environ['PATH_INFO']
            environ['SCRIPT_NAME'] += re.sub(
                r'^(.*?)/' + re.escape(newpath) + '$', r'\1', oldpath)
        # 3. 调用传入的 application 
        response = self.app(environ, start_response)

        # Wrapped in try as in rare cases the attribute will be gone already
        try:
            del self.mapper.environ
        except AttributeError:
            pass
        return response


def is_form_post(environ):
    """Determine whether the request is a POSTed html form"""
    content_type = environ.get('CONTENT_TYPE', '').lower()
    if ';' in content_type:
        content_type = content_type.split(';', 1)[0]
    return content_type in ('application/x-www-form-urlencoded',
                            'multipart/form-data')
```

虽然完整的代码含义，我们一时半会还不能完全理解，但是不妨碍我们理解整体的处理流程:
1. RoutesMiddleware 核心作用就是使用 routes 进行 url 路由匹配，并将匹配的结果放入 `environ['wsgiorg.routing_args']` 并调用 `Routes._dispatch` 方法
2. `Routes._dispatch` 从 environ 中拿到 url 的解析结果，其中的 controller 键保存的就是对应的请求处理函数即 Resource 对象
3. Resouce 对象同样是一个 Application，继续调用其 `__call__` 方法。

### 1.3 Router 中的路由注册
所以现在让我们回到 APIRouterV21 看看路由是怎么注册的。

```python
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

```

Router 类中的 self.map 是一个 nova.api.openstack.ProjectMapper 对象。它的源码如下:

![4.5 ProjectMapper](/images/openstack/poject_mapper.png)

```python
class ProjectMapper(APIMapper):
    def _get_project_id_token(self):
        # NOTE(sdague): project_id parameter is only valid if its hex
        # or hex + dashes (note, integers are a subset of this). This
        # is required to hand our overlaping routes issues.
        return '{project_id:[0-9a-f-]+}'

    def resource(self, member_name, collection_name, **kwargs):
        project_id_token = self._get_project_id_token()
        if 'parent_resource' not in kwargs:
            kwargs['path_prefix'] = '%s/' % project_id_token
        else:
            parent_resource = kwargs['parent_resource']
            p_collection = parent_resource['collection_name']
            p_member = parent_resource['member_name']
            kwargs['path_prefix'] = '%s/%s/:%s_id' % (
                project_id_token,
                p_collection,
                p_member)
        routes.Mapper.resource(
            self,
            member_name,
            collection_name,
            **kwargs)

        # while we are in transition mode, create additional routes
        # for the resource that do not include project_id.
        if 'parent_resource' not in kwargs:
            del kwargs['path_prefix']
        else:
            parent_resource = kwargs['parent_resource']
            p_collection = parent_resource['collection_name']
            p_member = parent_resource['member_name']
            kwargs['path_prefix'] = '%s/:%s_id' % (p_collection,
                                                   p_member)
        routes.Mapper.resource(self, member_name,
                                     collection_name,
                                     **kwargs)

    def create_route(self, path, method, controller, action):
        project_id_token = self._get_project_id_token()

        # while we transition away from project IDs in the API URIs, create
        # additional routes that include the project_id
        self.connect('/%s%s' % (project_id_token, path),
                     conditions=dict(method=[method]),
                     controller=controller,
                     action=action)
        self.connect(path,
                     conditions=dict(method=[method]),
                     controller=controller,
                     action=action)
#

```
APIRouterV21，主要使用了 ProjectMapper 的 creat_route 方法，这个方法在原有的 routes.Mapper 对象增加了一层逻辑，将原有的 url 添加了 project_id，并注册为新的 url。

creat_route接收的参数中:
1. path: 是 url 的路径
2. method: 是对应的请求方法
3. controller: 是 Resource 和 Controller 的组合对象
4. action: 是 controller 的方法名。

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
```

那么现在要解决的问题就是 Resource 和 Controller 是如何组合的呢？我们先来看 Controller

## 2. Controller
Controller 包含了请求处理的具体方法。要想明白 Control 是怎么与 Resource 关联，我们需要弄清楚下面几点:
1. Controller 是如何定义或者说区分出哪些方法是真正用来处理请求的方法的？
2. Controller 是如何把收集这些方法传递给 Resource 的

而这些逻辑的实现在 Controller 的方法定义和其元类中。

### 2.1 Controller 的请求方法定义
我们先来 Controller 是如何定义其请求处理的方法的。下面是其方法定义的一个示例:

```python
class AdminActionsController(wsgi.Controller):
    def __init__(self):
        super(AdminActionsController, self).__init__()
        self.compute_api = compute.API()

    @wsgi.response(202)
    @wsgi.expected_errors(404)
    @wsgi.action('os-resetState')
    @validation.schema(reset_server_state.reset_state)
    def _reset_state(self, req, id, body):
        """Permit admins to reset the state of a server."""
        context = req.environ["nova.context"]
        instance = common.get_instance(self.compute_api, context, id)
        context.can(aa_policies.POLICY_ROOT % 'reset_state',
                    target={'project_id': instance.project_id})

        # Log os-resetState as an instance action
        instance_action = objects.InstanceAction.action_start(
            context, instance.uuid, instance_actions.RESET_STATE)

        # Identify the desired state from the body
        state = state_map[body["os-resetState"]["state"]]

        instance.vm_state = state
        instance.task_state = None
        instance.save(admin_state_reset=True)
        instance_action.finish()

class FlavorsController(wsgi.Controller):
    """Flavor controller for the OpenStack API."""

    _view_builder_class = flavors_view.ViewBuilder

    @validation.query_schema(schema.index_query_275, '2.75')
    @validation.query_schema(schema.index_query, '2.0', '2.74')
    @wsgi.expected_errors(400)
    def index(self, req):
        """Return all flavors in brief."""
        limited_flavors = self._get_flavors(req)
        return self._view_builder.index(req, limited_flavors)
```

所有用于处理请求的方法都被很多装饰器装饰:
1. wsgi.response: `func.wsgi_code = code`，即为方法添加了 wsgi_code 属性
2. wsgi.expected_errors: 为请求方法定义预期的错误，非预期错误会触发异常
3. validation.schema: 在调用方法前，使用 schema 对请求的 body 进行参数检验
5. validation.query_schema: 带版本号的，请求参数认证
4. wsgi.action: `func.wsgi_action = name` 为方法添加 wsig_action 属性，这个属性就是有从来区分请求处理方法的。


### 2.2 Controller 元类
Controller 类本身大多数代码都与 API  的版本号管理相关，这个我们暂时搁置，而与请求处理方法收集的代码都在 Controller 的元类中，下面是其源码:

```python
class ControllerMetaclass(type):
    """Controller 的元类
    """`

    def __new__(mcs, name, bases, cls_dict):
        """
        name: 类名
        bases: 类继承的父类
        cls_dict: 类所有属性组成的 dict
        """

        # Find all actions
        actions = {}
        versioned_methods = None
        # start with wsgi actions from base classes
        for base in bases:
            # 1. 收集 wsgi_actions 
            actions.update(getattr(base, 'wsgi_actions', {}))

            if base.__name__ == "Controller":
                # NOTE(cyeoh): This resets the VER_METHOD_ATTR attribute
                # between API controller class creations. This allows us
                # to use a class decorator on the API methods that doesn't
                # require naming explicitly what method is being versioned as
                # it can be implicit based on the method decorated. It is a bit
                # ugly.
                if VER_METHOD_ATTR in base.__dict__:
                    versioned_methods = getattr(base, VER_METHOD_ATTR)
                    delattr(base, VER_METHOD_ATTR)

        for key, value in cls_dict.items():
            if not callable(value):
                continue
            # 2. 如果类属性是可调用的，并且具有 wsgi_action 属性，
            # 即被 wsgi.action 装饰了
            if getattr(value, 'wsgi_action', None):
                # 3. 收集的是 func.wsgi_action 到方法名的映射
                actions[value.wsgi_action] = key

        # 3. 把收集到的所有方法放到 wsgi_action 属性上，添加到类中
        cls_dict['wsgi_actions'] = actions
        if versioned_methods:
            cls_dict[VER_METHOD_ATTR] = versioned_methods

        return super(ControllerMetaclass, mcs).__new__(mcs, name, bases,
                                                       cls_dict)


class Controller(metaclass=ControllerMetaclass):
    """Default controller."""

    _view_builder_class = None

    def __init__(self):
        """Initialize controller with a view builder instance."""
        if self._view_builder_class:
            self._view_builder = self._view_builder_class()
        else:
            self._view_builder = None
```

## 3. Resouce
至此 Controller 类我们已经摸透了，现在看看它是如何和 Resouce 关联起来的。下面是 Resource 类的源码。Resouce 的源码非常长，因为包含了下面这些功能:
1. 解析 http body 反序列化 
2. 调用 Controller 方法的逻辑代码
3. 将作为响应的 dict 序列化为 http json 响应

```python
class Resource(wsgi.Application):
    """WSGI app that handles (de)serialization and controller dispatch.

    WSGI app that reads routing information supplied by RoutesMiddleware
    and calls the requested action method upon its controller.  All
    controller action methods must accept a 'req' argument, which is the
    incoming wsgi.Request. If the operation is a PUT or POST, the controller
    method must also accept a 'body' argument (the deserialized request body).
    They may raise a webob.exc exception or return a dict, which will be
    serialized by requested content type.

    Exceptions derived from webob.exc.HTTPException will be automatically
    wrapped in Fault() to provide API friendly error responses.

    """
    support_api_request_version = True

    def __init__(self, controller):
        """
        controller: 接收的主 Controller 对象
        """

        self.controller = controller

        self.default_serializers = dict(json=JSONDictSerializer)

        # 1. 将 Controller 中的请求处理方法注册到 Resouce 中
        self.wsgi_actions = {}
        if controller:
            self.register_actions(controller)

    def register_actions(self, controller):
        actions = getattr(controller, 'wsgi_actions', {})
        # 2. key 是 wsgi_action, method_name 是 controller 的方法名
        for key, method_name in actions.items():
            self.wsgi_actions[key] = getattr(controller, method_name)

    def get_action_args(self, request_environment):
        """
        从 environ 中解析，请求处理方法的调用参数
        """
        # 如果 controller 有自定义的参数解析方法，调用自定义方法
        if hasattr(self.controller, 'get_action_args'):
            return self.controller.get_action_args(request_environment)

        try:
            # routes.match 的返回结果 {controller: "", "actions": "", "format": "", 其他 url 包含的参数}
            args = request_environment['wsgiorg.routing_args'][1].copy()
        except (KeyError, IndexError, AttributeError):
            return {}

        try:
            del args['controller']
        except KeyError:
            pass

        try:
            del args['format']
        except KeyError:
            pass

        return args

    def get_body(self, request):
        # 1. 获取请求体
        content_type = request.get_content_type()

        return content_type, request.body

    def deserialize(self, body):
        # 1. 解析请求体
        return JSONDeserializer().deserialize(body)

    def _should_have_body(self, request):
        return request.method in _METHODS_WITH_BODY

    @webob.dec.wsgify(RequestClass=Request)
    def __call__(self, request):
        """执行序列化、反序列化以及方法调用"""

        if self.support_api_request_version:
            # Set the version of the API requested based on the header
            try:
                request.set_api_version_request()
            except exception.InvalidAPIVersionString as e:
                return Fault(webob.exc.HTTPBadRequest(
                    explanation=e.format_message()))
            except exception.InvalidGlobalAPIVersion as e:
                return Fault(webob.exc.HTTPNotAcceptable(
                    explanation=e.format_message()))

        # 1. 获取请求参数，action 对应的就是请求调用方法
        action_args = self.get_action_args(request.environ)
        action = action_args.pop('action', None)

        # NOTE(sdague): we filter out InvalidContentTypes early so we
        # know everything is good from here on out.
        try:
            # content_type 接收的请求体内容类型，body 请求体，accept 范湖返回的内容类型
            content_type, body = self.get_body(request)
            accept = request.best_match_content_type()
        except exception.InvalidContentType:
            msg = _("Unsupported Content-Type")
            return Fault(webob.exc.HTTPUnsupportedMediaType(explanation=msg))

        # 2. 将剩余部分从 __call__ 方法分离出来，是为了便于对剩下的代码做 auditing
        # 不能直接对 __call__ 方法做 audit 会导致报错，因为 webob.dec.wsgify 装饰器
        return self._process_stack(request, action, action_args,
                               content_type, body, accept)

    def _process_stack(self, request, action, action_args,
                       content_type, body, accept):
        """
        """
        # 1. 获取请求调用的方法
        try:
            meth = self.get_method(request, action,
                                   content_type, body)
        except (AttributeError, TypeError):
            return Fault(webob.exc.HTTPNotFound())
        except KeyError as ex:
            msg = _("There is no such action: %s") % ex.args[0]
            return Fault(webob.exc.HTTPBadRequest(explanation=msg))
        except exception.MalformedRequestBody:
            msg = _("Malformed request body")
            return Fault(webob.exc.HTTPBadRequest(explanation=msg))

        if body:
            msg = _("Action: '%(action)s', calling method: %(meth)s, body: "
                    "%(body)s") % {'action': action,
                                   'body': str(body, 'utf-8'),
                                   'meth': str(meth)}
            LOG.debug(strutils.mask_password(msg))
        else:
            LOG.debug("Calling method '%(meth)s'",
                      {'meth': str(meth)})

        try:
            # 2. 解析请求体，现在默认请求体都为 json，解析结果为 {"body": ...}
            contents = self._get_request_content(body, request)
        except exception.MalformedRequestBody:
            msg = _("Malformed request body")
            return Fault(webob.exc.HTTPBadRequest(explanation=msg))

        # 3. 加 body 添加到参数集合中
        action_args.update(contents)

        project_id = action_args.pop("project_id", None)
        context = request.environ.get('nova.context')
        # pproject_id 验证逻辑
        if (context and project_id and (project_id != context.project_id)):
            msg = _("Malformed request URL: URL's project_id '%(project_id)s'"
                    " doesn't match Context's project_id"
                    " '%(context_project_id)s'") % \
                    {'project_id': project_id,
                     'context_project_id': context.project_id}
            return Fault(webob.exc.HTTPBadRequest(explanation=msg))

        response = None
        try:
            # 4. 调用请求处理方法
            with ResourceExceptionHandler():
                action_result = self.dispatch(meth, request, action_args)
        except Fault as ex:
            response = ex

        if not response:
            # 没有异常，将 action_result 转换为 response
            resp_obj = None
            if type(action_result) is dict or action_result is None:
                # 5. ResponseObject 为 nova.api.openstack.wsgi.ResponseObject
                resp_obj = ResponseObject(action_result)
            elif isinstance(action_result, ResponseObject):
                resp_obj = action_result
            else:
                response = action_result

            # Run post-processing extensions
            if resp_obj:
                # 5. 设置默认响应码，与前面 wsgi.response 装饰器有关
                if hasattr(meth, 'wsgi_code'):
                    resp_obj._default_code = meth.wsgi_code
            # 6. 将响应对象转换为响应
            if resp_obj and not response:
                # 这里默认的响应也是 json，不在支持 xml
                response = resp_obj.serialize(request, accept)

        if hasattr(response, 'headers'):
            for hdr, val in list(response.headers.items()):
                if not isinstance(val, str):
                    val = str(val)
                # In Py3.X Headers must be a string
                response.headers[hdr] = encodeutils.safe_decode(
                        encodeutils.safe_encode(val))
            # 7. 请求头添加版本控制的头
            if not request.api_version_request.is_null():
                response.headers[API_VERSION_REQUEST_HEADER] = \
                    'compute ' + request.api_version_request.get_string()
                response.headers[LEGACY_API_VERSION_REQUEST_HEADER] = \
                    request.api_version_request.get_string()
                response.headers.add('Vary', API_VERSION_REQUEST_HEADER)
                response.headers.add('Vary', LEGACY_API_VERSION_REQUEST_HEADER)

        return response

    def _get_request_content(self, body, request):
        contents = {}
        if self._should_have_body(request):
            # allow empty body with PUT and POST
            if request.content_length == 0 or request.content_length is None:
                contents = {'body': None}
            else:
                contents = self.deserialize(body)
        return contents

    def get_method(self, request, action, content_type, body):
        meth = self._get_method(request,
                                action,
                                content_type,
                                body)
        return meth

    def _get_method(self, request, action, content_type, body):
        """根据 action 查找请求处理方法"""
        try:
            # 1. 如果没有 controller 则世界在 Resouce 查找请求处理的方法 
            # 否则在 controller 根据 action 直接查找
            if not self.controller:
                meth = getattr(self, action)
            else:
                meth = getattr(self.controller, action)
            return meth
        except AttributeError:
            if (not self.wsgi_actions or
                    action not in _ROUTES_METHODS + ['action']):
                # Propagate the error
                raise
        # 2. action == 'action'，此时 请求体必须是json，其格式为 {"method_name": .....}
        # 将 method_name 作为方法查找依据
        if action == 'action':
            action_name = action_peek(body)
        else:
            action_name = action

        # Look up the action method
        return (self.wsgi_actions[action_name])

    def dispatch(self, method, request, action_args):
        """Dispatch a call to the action-specific method."""

        try:
            return method(req=request, **action_args)
        except exception.VersionNotFoundForAPIMethod:
            # We deliberately don't return any message information
            # about the exception to the user so it looks as if
            # the method is simply not implemented.
            return Fault(webob.exc.HTTPNotFound())

def action_peek(body):
    """Determine action to invoke.

    This looks inside the json body and fetches out the action method
    name.
    """

    try:
        decoded = jsonutils.loads(body)
    except ValueError:
        msg = _("cannot understand JSON")
        raise exception.MalformedRequestBody(reason=msg)

    # Make sure there's exactly one key...
    if len(decoded) != 1:
        msg = _("too many body keys")
        raise exception.MalformedRequestBody(reason=msg)

    # Return the action name
    return list(decoded.keys())[0]
```

总结一下，Resource 做了如下这些事情:
1. 将 Controller 中的 wsgi_action 收集到了 Resource 中
2. 解析 url 中包含的参数，解析 http request body 参数，获取 action
3. action 首先从 url 中解析而来，并在 Resource 和 Controller 查找同名方法，查找成功，则作为请求处理函数
4. 如果查找失败，并且 action == "action"，则 action 从 body 解析而来，并在 resource 收集的 wsgi_action 查找同名请求处理函数
5. 查找成功后，调用请求处理方法，生成 response 并返回。
6. 生成的 response 是 webob.Response，它的 `__call__` 作为 Application 调用的终点，向 web 服务器返回响应

至此 Nova API 的路由生成逻辑我们也已经讲完了。说实话调用链是真的长，最关键的是封装做的不够好。如果不了解这套机制，很难找到请求对应的请求处理函数。下一节我们就来介绍 Nova API 服务的并发管理。