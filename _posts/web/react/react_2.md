---
title: 2 React 入门
date: 2020-11-02
categories:
    - 前端
tags:
	- Vue
---

React 使用入门
<!-- more -->

## 1. 安装

```bash
# 安装脚手架
cnpm i -g create-react-app

# 创建项目
create-react-app react_hello

# 启动项目
cd react_hello
yarn start

# 安装 ant-design
cnpm i antd -S
yarn add antd
```

### 1.1 项目创建

```js
// src/index.js
import React from "react"
import ReactDOM from "react-dom"

// 这种在 JS 中包含标签的用法称为 JSX，ele 是一个对象
// JSX = JavaScript + XML 表示一个虚拟 DOM -- 一种语法糖
// JSX 可以在任意地方使用，语法为 {}，类似 Vue 里面 {{}} 的插值语法
const user = {
    firstName: "小",
    lastName: "马哥"
}

function formatName(user){
    return user.firstName + user.lastName
}

function greatUser(user){
    if (user){
        // JSX 可以在任何地方使用
        return <h2>{formatName(user)}</h2>
    }
    return <h2>hello, react</h2>
}

const ele = <div>{greatUser(user)}</div>

console.log(ele)

ReactDOM.render(ele, document.querySelector("#root"))
```

## 2. React 的组成
### 2.1 元素渲染
元素是构成React应⽤的最⼩砖块,⽐如: `const ele = <h1>hello,world</h1>`。与浏览器的 DOM 元素不同， React 元素是创建开销极⼩的普通对象。 React DOM 会负责更新 DOM 来与 React 元素保持⼀致。

React只需要更新它需要更新的部分，React DOM会将元素和它的⼦元素与它们之前的状态进⾏⽐较,并只会进⾏必要的更新来使DOM达到预期的状态。

### 2.2 循环绑定元素

```js
let ul = (<ul>
    { 
        arr.map((item, index)=>{
            return (
                item.price < 1000 ? null : <li key={index}>{item}</li>;
            )
        }) 
    }
</ul>)
```

在React中,循环绑定元素都是使⽤ map ⽅法,不能使⽤ forEach 是因为 forEach没有返回值。过滤元素只要把不符合条件的元素,返回为 null 即可。