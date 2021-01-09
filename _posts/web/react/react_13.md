---
title: 13 UmiJS 
date: 2020-11-13
categories:
    - 前端
tags:
	- React
---
react 项目实战
<!-- more -->

## 1. umi简介
[umi](https://umijs.org/zh-CN/docs) 是阿里开源的一款 react 开发框架，集成了众多的 react 组件，与dva 一起用于开发大型项目。下面是 umi 的架构图:

![UmJS 架构图](/images/JavaScript/umijs.jpg)

### 1.1 UmiJS 安装

```bash
# 1. 使用 yarn 并更改为阿里源
npm install -g yarn
yarn config set registry https://registry.npm.taobao.org -g
yarn config set sass_binary_site http://cdn.npm.taobao.org/dist/node-sass -g

# 查询源
yarn config get registry

# 2. 安装 UmiJS
# 创建项目
mkdir myapp && cd myapp

# 通过官方工具创建项目
yarn create @umijs/umi-app

# 安装依赖
yarn

# 启动项目
yarn start

# 3. 部署发布
# 构建产物默认生成到 ./dist 下，然后通过 tree 命令查看，
yarn build
tree ./dist

# 本地验证
# 发布之前，可以通过 serve 做本地验证，
yarn global add serve
serve ./dist

# 4. 页面生成
umi generate <type> <name> [options]
# 生成一个最简洁的页面 home
umi g page home
```

### 1.2 umi 命令行工具
1. umi build: 编译构建 web 产物
2. umi dev: 启动本地开发服务器进行项目的开发调试
3. umi generate: 
    - 内置的生成器功能，内置的类型有 page ，用于生成最简页面。支持别名调用 umi g
    - `umi generate <type> <name> [options]`
    - `umi g page home`
4. umi plugin: 
    - 快速查看当前项目使用到的所有的 umi 插件
    - `umi plugin <type> [options]`，当前支持的 type 是 list，可选参数 key
    - `umi plugin list`
5. umi -v: 查看 umi 版本

### 1.2 项目结构
一个基础的 Umi 项目大致是这样的:

```bash
├── package.json
├── .umirc.ts
├── .env
├── dist
├── mock
├── public
└── src
    ├── .umi
    ├── layouts/index.tsx
    ├── pages
        ├── index.less
        └── index.tsx
    └── app.ts
```
