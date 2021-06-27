---
title: 12. Openstack的代码质量体系
date: 2021-03-13
categories:
    - 运维
tags:
	- Openstack
---

Openstack的代码质量体系
<!-- more -->

## 1. Openstack的代码质量体系
对于一个蓬勃发展、前景无限可期的开源项目来说，肯定有一套行之有效的体系与工具来保证。站在软件工程的高度，通常来说，代码质量保证步骤如图12-1所示。

![12-1 代码质量体系](/images/openstack/code_quality.png)

1. 统一编码规范: 可读性与可维护性的前提就是具有统一的编码规
2. 代码静态检查: 利用静态分析工具对代码进行特性分析，以便检查程序逻辑的各种缺陷和可疑的程序构造，如不符合编码规范、潜在的死循环等编译器发现不了的错误。
3. 单元测试
4.  持续集成（CI，Continuous Integration）: 利用一系列的工具、方法和规则，通过自动化的构建（包括编译、发布、自动化测试等）尽快发现问题和错误
5. 代码评审与重构: 人工的代码评审

接下来我们就简单看看 Openstack 中的这套代码质量体系是如何运行的。

### 1.1 统一代码规范
对于与OpenStack息息相关的Python代码静态检查来说，目前的工具主要有Pylint、Pep8、Pyflakes、Flake8等:
1. Pylint违背了Python开发者Happy Coding的倡导，未被OpenStack社区所采纳
2. Pep8备受Python社区推崇，负责Python代码风格的检查，
3. Pyflakes可以检查Python代码的逻辑错误

Flake8是Pyflakes、Pep8及Ned Batchelder's McCabe script（关注Python代码复杂度的静态分析）三个工具的集大成者，综合封装了三者的功能，在简化操作的同时，还提供了扩展开发接口。

OpenStack使用的代码静态检查工具是Flake8，并实现了一组扩展的Flake8插件来满足OpenStack的特殊需要，这组插件单独作为一个子项目而存在，就是Hacking。

### 1.2 代码评审
Android在Git的使用上有两个重要的创新：
1. 一个是为多版本库协同而引入的repo（对Git使用的封装）
2. 另一个就是**Gerrit**——代码审核服务器。

Gerrit为Git引入的代码审核是强制性的，也就是说除非特别授权设置，否则向Git版本库的推送（push）必须经过Gerrit服务器，并且修订必须经过一套代码审核的工作流程之后，才可能经过批准并纳入正式代码库中。

OpenStack也将Gerrit引入自己的代码管理里，工作流程大体和Android对Gerrit的使用相同，区别是过程更为简洁，而且使用了Jenkins来完成自动化测试，如图 12-2 所示:

![12-1 Gerrit 工作流](/images/openstack/gerrit_workflow.png)

整个工作流程大体是:
1. 首先我们在本地代码仓库中做出自己的修改
2. 然后我们就能很容易地通过git命令（或git-review封装）将自己的代码push到Gerrit管理下的Git版本库。
3. Jenkins将对我们提交的代码进行自动测试并给出反馈，其他开发者也能够使用Gerrit对我们的代码给出他们的注释与反馈
4. 如果你的patch能够得到两个“+2”，那么恭喜你，你的patch将被merge到OpenStack的源码树里。

