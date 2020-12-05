---
title: 4 React 组件通信
date: 2020-11-03
categories:
    - 前端
tags:
	- Vue
---
React 组件间通信
<!-- more -->

## 1. 父子组件通信
前面我们已经演示了如何由父组件向子组件传值: 通过组件属性，并通过 props 接收的方式。接下来我们来看看在 react 如何实现子向父传值。

```js
import React, { Component } from 'react'

class Comment extends Component{
    // 4. 子组件同样存在 this 指向问题，需要使用箭头函数定义
    handleClick = ()=>{
        console.log("子组件button")
        // 5. 调用传入的父组件的方法，向父组件传值
        this.props.add("子组件传递过来的值")
    }
    render(){
        return (
            // 3. 子组件中定义 onClick 事件
            <div>
                <p>计数: {this.props.state.count}</p>
                <button onClick={this.handleClick}>+1</button>
            </div>
        )
    }
}

export default class App extends Component {
    constructor(props){
        super(props)
        // 必须在初始化时声明 state 对象和相应属性，才能在后续的 setState 方法使用和更改
        this.state = {
            count: 0
        }
    }
    add(val){
        console.log(this)
        this.state.count += 1
        console.log(this.state.count) // 直接修改值是无法生效的
        // this.setState({
            // count: this.state.count + 1
        // })

    }
    render() {
        return (
            // 1. 父组件通过组件属性向子组件传递 add 函数
            // 2. 注意此处必须使用箭头函数，保证 add 函数内部的 this 指向
            <div>
                <Comment state={this.state} add={()=>this.add()}></Comment>
            </div>
        )
    }
}

```

react 子向父组件传值的要点是:
1. 父组件首先需要向子组件传入接收值的方法
2. 子组件中通过表单或其他方式更改值后，通过调用父组件传入的方法，向父组件传值
