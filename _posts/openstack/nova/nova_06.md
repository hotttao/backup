---
title: 6. API 接口服务(三)并发管理
date: 2021-03-07
categories:
    - 运维
tags:
	- Openstack
---

今天我们来介绍 Nova API 服务的第三篇内容: API 服务的并发管理。

<!-- more -->

## 1. Nova API 服务启动
从前面介绍的 Python 包管理工具 setuptools，我们知道 nova 所有的服务入口都定义在 nova/setup.cfg 的 console 配置段中:


```python
console_scripts =
    nova-api = nova.cmd.api:main
    nova-api-metadata = nova.cmd.api_metadata:main
    nova-api-os-compute = nova.cmd.api_os_compute:main
    nova-compute = nova.cmd.compute:main
    nova-conductor = nova.cmd.conductor:main
    nova-manage = nova.cmd.manage:main
    nova-novncproxy = nova.cmd.novncproxy:main
    nova-policy = nova.cmd.policy:main
    nova-rootwrap = oslo_rootwrap.cmd:main
    nova-rootwrap-daemon = oslo_rootwrap.cmd:daemon
    nova-scheduler = nova.cmd.scheduler:main
    nova-serialproxy = nova.cmd.serialproxy:main
    nova-spicehtml5proxy = nova.cmd.spicehtml5proxy:main
    nova-status = nova.cmd.status:main
wsgi_scripts =
    nova-api-wsgi = nova.api.openstack.compute.wsgi:init_application
    nova-metadata-wsgi = nova.api.metadata.wsgi:init_application
```

其中 `nova-api = nova.cmd.api:main` 定义的就是 Nova API 服务的入口，源码如下:

```python
# nova.cmd.api.py

import sys

from oslo_log import log as logging
from oslo_reports import guru_meditation_report as gmr
from oslo_reports import opts as gmr_opts

import nova.conf
from nova.conf import remote_debug
from nova import config
from nova import exception
from nova import objects
from nova import service
from nova import version

CONF = nova.conf.CONF
remote_debug.register_cli_opts(CONF)     # 注册服务配置选项


def main():
    config.parse_args(sys.argv)          # 解析配置文件和命令行参数
    logging.setup(CONF, "nova")          # 日志配置
    objects.register_all()               # 数据库操作对象初始化
    gmr_opts.set_defaults(CONF)          
    if 'osapi_compute' in CONF.enabled_apis:  # 服务兼容处理，后面会单独介绍
        # NOTE(mriedem): This is needed for caching the nova-compute service
        # version.
        objects.Service.enable_min_version_cache()
    log = logging.getLogger(__name__)

    gmr.TextGuruMeditation.setup_autorun(version, conf=CONF)

    launcher = service.process_launcher() # 重点1：API 服务的并发管理
    started = 0                       
    for api in CONF.enabled_apis:                    
        should_use_ssl = api in CONF.enabled_ssl_apis 
        try:
            server = service.WSGIService(api, use_ssl=should_use_ssl) # 重点2: Web API 初始化
            launcher.launch_service(server, workers=server.workers or 1) # Web 服务启动
            started += 1
        except exception.PasteAppNotFound as ex:
            log.warning("%s. ``enabled_apis`` includes bad values. "
                        "Fix to remove this warning.", ex)

    if started == 0:
        log.error('No APIs were started. '
                  'Check the enabled_apis config option.')
        sys.exit(1)

    launcher.wait()                                                  # 服务一致运行直至退出
```

启动脚本中有两个核心对象:
1. service.process_launcher(): 返回一个 Lancher 对象，用于对服务进行并发管理
2. nova.service.WSGIService: 包装了一个完整的 Web API 服务，定义了 Web 服务如何启动和停止

Lancher 与 WSGIService 的关系可以理解为，Lancher 可以将 WSGIService 中的操作并行化。这两个对象就是我们接下来要讲的并发服务管理的核心。我们先来看看这两个类的继承层次。

