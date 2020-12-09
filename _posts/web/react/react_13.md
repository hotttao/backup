---
title: 13 redux 与 mobx 使用
date: 2020-11-13
categories:
    - 前端
tags:
	- Vue
---
使用 redux 与 mobx-react 共享数据
<!-- more -->

## 1. mobx 简介
mobx 是react 中另一款实现状态共享的组件。推荐在中小项目中使用。在 mobx 和 react 的组合中:
1. React是⼀个消费者，将应⽤状态state渲染成组件树对其渲染
2. Mobx是⼀个提供者，⽤于存储和更新状态state

```bash
cnpm i mobx mobx-react -S
```

### 1.1 mobx 使用
mobx 的使用分为如下几个步骤:
1. 创建 mobx 状态对象，并为状态对象创建操作状态的方法
2. 将mobx 状态对象通过组件属性注入组件
3. 在组件中通过 props 属性引用状态对象，并使用

```js
// 1. src/Store/mobx.js 创建 mobx 状态对象
import {observable, action} from "mobx"


// 创建观察者
export const appState = observable({
    num: 0
})

// action
appState.add = action(()=>{
    appState.num++
})


appState.down = action(()=>{
    appState.num--
})

// 2. 通过组件属性注入 appState
import React, { Component } from 'react'

export default class App extends Component {
    render() {
        return (
            <div>
              <MobxTest appState={appState}></MobxTest>
            </div>

            
        )
    }
}

// 3. 在组件中使用状态对象
import React, { Component } from 'react'
// import {appState} from '../Store/mobx'
import {observer} from "mobx-react"
import {Button} from "antd"

class MobxTest extends Component {
    render() {
        return (
            <div>
                <h2>MuboxTest</h2>
                <p>{this.props.appState.num}</p>
                <Button onClick={()=>{this.props.appState.add()}}>+1</Button>
            </div>
        )
    }
}

export default observer(MobxTest)
```

### 1.2 appState 的装饰器写法
appState 还有另一种装饰器写法，如下:

```js
class NumState{
    @observable num = 0;
    @action
    add(){
        this.num ++
    }

    @action
    down(){
        this.num --
    }
}

export default new NumState()
```


## 2. 对⽐ redux 和Mobx
1. 学习难度 redux > mobx
2. ⼯作量 redux > mobx
3. 内存开销 redux > mobx
4. 状态管理的集中性 redux > mobx
5. 样板代码的必要性 redux > mobx

结论：使⽤Mobx⼊⻔简单，构建应⽤迅速，但是当项⽬⾜够⼤的时候，还是redux,爱不释⼿，那还是开启严格模式，再加上⼀套
状态管理的规范，代码的复用性非常的高