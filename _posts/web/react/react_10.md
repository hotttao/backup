---
title: 10 组件通信 Context
date: 2020-11-09
categories:
    - 前端
tags:
	- Vue
---
组件通信 Context
<!-- more -->

## 1. Context
Context 提供了⼀个⽆需为每层组件⼿动添加 props，就能在组件树间进⾏数据传递的⽅法。⽬的是为了共享那些 全局 的数据，例如当前认证的⽤户、主题等。Context 提供了 provider/comsumer 有点类似与 Vue 中的 provide/inject。

Context 有两种使用方式，接下来我们一一来看

### 1.1 静态注入

```js
import React, { Component } from 'react'
import {Button} from "antd"

// 1. 创建 Context
const ThemeContext = React.createContext()

class ThemeBtn extends Component {

    // 2. 将子组件使用的 Context 设置为当前组件的静态属性，即声明使用到的上下文对象
    static contextType = ThemeContext

    constructor(props){
        super(props)
        // 3. 创建和声明 Context 后，子组件实例就会有一个 context 属性表示接收到的 Context
        console.log(this.context)
    }

    render() {
        return (
            <div>
                <Button type={this.context.type}>{this.context.name}</Button>
            </div>
        )
    }
}


function ToolBar(props){
    return (
        <ThemeBtn></ThemeBtn>        
    )
}

export default class ContextUse extends Component {
    constructor(props){
        super(props)
        this.state = {
            store : {
                type: "primary",
                name: "确认"
            }
        }
    }
    
    render() {
        return (
            <div>
                {/* 4. 在父组件中使用 Context.Provider 提供值，必须使用 value 属性来传值*/}
                <ThemeContext.Provider value={this.state.store}>
                    <ToolBar></ToolBar>
                </ThemeContext.Provider>
            </div>
        )
    }
}


```

### 1.2 基于函数渲染
基于函数渲染使用:
1. ThemeContext.Provider: 在父组件中来提供数据
2. ThemeContext.Comsumer: 在子组件中使用数据

推荐使用这种方式，更容易理解。

```js
import React, { Component } from 'react'
import {Button} from "antd"

// 1. 创建 Context
const ThemeContext = React.createContext()

class ThemeBtn extends Component {

    render() {
        return (
                <ThemeContext.Consumer>
                    {/* 2. 在子组件中使用 ThemeContext.Consumer 来消费 Context 提供的值，必须使用函数*/}
                    {
                        value => <Button type={value.type}>{value.name}</Button>
                    }
                </ThemeContext.Consumer>
        )
    }
}


function ToolBar(props){
    return (
        <ThemeBtn></ThemeBtn>        
    )
}

export default class ContextUse extends Component {
    constructor(props){
        super(props)
        this.state = {
            store : {
                type: "primary",
                name: "确认"
            }
        }
    }
    
    render() {
        return (
            <div>
                {/* 2. 在父组件中使用 Context.Provider 提供值，必须使用 value 属性来传值*/}
                <ThemeContext.Provider value={this.state.store}>
                    <ToolBar></ToolBar>
                </ThemeContext.Provider>
            </div>
        )
    }
}
```

## 2. 组件通信的高阶装饰器写法
我们可以将上面的 Context 组件通信写成高阶组件的方式，以达到更高和更便利的复用。将 Context 定义成高阶组件如下:

```js
import React, { Component } from 'react'

const ThemeContext = React.createContext()


// 1. 装饰父组件，用于提供数据
export const withProvider = (Comp)=>{
    return class extends Component {
        constructor(props){
            super(props)
            this.state = {
                store : {
                    type: "primary",
                    name: "确认"
                }
            }
        }
        
        render() {
            return (
                    <ThemeContext.Provider value={this.state.store}>
                        <Comp {...this.props}></Comp>
                    </ThemeContext.Provider>
            )
        }
    }
}


// 2. 装饰 Button 接收数据
export const withComsumer = (Comp)=>{
    console.log("Button 装饰完成")
    return class extends Component {
        render() {
            console.log("使用新组件")
            return (
                <ThemeContext.Consumer>
                    {
                        value=><Comp {...this.props} value={value}></Comp>
                    }
                </ThemeContext.Consumer>
            )
        }
    }
}
```

使用定义的高阶组件:

```js
import React, { Component } from 'react'
import {Button} from "antd"
import {withComsumer, withProvider} from "../Hoc/WithContext"

@withComsumer
class ThemeBtn extends Component {
    render() {
        console.log("原始 Button组件进入")
        return (
               <Button type={this.props.value.type}>{this.props.value.name}</Button>
        )
    }
}


function ToolBar(props){
    return (
        <ThemeBtn></ThemeBtn>        
    )
}

@withProvider
class ContextUseDec extends Component {
    
    render() {
        return (
            <ToolBar></ToolBar>
        )
    }
}

export default ContextUseDec
```