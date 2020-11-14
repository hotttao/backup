---
title: 10 Vue 单文件组件
date: 2020-10-10
categories:
    - 前端
tags:
	- Vue
---
Vue 单文件组件
<!-- more -->

## 1. 单文件组件概述
所谓单文件组件就是将组件放置在一个单独的文件中，可以为这个组件单独定义模板，js 和 CSS。最后通过脚手架将所有单文件组件合并成一个前端应用。下是一个文件名为 Hello.vue 的简单实例：


## 2. 脚手架 vue-client3 安装

- [安装Nodejs](https://nodejs.org/en/download/)
  - 保证Node.js8.9或更高版本
  - 终端中输入`node -v`,保证已安装成功
- 安装[淘宝镜像源](http://npm.taobao.org/)
  - `npm install -g cnpm --registry=https://registry.npm.taobao.org`
  - 以后的npm可以用cnpm代替
- 安装Vue Cli3脚手架
  - `cnpm install -g @vue/cli`
- 检查其版本是否正确
  - `vue --version`

## 3. 快速原型开发
使用 `vue serve` 和 `vue build` 命令对单个 `*.vue` 文件进行快速原型开发，不过这需要先额外安装一个全局的扩展：

```
cnpm install -g @vue/cli-service-global
```

`vue serve` 的缺点就是它需要安装全局依赖，这使得它在不同机器上的一致性不能得到保证。因此这只适用于快速原型开发。

需要的仅仅是一个 `App.vue` 文件：

```vue
<template>
    <div>
        <h2>hello world 单页面组件</h2>
    </div>
</template>
<script>
export default {
    
}
</script>
<style>
    
</style>
```

然后在这个 `App.vue` 文件所在的目录下运行：

```
vue serve
```
### 3.1 快速原型开发的步骤

```bash
# 1. 初始化项目
npm init

# 2. 创建单文件组件
touch App.vue

# 3. 运行 
vue serve
```