### 1.2 WSGIService 的 UML 类图
WSGIService 位于 nova.api.service 模块，下面是其 UML 类图。

![6.1 service 的继承关系](/images/openstack/api_service.png)

其中:
1. oslo_service.service.ServiceBase 定义了服务的接口
2. oslo_service.service.Service 是 ServiceBase 的基本实现，里面包含了一个 eventlet 的协程池
3. nova.service.Service 是 rpc 服务的实现
4. nova.service.WSGIService 是 web api 服务的实现

### 1.3 Lancher 的 UML 类图
nova.service.process_launcher 的源码如下:

```python
from oslo_service import service

def process_launcher():
    return service.ProcessLauncher(CONF, restart_method='mutate')
```

显然我们要看的是 oslo_service.service.ProcessLauncher 的继承层次。

![6.2 Lancher 的继承关系](/images/openstack/api_lancher.png)

乍一看 oslo_service.service 的源码，有很多类，而且貌似没有深关联。让我们细看下去，oslo_service.service 中有一个 lancher 函数，源码如下:

```python
def launch(conf, service, workers=1, restart_method='reload'):
    """使用给定的进程数启动一个服务.
    """

    if workers is not None and not isinstance(workers, int):
        raise TypeError(_("Type of workers should be int!"))

    if workers is not None and workers <= 0:
        raise ValueError(_("Number of workers should be positive!"))

    if workers is None or workers == 1:
        launcher = ServiceLauncher(conf, restart_method=restart_method)
    else:
        launcher = ProcessLauncher(conf, restart_method=restart_method)
    launcher.launch_service(service, workers=workers)

    return launcher
```

可以看到:
1. ServiceLauncher 和 ProcessLauncher 是平级的
2. ProcessLauncher 用于管理多进程服务
3. ServiceLauncher 用于管理单进程服务

我们再来看 ServiceLauncher 和 ProcessLauncher 的初始化:

```python
class Launcher(object):
    """Launch one or more services and wait for them to complete."""

    def __init__(self, conf, restart_method='reload'):
        """Initialize the service launcher.

        :param restart_method: If 'reload', calls reload_config_files on
            SIGHUP. If 'mutate', calls mutate_config_files on SIGHUP. Other
            values produce a ValueError.
        :returns: None

        """
        self.conf = conf
        conf.register_opts(_options.service_opts)
        self.services = Services(restart_method=restart_method)
        self.backdoor_port = (
            eventlet_backdoor.initialize_if_enabled(self.conf))
        self.restart_method = restart_method

    def launch_service(self, service, workers=1):
        """Load and start the given service.

        :param service: The service you would like to start, must be an
                        instance of :class:`oslo_service.service.ServiceBase`
        :param workers: This param makes this method compatible with
                        ProcessLauncher.launch_service. It must be None, 1 or
                        omitted.
        :returns: None

        """
        if workers is not None and workers != 1:
            raise ValueError(_("Launcher asked to start multiple workers"))
        _check_service_base(service)
        service.backdoor_port = self.backdoor_port
        self.services.add(service)

class ServiceLauncher(Launcher):
    """Runs one or more service in a parent process."""
    def __init__(self, conf, restart_method='reload'):
        """Constructor.

        :param conf: an instance of ConfigOpts
        :param restart_method: passed to super
        """
        super(ServiceLauncher, self).__init__(
            conf, restart_method=restart_method)
        self.signal_handler = SignalHandler()

class ProcessLauncher(object):
    """Launch a service with a given number of workers."""

    def __init__(self, conf, wait_interval=0.01, restart_method='reload'):
        """Constructor.

        :param conf: an instance of ConfigOpts
        :param wait_interval: The interval to sleep for between checks
                              of child process exit.
        :param restart_method: If 'reload', calls reload_config_files on
            SIGHUP. If 'mutate', calls mutate_config_files on SIGHUP. Other
            values produce a ValueError.
        """
        self.conf = conf
        conf.register_opts(_options.service_opts)
        self.children = {}
        self.sigcaught = None
        self.running = True
        self.wait_interval = wait_interval
        self.launcher = None
        rfd, self.writepipe = os.pipe()
        self.readpipe = eventlet.greenio.GreenPipe(rfd, 'r')
        self.signal_handler = SignalHandler()
        self.handle_signal()
        self.restart_method = restart_method
        if restart_method not in _LAUNCHER_RESTART_METHODS:
            raise ValueError(_("Invalid restart_method: %s") % restart_method)
    
    def launch_service(self, service, workers=1):
        """Launch a service with a given number of workers.

       :param service: a service to launch, must be an instance of
              :class:`oslo_service.service.ServiceBase`
       :param workers: a number of processes in which a service
              will be running
        """
        _check_service_base(service)
        wrap = ServiceWrapper(service, workers)

        # Hide existing objects from the garbage collector, so that most
        # existing pages will remain in shared memory rather than being
        # duplicated between subprocesses in the GC mark-and-sweep. (Requires
        # Python 3.7 or later.)
        if hasattr(gc, 'freeze'):
            gc.freeze()

        LOG.info('Starting %d workers', wrap.workers)
        while self.running and len(wrap.children) < wrap.workers:
            self._start_child(wrap)
```

