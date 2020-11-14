---
title: 8 Vue 响应式更新原理
date: 2020-10-08
categories:
    - 前端
tags:
	- Vue
---
Vue 响应式更新原理
<!-- more -->


## 1. 异步更新队列
this.$nextTick(()=>{

})


## 2. 对象属性变更检测
```js
this.$set(this.user, "age", 20)

this.user = Object.assign({}, this.user, {
    "age": 10,
    "pho": 1111111111
})
```