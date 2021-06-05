---
title: 5. API 接口服务(二)
date: 2021-03-06
categories:
    - 运维
tags:
	- Openstack
---

今天我们来介绍 Nova API 服务的第二篇内容: API 服务的并发管理。

<!-- more -->

## 1. Nova API 服务启动
前面铺垫了这么长，终于可以进入源码解析了。从前面介绍的 Python 包管理工具 setuptools，我们知道 nova 所有的服务入口都定义在 nova/setup.cfg 的 console 配置段中:

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
1. service.process_launcher(): 返回一个 Lancher 对象，用于对服务进行并发管理，这个后面我们专门讲服务并发管理时在详述
2. nova.service.WSGIService: 包装了一个完整的 Web API 服务，包括加载、路由、中间件

这两个对象就与我们接下来要讲的并发服务管理有关。