launch_service 用于向 Lancher 中添加一个应用实例(把继承自 ServiceBase 的类称为应用实例)。从上面的源码我们可以看到(其实还需要你大致看一下 它们的源码，看方法名即可):
1. ServiceLauncher:
    - 其继承自 Launcher，Launcher 将服务的管理(启、停、重载)委托给了 Services
    - ServiceLauncher 本身添加了信号处理的代码逻辑
3. ProcessLauncher 
    - 实现的功能就是 ServiceLauncher + Launcher，只不过是多进程的实现
    - 为了实现对应用实例的多进程管理，ProcessLauncher 使用了 ServiceWrapper 对应用实例做了一层包装，便于管理为应用实例启动的多个进程。
    - 对于应用实例的每个子进程，ProcessLauncher 内部则依旧使用的 Launcher 来对其管理

至此我们就搞清楚了，oslo_service.service 中这些对象的关系。下面我们来看看具体的源码，我们从 WSGIService 开始。

## 2. WSGIService
WSGIService 继承自 oslo_service.service.Service，下面是它们的源码。这里有一个注意的点是虽然这里有继承关系，但是  WSGIService 并没有调用父类的 `__init__` 初始化方法，而且 WSGIService 覆盖了所有的其他方法，所以这里似乎继承自 ServiceBase 更加合适。

