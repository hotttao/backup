---
title: 16 redux-saga 异步管理
date: 2020-11-16
categories:
    - 前端
tags:
	- Vue
---
redux-saga
<!-- more -->

## 1. redux-saga
redux-saga 是⼀个⽤于管理应⽤程序 Side Effect（副作⽤，例如异步获取数据，访问浏览器缓存等）的 library，redux-saga 使⽤了 ES6 的 Generator 功能，让异步的流程更易于读取，写⼊和测试。通过这样的⽅式，这些异步的流程看起来就像是标准同步的Javascript 代码。
不同于 redux thunk，你不会再遇到回调地狱了，你可以很容易地测试异步流程并保持你的 action 是⼲净的。

```bash
npm i redux-saga -S
```