---
title: 2 OpenResty 简介
date: 2021-02-02
categories:
    - Go
tags:
	- OpenResty
---

OpenResty 使用入门

<!-- more -->

## 1. OpenResty 简介
OpenResty 是章亦春，基于NGINX 和 LuaJIT 开发的 Web 服务器，由 Lua 脚本提供控制逻辑。由于 OpenResty 的作者章亦春的技术偏向，在 OpenResty 官方的项目中，Perl 占据着重要的角色，OpenResty 工程化方面都是用 Perl 来构建，比如测试框架、Linter、CLI 等。

虽然 OpenResty 基于 NGINX 实现，但其适用范围，早已远远超出反向代理和负载均衡。它的核心是基于 NGINX 的一个 C 模块（lua-nginx-module），该模块将 LuaJIT 嵌入到 NGINX 服务器中，并对外提供一套完整的 Lua API，透明地支持非阻塞 I/O，提供了轻量级线程、定时器等高级抽象。同时，围绕这个模块，OpenResty 构建了一套完备的测试框架、调试技术以及由 Lua 实现的周边功能库。

随着章亦春离开了淘宝，加入了美国的 CDN 公司 Cloudflare，OpenResty 就成为 CDN 的技术标准  通过丰富的 lua-resty 库，OpenResty 开始逐渐摆脱 NGINX 的影子，形成自己的生态体系，在 API 网关、软 WAF 等领域被广泛使用。

OpenResty 有三大特性:
1. 详尽的文档和测试用例: 
    - OpenResty 的文档非常详细,还自带了一个命令行工具restydoc，专门用来帮助你通过 shell 查看文档
    - /t目录，里面包含了所有的测试案例。每一个测试案例都包含完整的 NGINX 配置和 Lua 代码，以及测试的输入数据和预期的输出数据
2. 同步非阻塞: 更加完善的基于协程的编程模式
3. 动态性

### 1.1 同步非阻塞
协程，是很多脚本语言为了提升性能，在近几年新增的特性。但它们实现得并不完美，有些是语法糖，有些还需要显式的关键字声明。OpenResty 则没有历史包袱，在诞生之初就支持了协程，并基于此实现了同步非阻塞的编程模式。这一点相对于 Python 或其编程语言来说，实现的更为彻底。基于协程编写的代码与同步完全一样(注: 个人觉得这与 OpenResty 作为Web 服务器的特定使用场景有关，而变成语言要处理的场景则增加丰富，需要提供显示控制)。

### 1.2 动态性
传统的 Web 服务器，比如 NGINX，如果发生任何的变动，都需要你去修改磁盘上的配置文件，然后重新加载才能生效，这也是因为它们并没有提供 API，来控制运行时的行为。所以，在需要频繁变动的微服务领域，NGINX 虽然有多次尝试，但毫无建树。

而异军突起的 Envoy， 正是凭着 xDS 这种动态控制的 API，大有对 NGINX 造成降维攻击的威胁。

和 NGINX 、 Envoy 不同的是，OpenResty 是由脚本语言 Lua 来控制逻辑的，而动态，便是 Lua 天生的优势。通过 OpenResty 中 lua-nginx-module 模块中提供的 Lua API，我们可以动态地控制路由、上游、SSL 证书、请求、响应等。甚至更进一步，你可以在不重启 OpenResty 的前提下，修改业务的处理逻辑，并不局限于 OpenResty 提供的 Lua API。

Envoy 与 OpenResty 有明显的竞争关系，从目前来看 Envoy 的发展势头要比 OpenResty 迅猛的多。

## 2. Hello World