```python
from oslo_service import threadgroup


class Service(ServiceBase):
    def __init__(self, threads=1000):
        # 1. 启动了一个 greenthreads 协程池做并发管理
        self.tg = threadgroup.ThreadGroup(threads)

    def reset(self):
        """Reset a service in case it received a SIGHUP."""

    def start(self):
        """Start a service."""

    def stop(self, graceful=False):
        """Stop a service.

        :param graceful: indicates whether to wait for all threads to finish
               or terminate them instantly
        """
        self.tg.stop(graceful)

    def wait(self):
        """Wait for a service to shut down."""
        self.tg.wait()

from nova import wsgi


SERVICE_MANAGERS = {
    'nova-compute': 'nova.compute.manager.ComputeManager',
    'nova-conductor': 'nova.conductor.manager.ConductorManager',
    'nova-scheduler': 'nova.scheduler.manager.SchedulerManager',
}

class WSGIService(service.Service):
    """Provides ability to launch API from a 'paste' configuration."""

    def __init__(self, name, loader=None, use_ssl=False, max_url_len=None):
        """Initialize, but do not start the WSGI server.

        :param name: The name of the WSGI server given to the loader.
        :param loader: Loads the WSGI application using the given name.
        :returns: None

        """
        self.name = name # 1. paste.deploy 配置文件中的 Application 名称
        self.binary = 'nova-%s' % name # 服务名称

        LOG.warning('Running %s using eventlet is deprecated. Deploy with '
                    'a WSGI server such as uwsgi or mod_wsgi.', self.binary)

        self.topic = None 
        # 与 nova api 的下游服务有关，api 服务内没有用
        self.manager = self._get_manager() 
        self.loader = loader or api_wsgi.Loader() # 2. Application 的加载器类
        self.app = self.loader.load_app(name)
        # inherit all compute_api worker counts from osapi_compute
        if name.startswith('openstack_compute_api'):
            wname = 'osapi_compute'
        else:
            wname = name
        # 3. 获取 API 监听的地址、端口以及进程数
        self.host = getattr(CONF, '%s_listen' % name, "0.0.0.0")
        # 端口为 0 表示使用随机端口
        self.port = getattr(CONF, '%s_listen_port' % name, 0)
        self.workers = (getattr(CONF, '%s_workers' % wname, None) or
                        processutils.get_worker_count())
        if self.workers and self.workers < 1:
            worker_name = '%s_workers' % name
            msg = (_("%(worker_name)s value of %(workers)s is invalid, "
                     "must be greater than 0") %
                   {'worker_name': worker_name,
                    'workers': str(self.workers)})
            raise exception.InvalidInput(msg)
        self.use_ssl = use_ssl
        # 4. nova.wsgi.Server 才是真正启动的 API Server
        self.server = wsgi.Server(name,
                                  self.app,
                                  host=self.host,
                                  port=self.port,
                                  use_ssl=self.use_ssl,
                                  max_url_len=max_url_len)
        # Pull back actual port used
        self.port = self.server.port
        self.backdoor_port = None
        # 5. 性能调试有关，后面我们详细再说
        setup_profiler(name, self.host)

    def reset(self):
        """服务重置，重置以下内容:

        * server greenpool size to default
        * service version cache
        * cell cache holding database transaction context managers
        存储数据库事务上下文管理器的单元缓存
        """
        self.server.reset()
        service_obj.Service.clear_min_version_cache()
        context.CELL_CACHE = {}

    def _get_manager(self):
        """
        初始化与此服务相关的 Manager 对象，Manager 对象是真正的功能实现类
        """
        manager = SERVICE_MANAGERS.get(self.binary)
        if manager is None:
            return None

        manager_class = importutils.import_class(manager)
        return manager_class()

    def start(self):
        """
        服务启动，0 号端口对应为随机端口

        
        """
        # 清除保存数据库事务上下文管理器对象的单元格缓存。
        # 我们这样做是为了确保我们创建了新的内部oslo.db锁，以避免子进程在被分叉时收到一个已经被锁定的oslo.db锁的情况。
        # 当一个子进程继承了一个锁定的oslo.db锁时，通过事务上下文管理器访问数据库将永远无法获得锁，请求将会失败，并出现CellTimeout错误。
        # 更多信息请参见https://bugs.python.org/issue6721。
        # 在python 3.7中，oslo.db可以使用os.register_at_fork()方法重新初始化它的锁。
        # 在我们需要python 3.7作为最小版本之前，我们必须在oslo.db之外处理这种情况。
        context.CELL_CACHE = {}

        ctxt = context.get_admin_context()
        # 1. 将启动的服务更新到数据库中，便于其他服务发现启动的 API 服务
        service_ref = objects.Service.get_by_host_and_binary(ctxt, self.host,
                                                             self.binary)
        if service_ref:
            _update_service_ref(service_ref)
        else:
            try:
                service_ref = _create_service_ref(self, ctxt)
            except (exception.ServiceTopicExists,
                    exception.ServiceBinaryExists):
                # NOTE(danms): If we race to create a record wth a sibling,
                # don't fail here.
                service_ref = objects.Service.get_by_host_and_binary(
                    ctxt, self.host, self.binary)

        if self.manager:
            self.manager.init_host()
            self.manager.pre_start_hook()
            if self.backdoor_port is not None:
                self.manager.backdoor_port = self.backdoor_port
        # 2. 真正启动服务
        self.server.start()
        if self.manager:
            self.manager.post_start_hook()

    def stop(self):
        """Stop serving this API.

        :returns: None

        """
        self.server.stop()

    def wait(self):
        """Wait for the service to stop serving this API.

        :returns: None

        """
        self.server.wait()

```

