---
title: 6 Vue 工程化与 vue-cli3
date: 2020-10-06
categories:
    - 前端
tags:
	- Vue
---
Vue 工程化
<!-- more -->

## 1. 单文件组件概述
所谓单文件组件就是将组件放置在一个单独的文件中，可以为这个组件单独定义模板，js 和 CSS。最后通过脚手架和编译工具(比如webpack、babel)将所有单文件组件合并成一个前端应用。

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
- 官方文档: [vue-cl3](https://cli.vuejs.org/zh/guide/prototyping.html)

## 3. 快速原型开发
使用 `vue serve` 和 `vue build` 命令对单个 `*.vue` 文件进行快速原型开发，不过这需要先额外安装一个全局的扩展：

```bash
cnpm install -g @vue/cli-service-global
```

`vue serve` 的缺点就是它需要安装全局依赖，这使得它在不同机器上的一致性不能得到保证。因此这只适用于快速原型开发。

快速原型开发，我们需要的仅仅是一个 `App.vue` 文件：


### 3.1 快速原型开发的步骤

```bash
# 1. 初始化项目，生成 package.json 项目配置文件
npm init

# 2. 创建单文件组件，文件必须是 App.vue 或者 index.vue
touch App.vue

# 3. 运行 
vue serve
```

### 3.2 App.vue

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

// scoped 表示当前的样式只对当前的组件有效
<style scoped>
    
</style>
```

## 4. vue-cli 生成项目
使用 `vue create mysite` 可以帮助我们创建一个完整的 vue 项目。这是一个交互命令，会出现如下的预置选项:

![vue_cl3](/images/JavaScript/vue_cl3.png)

选择 `Manually select features` 选择项目所需的预置选项:


![cli-select-features](/images/JavaScript/cli-select-features.png)

其中，如下四个通常是我们需要的:
1. Babel
2. Router
3. Vuex
4. Linter/Formatter 


## 5. 购物车案例实战
### 5.1 项目初始化
```bash
# 1. 创建项目，提前安装好 vuex router
vue create 

# 2. 安装 element-ui 并配置按需导入
vue add element

# 3. 验证项目是否安装成功
npm run serve
```

### 5.2 购物车实现