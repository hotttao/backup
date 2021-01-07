---
title: 2 React 基础
date: 2020-11-02
categories:
    - 前端
tags:
	- React
---

React 使用入门
<!-- more -->

## 1. React 项目创建
### 1.1 create-react-app 安装

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

`create-react-app react_hello` 创建项目后，默认会安装如下三个包:
1. react: react 核心 api 库
2. react-dom: 将虚拟 DOM 渲染成真实 DOM
3. react-scripts: react 运行、打包、编译的脚本库



### 1.2 项目创建

```js
// src/index.js
import React from "react"
import ReactDOM from "react-dom"


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

// 这种在 JS 中包含标签的用法称为 JSX，ele 是一个对象
// JSX = JavaScript + XML 表示一个虚拟 DOM -- 一种语法糖
// JSX 可以在任意地方使用
// 类似 Vue 里面 {{}} 的插值语法，在 JSX中可以使用 {} 进行插值 
// 注意不能直接使用 {greatuser(user)}，因为 {} 插值语法只能在 JSX 中使用，{} 插值需要一个标签承接
const ele = <div>{greatUser(user)}</div>

console.log(ele)

// ReactDOM.render 渲染页面
ReactDOM.render(ele, document.querySelector("#root"))
```

## 2. JSX 
类似 `<div>{"react"}</div>` 的 JSX 对象在编译时，会被 babel-react 插件编译成 JS 的对象 React.DOM。所以无论 JS 是否使用了 react 模块，只要使用了 JSX 都要导入 React `import React from 'react'`

记住 JSX 就是一个对象，并且这个对象中可以使用 {} 插值语法。所以编写 React 就跟编写 JS 一样，不像 Vue 有其他额外的语法。

### 2.1 元素渲染
元素是构成React应⽤的最⼩砖块,⽐如: `const ele = <h1>hello,world</h1>`。与浏览器的 DOM 元素不同， React 元素是创建开销极⼩的普通对象。 React DOM 会负责更新 DOM 来与 React 元素保持⼀致。

React只需要更新它需要更新的部分，React DOM会将元素和它的⼦元素与它们之前的状态进⾏⽐较(diff 算法),并只会进⾏必要的更新来使DOM达到预期的状态。有关 diff 算法，我们在后面源码学习部分在详细介绍。

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

### 2.3 其他资源使用
在 react 中使用组件时，一切皆模块，诸如 css，图片都可以导入到 react 的 js 文件中并在直接使用，像下面这样:

```js
import React, { Component } from 'react'
import './App.css'            // 1. 导入 css 文件，应用样式
import Logo from './logo.svg' // 2. 导入图片，并使用变量接收

class MyButton extends Component {
    render() {
        return (
            <div>
                <button>{this.props.name}</button>
                <img src={Logo} alt=""/>
            </div>
        )
    }
}



export default class App extends React.Component{
    constructor(props){
        super(props)
        this.user = {
            name: '设置',
        }
    }
    render(){
        return (
            <div>
                // 解构传值，与直接设置属性值类似
                <MyButton {...this.user}></MyButton>
                <MyButton name="删除"></MyButton>
            </div>
        )
    }
}
```

## 3. 项目结构
每个框架的使用都有其最佳实践，目的是将将项目划分为特定的多个模块，使我们的开发更加高效。React 项目典型的组织方式如下:

```bash
my-react # 项目陆慕
    public # 静态文件
    src    # 源码目录
        store # redux 数据共享的目录
            index.js  # 创建 redux store
            cart.js   # 购物车共享的 redux Reducer 和映射的方法
            login.js  # 登录共享的 redux Reducer 和映射的方法
            .....
        pages # react-router 的路由组件
```