### 2.1 resty 的基础使用
resty 是 OpenResty 提供的命令行工具，功能强大。想了解完整的列表，你可以查看resty -h或者[官方文档](https://github.com/openresty/resty-cli)，下面是其使用的一些示例:


```bash
# 1. hello world
$ resty -e "ngx.say('hello world')"
hello world

$ resty -e "ngx.say('hello world'); ngx.sleep(10)" &

# 2. 这个示例结合了 NGINX 配置和 Lua 代码，使用了一个共享内存
# dogs 1m 是 NGINX 的一段配置，声明了一个共享内存空间，名字是 dogs，大小是 1m
$ resty --shdict='dogs 1m' 
        -e 'local dict = ngx.shared.dogs
            dict:set("Tom", 56)
            print(dict:get("Tom"))'
56

# 3. 上面示例的等价写法
resty --http-conf 'lua_shared_dict dogs 1m;' 
    -e 'local dict = ngx.shared.dogs
        dict:set("Tom", 56)
        print(dict:get("Tom"))'
```

OpenResty 世界中常用的调试工具，比如gdb、valgrind、sysetmtap和Mozilla rr ，也可以和 resty 一起配合使用，它们分别对应着 resty 不同的指令，内部的实现其实很简单，就是多套了一层命令行调用。我们以 valgrind 为例：

```bash
$ resty --valgrind  -e "ngx.say('hello world'); "
```

### 2.2 启动 OpenResty 
将 OpenResty 作为服务启动，需要三个步骤:
1. 创建工作目录；
2. 修改 NGINX 的配置文件，把 Lua 代码嵌入其中；
3. 启动 OpenResty 服务

```bash
# 1. 创建工作目录
mkdir test
cd test
mkdir logs/ conf/

# 2. 修改 nginx.conf
$ cat > conf/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    server {
        listen 8080;
        location / {
            content_by_lua '
                ngx.say("hello, world")
            ';
        }
    }
}
EOF

# 3. 启动服务(注: nginx 就是 openresty)
nginx -p `pwd` -c conf/nginx.conf
```

### 2.3 lua 代码分离
上面的示例将 lua 脚本内嵌在 nginx 的配置文件中，对于大型应用代码的可读性和可维护性就无法保证了。那么如何把 lua 代码从 nignx.conf 独立出来呢？我们需要把 content_by_lua 改为 content_by_lua_file:

```bash
# 1. 创建 lua 目录，来保存 lua 脚本
cd test
mkdir lua
cd lua
cat > hello.lua << EOF
ngx.say('hello world')
EOF

# 2. 修改配置文件
$ cat > conf/nginx.conf << EOF
pid logs/nginx.pid;
events {
  worker_connections 1024;
}

http {
  server {
    listen 8080;
    location / {
      content_by_lua_file lua/hello.lua;
      }
    }
  }
EOF

# 3. 重启服务
$ sudo kill -HUP `cat logs/nginx.pid`
```

在上面的示例中有两个问题值得关注:
1. `lua/hello.lua` 的搜索路径:
    - 如果给出的是相对路径，那么 OpenResty 在启动时，会把 OpenResty 启动的命令行参数中的 -p PATH 作为前缀，将相对路径拼接为绝对路径
    - OpenResty 提供了 `lua_package_path` 指令，可以设置 Lua 模块的查找路径。针对上面的例子，我们可以把 `lua_package_path` 设置为 `$prefix/lua/?.lua;;`
        - `$prefix`就是启动参数中的 `-p PATH`；
        - `/lua/?.lua`表示 lua 目录下所有以 .lua 作为后缀的文件；
        - 最后的两个分号，则代表内置的代码搜索路径
2. lua 的变更生效:
    - Lua 代码在第一个请求时会被加载，并默认缓存起来。所以在你每次修改 Lua 源文件后，都必须重新加载 OpenResty 才会生效
    - 在 nginx.conf 中关闭 `lua_code_cache` 就能避免重新加载，但这种方法只能临时用于开发和测试，因为非常影响性能

## 3. OpenResty 安装后的目录结构
OpenResty 安装完成之后主要包含  bin、luajit、lualib、nginx、pod 这几个子目录。

### 3.1 bin

```bash
$ ll /usr/local/openresty/bin
total 320
-r-xr-xr-x  1 ming  admin    19K  3 27 12:54 md2pod.pl
-r-xr-xr-x  1 ming  admin    15K  3 27 12:54 nginx-xml2pod
lrwxr-xr-x  1 ming  admin    19B  3 27 12:54 openresty -> ../nginx/sbin/nginx
-r-xr-xr-x  1 ming  admin    62K  3 27 12:54 opm
-r-xr-xr-x  1 ming  admin    29K  3 27 12:54 resty
-r-xr-xr-x  1 ming  admin    15K  3 27 12:54 restydoc
-r-xr-xr-x  1 ming  admin   8.3K  3 27 12:54 restydoc-index
```

最重要的 bin 目录:
1. openresty，其实是 nginx 的一个软链接
2. 其他的一些工具和 resty 一样，都是 Perl 脚本
3. opm 是包管理工具，可以通过它来管理各类第三方包
4. restydoc 是 OpenResty 提供的文档查看工具，你可以通过它来查看 OpenResty 和 NGINX 的使用文档

```bash
$ restydoc -s ngx.say
$ restydoc -s proxy_pass
```

### 3.2 pod 目录
pod 是 Perl 里面的一种标记语言，用于给 Perl 的模块编写文档。pod 目录中存放的就是 OpenResty、 NGINX、lua-resty-*、LuaJIT 的文档， 这些就和刚才提到的 restydoc 联系在一起了。

### 3.3 nginx、luajit、lualib 
nginx 和 luajit 主要存放  NGINX 和 LuaJIT 的可执行文件和依赖。

lualib 目录存放的是 OpenResty 中使用到的 Lua 库，主要分为 ngx 和 resty 两个子目录:
1. ngx: 存放的是 [`lua-resty-core`](https://github.com/openresty/lua-resty-core/tree/master/lib/ngx) 这个官方项目中的 Lua 代码，里面都是基于 FFI 重新实现的 OpenResty API
2. resty: 存放的是各种 `lua-resty-*` 项目包含的 Lua 代码

## 4. OpenResty 项目概览
提到 OpenResty，你应该会想到 `lua-nginx-module`。没错，这个 NGINX 的 C 模块确实是 OpenResty 的核心，但它并不等价于 OpenResty。OpenResty 中除了 lua-nginx-module ，还有哪些其他的关联项目。

打开 OpenResty 在 GitHub 的[项目主页](https://github.com/openresty/)，你可以看到 OpenResty 包含了 68 个公开的项目，大概分为以下 7 类:
1. NGINX C 模块
2. lua-resty- 周边库
3. 自己维护的 LuaJIT 分支
4. 测试框架
5. 调试工具链
6. 打包相关
7. 工程化工具

### 4.1 NGINX C 模块
NGINX C 模块:
- 以 `*-nginx-module` 命名的就是 NGINX 的 C 模块
- OpenResty 中一共包含了 20 多个 C 模块
- `openresty -V` 显示的编译选项中`--add-module=`后面跟着的，就是 OpenResty 的 C 模块
- 最核心的就是 `lua-nginx-module` 和 `stream-lua-nginx-module`，前者用来处理七层流量，后者用来处理四层流量

这些 C 模块中，有些是需要特别注意的，虽然默认编译进入了 OpenResty，但并不推荐使用。 比如 redis2-nginx-module、redis-nginx-module 和 memc-nginx-module，它们是用来和 redis 以及 memcached 交互使用的。这些 C 库是 OpenResty 早期推荐使用的，但在 `cosocket` 功能加入之后，它们都已经被 `lua-resty-redis` 和 `lua-resty-memcached` 替代，处于疏于维护的状态。OpenResty 后面也不会开发更多的 NGINX C 库，而是专注在基于 cosocket 的 Lua 库上，后者才是未来。

### 4.2 lua-resty- 周边库
OpenResty 官方仓库中包含 18 个 lua-resty-* 库，涵盖 Redis、MySQL、memcached、websocket、dns、流量控制、字符串处理、进程内缓存等常用库。除了官方自带的之外，还有更多的第三方库。

### 4.3 自己维护的 LuaJIT 分支
OpenResty 除了维护自己的 OpenSSL patch 外，还维护了自己的 [LuaJIT 分支](https://github.com/openresty/luajit2)。相对于 Lua，LuaJIT 增加了不少独有的函数，这些函数非常重要，但知道的工程师并不多，算是半隐藏技能。

### 4.4 测试框架
OpenResty 的测试框架是[test-nginx](https://github.com/openresty/test-nginx)，由 perl 语言开发，专门用来测试 NIGNX 项目。OpenResty 官方的所有 C 模块和 lua-resty 库的测试案例，都是由 test-nginx 驱动的。

除了 test-nginx 之外，[mockeagain](https://github.com/openresty/mockeagain) 这个项目可以模拟慢速的网络，让程序每次只读写一个字节。对于 web 服务器来说，这是一个很有用的工具。

### 4.5 调试工具链
OpenResty 项目在如何科学和动态地调试代码上，花费了大量的精力，可以说是达到了极致。OpenResty 的作者章亦春专门写了[一篇文章](https://blog.openresty.com.cn/cn/dynamic-tracing/)，来介绍动态追踪技术。

[openresty-systemtap-toolkit](https://github.com/openresty/openresty-systemtap-toolkit) 和 [stapxx](https://github.com/openresty/stapxx) 这两个 OpenResty 的项目，都基于 systemtap 这个动态调试和追踪工具。使用 systemtap 最大的优势，便是实现活体分析，同时对目标程序完全无侵入。

### 4.6 打包相关
OpenResty 在不同发行操作系统版本中的打包脚本，都是手工编写的，包括：[openresty-packaging](https://github.com/openresty/openresty-packaging) 和 [home-brew](https://github.com/openresty/homebrew-brew)

### 4.7 工程化工具
OpenResty 还有一些负责工程化的工具，比如[openresty-devel-utils](https://github.com/openresty/openresty-devel-utils) 就是开发 OpenResty 和 NGINX 的工具集。它们也都使用 Perl 开发，并且对于 OpenResty 开发者是非常有用的。这些工具包括但不限于:
1. lj-releng 是一个简单有效的 LuaJIT 代码检测工具，类似 luacheck，可以找出全局变量等潜在的问题。
2. reindex 从名字来看是重建索引的意思，它其实是格式化 test-nginx 测试案例的工具，可以重新排列测试案例的编号，以及去除多余的空白符。reindex 可以说是 OpenResty 开发者每天都会用到的工具之一。
3. opsboy 也是一个深藏不露的项目，主要用于自动化部署。OpenResty 每次发布版本前，都会在 AWS EC2 集群上做完整的回归测试，详细的文档你可以参考[官方文档](https://openresty.org/en/ec2-test-cluster.html)，而这个回归测试正是由 opsboy 来部署和驱动的。opsboy 是一个用 Perl 实现的 **DSL（领域特定语言）**。