从源码可以看到 WSGIService 将 API 服务的管理委托了同样继承自 oslo.service.ServiceBase 的 nova.wsgi.Server。

```python
import os.path
import socket
import ssl

import eventlet
import eventlet.wsgi
import greenlet
from oslo_log import log as logging
from oslo_service import service
from oslo_utils import excutils

import nova.conf
from nova import exception
from nova.i18n import _
from nova import utils

CONF = nova.conf.CONF

LOG = logging.getLogger(__name__)


class Server(service.ServiceBase):
    """Server class to manage a WSGI server, serving a WSGI application."""

    default_pool_size = CONF.wsgi.default_pool_size

    def __init__(self, name, app, host='0.0.0.0', port=0, pool_size=None,
                       protocol=eventlet.wsgi.HttpProtocol, backlog=128,
                       use_ssl=False, max_url_len=None):
        """Initialize, but do not start, a WSGI server.

        :param name: Pretty name for logging.
        :param app: The WSGI application to serve.
        :param host: IP address to serve the application.
        :param port: Port number to server the application.
        :param pool_size: Maximum number of eventlets to spawn concurrently.
        :param backlog: Maximum number of queued connections.
        :param max_url_len: Maximum length of permitted URLs.
        :returns: None
        :raises: nova.exception.InvalidInput
        """
        # Allow operators to customize http requests max header line size.
        eventlet.wsgi.MAX_HEADER_LINE = CONF.wsgi.max_header_line
        self.name = name
        self.app = app
        self._server = None
        self._protocol = protocol
        self.pool_size = pool_size or self.default_pool_size
        # 1. 
        self._pool = eventlet.GreenPool(self.pool_size)
        self._logger = logging.getLogger("nova.%s.wsgi.server" % self.name)
        self._use_ssl = use_ssl
        self._max_url_len = max_url_len
        self.client_socket_timeout = CONF.wsgi.client_socket_timeout or None

        if backlog < 1:
            raise exception.InvalidInput(
                    reason=_('The backlog must be more than 0'))

        bind_addr = (host, port)
        # TODO(dims): eventlet's green dns/socket module does not actually
        # support IPv6 in getaddrinfo(). We need to get around this in the
        # future or monitor upstream for a fix
        try:
            info = socket.getaddrinfo(bind_addr[0],
                                      bind_addr[1],
                                      socket.AF_UNSPEC,
                                      socket.SOCK_STREAM)[0]
            family = info[0]
            bind_addr = info[-1]
        except Exception:
            family = socket.AF_INET

        try:
            self._socket = eventlet.listen(bind_addr, family, backlog=backlog)
        except EnvironmentError:
            LOG.error("Could not bind to %(host)s:%(port)s",
                      {'host': host, 'port': port})
            raise

        (self.host, self.port) = self._socket.getsockname()[0:2]
        LOG.info("%(name)s listening on %(host)s:%(port)s",
                 {'name': self.name, 'host': self.host, 'port': self.port})

    def start(self):
        """Start serving a WSGI application.

        :returns: None
        """
        # The server socket object will be closed after server exits,
        # but the underlying file descriptor will remain open, and will
        # give bad file descriptor error. So duplicating the socket object,
        # to keep file descriptor usable.

        dup_socket = self._socket.dup()
        dup_socket.setsockopt(socket.SOL_SOCKET,
                              socket.SO_REUSEADDR, 1)
        # sockets can hang around forever without keepalive
        dup_socket.setsockopt(socket.SOL_SOCKET,
                              socket.SO_KEEPALIVE, 1)

        # This option isn't available in the OS X version of eventlet
        if hasattr(socket, 'TCP_KEEPIDLE'):
            dup_socket.setsockopt(socket.IPPROTO_TCP,
                                  socket.TCP_KEEPIDLE,
                                  CONF.wsgi.tcp_keepidle)

        if self._use_ssl:
            try:
                ca_file = CONF.wsgi.ssl_ca_file
                cert_file = CONF.wsgi.ssl_cert_file
                key_file = CONF.wsgi.ssl_key_file

                if cert_file and not os.path.exists(cert_file):
                    raise RuntimeError(
                          _("Unable to find cert_file : %s") % cert_file)

                if ca_file and not os.path.exists(ca_file):
                    raise RuntimeError(
                          _("Unable to find ca_file : %s") % ca_file)

                if key_file and not os.path.exists(key_file):
                    raise RuntimeError(
                          _("Unable to find key_file : %s") % key_file)

                if self._use_ssl and (not cert_file or not key_file):
                    raise RuntimeError(
                          _("When running server in SSL mode, you must "
                            "specify both a cert_file and key_file "
                            "option value in your configuration file"))
                ssl_kwargs = {
                    'server_side': True,
                    'certfile': cert_file,
                    'keyfile': key_file,
                    'cert_reqs': ssl.CERT_NONE,
                }

                if CONF.wsgi.ssl_ca_file:
                    ssl_kwargs['ca_certs'] = ca_file
                    ssl_kwargs['cert_reqs'] = ssl.CERT_REQUIRED

                dup_socket = eventlet.wrap_ssl(dup_socket,
                                               **ssl_kwargs)
            except Exception:
                with excutils.save_and_reraise_exception():
                    LOG.error(
                        "Failed to start %(name)s on %(host)s:%(port)s with "
                        "SSL support",
                        {'name': self.name, 'host': self.host,
                         'port': self.port})

        wsgi_kwargs = {
            'func': eventlet.wsgi.server,
            'sock': dup_socket,
            'site': self.app,
            'protocol': self._protocol,
            'custom_pool': self._pool,
            'log': self._logger,
            'log_format': CONF.wsgi.wsgi_log_format,
            'debug': False,
            'keepalive': CONF.wsgi.keep_alive,
            'socket_timeout': self.client_socket_timeout
            }

        if self._max_url_len:
            wsgi_kwargs['url_length_limit'] = self._max_url_len

        self._server = utils.spawn(**wsgi_kwargs)

    def reset(self):
        """Reset server greenpool size to default.

        :returns: None

        """
        self._pool.resize(self.pool_size)

    def stop(self):
        """Stop this server.

        This is not a very nice action, as currently the method by which a
        server is stopped is by killing its eventlet.

        :returns: None

        """
        LOG.info("Stopping WSGI server.")

        if self._server is not None:
            # Resize pool to stop new requests from being processed
            self._pool.resize(0)
            self._server.kill()

    def wait(self):
        """Block, until the server has stopped.

        Waits on the server's eventlet to finish, then returns.

        :returns: None

        """
        try:
            if self._server is not None:
                self._pool.waitall()
                self._server.wait()
        except greenlet.GreenletExit:
            LOG.info("WSGI server has stopped.")
```

nova.wsgi.Server 核心是 socket 编程和 evenlet 提供的 web server(这个 web server 提供了类似 nginx web 服务器相同的功能)。这里面的代码依旧值的我们深究，限于篇幅，我们会在后面展开介绍 nova.wsgi.Server 中的内容。

到这里 Nova API 服务的并发管理我们就讲完了。
