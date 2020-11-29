---
title: 3 React 组件
date: 2020-11-03
categories:
    - 前端
tags:
	- Vue
---
React 组件化开发
<!-- more -->

## 1. React 组件化开发
React 核心就是组件化开发，其核心就是使用 JavaScript，React创建组件有来两种⽅式
1. 函数声明
2. 类声明

### 1.1 函数式组件

```js
function Welcome(props){
    return <h2>hello,{props.name}</h2>
}

ReactDOM.render(<Welcome name="tsong"/>, document.queryBySelect("#root))
```

函数式组件有两个使用要点:
1. 函数声明的组件,必须返回⼀个JSX元素
2. 可以通过属性给组件传递值,函数通过props参数属接收

### 1.2 类声明组件

```js
// 通过 vscode 插件和 rcc 指令可以自动生成如下的模板代码
class App extends React.Component{
    constructor(props){
        super(props)
    }
    render(){
        return <h2>Hello, {this.props.name}</h2>
    }
}

ReactDOM.render(<App name="你好"/>, document.querySelector("#root"))
```

使用类声明的组件有如下几个使用要点:
1. 在React中有⼀个属性Component,是⼀个基类,使⽤类声明组件时,必须继承这个基类
2. 在类中,必须有render函数, render 函数中,需要return⼀个JSX元素
3. constructor 不是必须的，如果需要 constructor，必须接受 props 作为参数，并调用父类初始化方法传入 props
4. 组件名称必须以⼤写字⺟开头，React会将⼩写字⺟开头的组件称之为标签
5. 同函数组件一样可以通过属性给组件传递值，JSX 所接收的属性（attributes）转换为单个对象作为 props 参数传递给类的构造函数，并保存为类的 props 属性

### 1.3 两种方式对比
真实项⽬中,都只使⽤class定义组件。class定义的组件中有this,状态、⽣命周期；function声明都没有。

## 2. 组合组件
在 react 中使用组件时:
1. 诸如 css，图片都可以导入到 react 的 js 文件中
2. 

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

## 3. 组件状态
react 中每个组件都会维护自身的状态 state 即组件中维护的数据，要想修改组件中的数据，并让 react 重新渲染，我们必须使用 react 提供的特殊方法 this.setState。下面是使用示例:

```js
export default class App extends React.Component{
    constructor(props){
        super(props)
        // 3. state 是 react 组件类的一个特殊属性
        this.state = {
            count: 0
        }
    }
    add(e){
        console.log(e)
        // 1. 修改属性值必须通过 this.setState 方法
        this.setState({ 
            // 4. count 键对应的属性为 this.state.count，react 会合并并更新 this.state 的值
            // 5. this.state.count 的更新是一个异步操作
            count: this.state.count + 1
        })
        console.log(this.state.count); // 6. 因为异步更新，此时是拿不到新值的
    }
    render(){
        return (
            // 2. 修改 add 函数的 this 指向
            <div>
                <p>计数: {this.state.count}</p>
                <button onClick={(e)=>this.add(e)}>+1</button>
            </div>
        )
    }
}
```

在上面的示例中有如下几点需要注意:
1. 在修改 react 组件时，必须使用 this.setState
2. button onClick 事件触发的函数 this 指向的是标签元素，为了在 add 中访问到 react 的属性值，我们必须修改 add 函数的 this 指向。推荐使用示例中添加额外箭头函数的方式，这样可以保留事件触发时的 event 对象
3. 在 this.setState 中更新属性值的操作是一个异步操作

### 3.1 setState 
react 组件 this.setState 方法中组件状态的更新是一个异步操作，如果我们想使用组件状态中最新的值，必须使用另一种 this.setState 的使用方式(函数式使用方式):
1. 第一个参数，接收当前 this.state 和 this.props 作为参数，执行修改组件状态的方法
2. 第二个参数，是一个回调函数，在函数内部就可以获取组件状态的最新值

```js
export default class App extends React.Component{
    constructor(props){
        super(props)
        this.state = {
            count: 0
        }
    }
    add(e){
        console.log(e)
        this.setState((state, props)=>({
            count: state.count + 1
        }),()=>{
            console.log(this.state.count)
        })
    }
```