所有这些注释、质疑、反馈、变更等代码评审的工作都通过Web界面来完成，因此Web服务器是[Gerrit](https://review.opendev.org/)的重要组件，Gerrit通过Web服务器来实现对整个评审工作流的控制。

#### Gerrit 实现原理
Gerrit 基于SSH协议实现了一套自己的Git服务器，这样就可以基于自己的需求对Git数据传递进行更为精确的控制。

Gerrit的Git服务器，只允许用户向特殊的引用 `refs/for/<branch-name>`下执行推送（push），其中`<branch-name>`即为开发者的工作分支。Gerrit会为新的提交分配一个`task-id`，并为该task-id的访问建立引用`refs/changes/nn/<task-id>/m`，比如图2-10中的refs/changes/37/367737/2，其中：
- task-id为Gerrit按顺序分配给该评审任务的全局唯一的号码。
- nn为task-id的后两位数，位数不足的用零补齐，即nn为task-id除以100的余数。
- m为修订号，该task-id的首次提交修订号为1，如果该修订被拒绝，则需要更新代码后重新提交，修订号会依次增大。

为了保证在代码修改后重新提交时，不会产生新的重复的评审任务，Gerrit要求每个提交包含唯一的Change-Id，Gerrit一旦发现新的提交包含了已经处理过的Change-Id，就不再为该修订创建新的评审任务和task-id，而是仅仅把它作为已有task-id进行修订。对于开发者来说，为了实现针对同一份代码的前后修订中包含唯一的、相同的Change-Id，需要在执行提交命令时使用`--amend`选项，以避免Gerrit创建新的评审任务。

#### Gerrit 账号创建
如果你想参与 Openstack 开发，就必须有一个 Gerrit 账号，这个账号使用的是Launchpad账号。

也就是说，我们需要访问Launchpad的登录页面，使用自己的电子邮件地址注册Launchpad账号，并为自己选择一个Launchpad ID，之后登录自己的Launchpad主页。在使用Launchpad账号登录之后，我们还需要上传自己的SSH公钥（SSH public key），公钥设置的页面有相应的HowTo告诉我们如何生成公钥并上传。

#### git review
git-review 封装了与Gerrit交互的所有细节，我们需要做的只是开心地执行commit与review这两个git子命令，然后在Web图形界面上进行“看图说话”。为了对一个项目使用git-review，我们需要先对该项目进行设置:

```bash
cd nova
git review
```

git-review会检查我们是否能够登录Gerrit，如果不能，它会向我们索要Gerrit账号。如果我们看到“We don't know where your gerrit is.”这样的错误，就需要执行下面的命令：

```bash
git remote add gerrit ssh://<username>@review.opendev.org:29418/openstack/nova.git
```

然后我们经常做的事情，除修改代码之外，就是按照一个“熟练工”的标准执行下面的命令：

```bash
git checkout -b branch_fix
git commit -s (--amend)
git review
```

### 1.3 单元测试
Openstack单元测试的代码位于每个项目源码树的`<project>/tests/`目录中，遵循oslo.test库提供的基础框架。有关单元测试的源码分析我们下一节就来说。

执行单元测试的途径有两种：一种是Tox；另一种是项目源码树根目录下的run_tests.sh脚本。通常我们使用的是Tox。Tox是一个标准的virtualenv（Virtual Python Environment Builder）管理器和命令行测试工具；可以用于：检查软件包能否在不同的Python版本或解释器下正常安装；在不同的环境中运行测试代码；每个项目源码树的根目录下都有一个Tox配置文件tox.ini，比如 nova 的 tox.ini 片段如下:

```ini
[tox]
minversion = 3.1.1
envlist = py38,functional,pep8
# Automatic envs (pyXX) will only use the python version appropriate to that
# env and ignore basepython inherited from [testenv] if we set
# ignore_basepython_conflict.
ignore_basepython_conflict = True

[testenv]
basepython = python3
usedevelop = True
whitelist_externals =
  bash
  find
  rm
  env
  make
setenv =
  VIRTUAL_ENV={envdir}
  LANGUAGE=en_US
  LC_ALL=en_US.utf-8
  OS_STDOUT_CAPTURE=1
  OS_STDERR_CAPTURE=1
  OS_TEST_TIMEOUT=160
  PYTHONDONTWRITEBYTECODE=1
```

对于开发而言，通常只需要运行下面的tox命令：

```bash
tox -e pep8
# 执行所有的单元测试
tox -e py36 -vv

# 只执行特定的单元测试
# test_api 就是 test 目录下单元测试文件的文件名
tox -e py36 --test_api
```

有关 tox 工具的使用，我们会在后面 openstack 使用的工具集中详细介绍。

### 1.4 持续集成 Jenkins
通俗来说，持续集成（CI）需要对每次代码提交都进行一次从代码集成到打包发布的完整流程，以判断提交的代码对整个流程带来的影响程度。OpenStack使用Jenkins搭建自己的持续集成服务器。

### 1.5 集成测试
OpenStack的集成测试则使用Tempest作为框架，Tempest是OpenStack项目中一个独立的项目。在我们提交代码到Gerrit上后，Jenkins会执行包括集成测试在内的各项测试。

Openstack 这一套持续继承工具是非常复杂，后面有机会我们在对这套系统的搭建和使用做详细介绍。下一节我们就以 nova 中的单元测试为例，看看我们应该如何在 Openstack 中编写单元测试。
