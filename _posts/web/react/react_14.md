---
title: 14 Dva 
date: 2020-11-14
categories:
    - 前端
tags:
	- React
---
react 项目实战
<!-- more -->

## 1. Dva 简介
[Dva](https://dvajs.com/guide/concepts.html#%E6%95%B0%E6%8D%AE%E6%B5%81%E5%90%91) 是一个基于 redux 和 redux-saga 的数据流方案，然后为了简化开发体验，dva 还额外内置了 react-router 和 fetch，所以也可以理解为一个轻量级的应用框架。Dva 仅有 6 个 api，对 redux 用户尤其友好，配合 umi 使用后更是降低为 0 API。

### 1.1 Dva 中的数据流

![Dva 中的数据流](/images/JavaScript/dva_flow.png)

数据的改变发生通常是通过用户交互行为或者浏览器行为（如路由跳转等）触发的，当此类行为会改变数据的时候可以通过 dispatch 发起一个 action，如果是同步行为会直接通过 Reducers 改变 State ，如果是异步行为（副作用）会先触发 Effects 然后流向 Reducers 最终改变 State，所以在 dva 中，数据流向非常清晰简明。

如上述的数据流所示，使用 Dva 我们需要如下步骤:
1. 创建 store 即 state 数据共享的中心
2. 创建 model 一个 model 就是一个独立的共享数据模块，其中 Reducer 用于处理同步更新操作，Effect 用于处理异步操作
3. connect 向组件注入 model 

### 1.2 Dva 安装

```bash
# 安装 dva 客户端工具
cnpm install dva-cli -g

# 安装 dva
cnpm install dva —save
```

## 2. react 中使用 dva
在 react 引入 dva 需要以 dva 的方式来构建项目，总的来说需要以下几步:

## 3. UmiJS 中使用 dva
UmiJS 已经自动集成了 dva 使用起来非常方便，只需要定义 model 直接 connect 注入即可使用。
