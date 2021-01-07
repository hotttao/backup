---
title: 10 redux、mobx 与 redux-saga
date: 2020-11-10
categories:
    - 前端
tags:
	- React
---
使用 redux 与 react-redux 共享数据
<!-- more -->

## 1. redux

redux 是 react 中做状态共享的库，作用于前面我们讲的 vuex 类似，用于在大型项目中的数据共享和管理。redux 遵循严格的单向数据流:
1. Store 中保存着用户共享的数据
2. 要想修改数据，用户需要发出 Action
3. Store 自动调用 Reducer，并且传入两个参数：当前 State 和收到的 Action
4. Reducer 会返回新的 State 
5. State 一旦有变化，Store 就会调用监听函数: `store.subscribe(listener);`
6. listener 可以通过store.getState()得到当前状态。如果使用的是 React，这时可以触发重新渲染 View

![Redux Flow](/images/JavaScript/redux_flow.jpg)

每次state更新，都会重新render整个项目，⼤型应⽤中会造成不必要的重复渲染。如何更优雅的使⽤redux呢，我们需要 react-redux。

```bash
cnpm -i redux -S
cnpm -i react-redux -S
```

### 1.1 redux 使用
使用 redux 需要如下几个步骤:
1. 创建 store，store 在初始化的时候，接收修改数据的 Action
2. store 注册和监听 react 组件
3. 使用 store，通过 store.dispatch/store.getState 修改和获取 store 中的值

```js
// src/store.js 创建 store
import {createStore} from "redux"

// 1. 创建 Reducers

function counter(state = 0, action){
    // action.type 是 Action dispatch 触发的动作类型
     switch (action.type) {
        case "+":
             return state + 1
             break;
        case "-":
            return state - 1
        default:
            return state
     }
}


// 2. 创建 store
const store = createStore(counter)

export default store
```

```js
// src/index.js 注册监听 React 组件
function render(){
    ReactDOM.render(<ReduxTest />, document.querySelector("#root"))
}


render()

// 1. 注册和订阅 react 组件，reder 就是注册到 redux 的回调函数
// 每次 redux state 更新时，都会重新调用 redux
store.subscribe(render)
```

```js
// react 中使用 store
import React, { Component } from 'react'
import store from "../store"
import {Button} from "antd"


export default class ReduxTest extends Component {
    add = ()=>{
        // 2. 触发 store 的 Action
        store.dispatch({
            type: '+'
        })
    }
    down = ()=>{
        store.dispatch({
            type: '-'
        })
    }
    render() {
        console.log(store)
        return (
            <div>
                <h2>Redux 使用</h2>
                {/* 1. 从 store 中获取值 */}
                <h3>state: {store.getState()}</h3>
                <Button onClick={this.add}>+1</Button>
                <Button onClick={this.down}>-1</Button>
            </div>
        )
    }
}

```

## 2. react-redux
使用 react-redux 分为如下几个步骤:
1. 创建 store，代码同上
1. 通过 Provider 将 store 导入到特定组件，避免了重复渲染整个组件
2. 通过 connect 高阶组件，将读取和修改 store 操作，装饰到组件中

```js
import { Provider } from "react-redux"
// src/index.js 通过 Provider 将 store 导入到特定组件
function render(){
    ReactDOM.render((
        // 1. 通过 Provider 将 store 导入到特定组件
        <Provider store={store}>
            <ReduxTest></ReduxTest>
        </Provider>
    ), document.querySelector("#root"))
}


render()

// 2. 不需要再注册和订阅 react 组件
// store.subscribe(render)
```

```js
// 组件中通过 connect 高阶组件，将读取和修改 store 操作，装饰到组件中
import React, { Component } from 'react'
import store from "../store"
import {Button} from "antd"
import {connect} from 'react-redux'

// 1. 读取 store 
const mapState = state => {
    return {
        num: state
    }
}

// 2. 修改 store
const mapDispatch = dispatch => {
    return {
        add(){
            dispatch({type: '+'})
        },
        down(){
            dispatch({type: '-'})
        }
    }
}

class ReduxTest extends Component {
    render() {
        console.log(store)
        return (
            <div>
                <h2>Redux 使用</h2>
                {/* 3. 子组件通过 props 读取注入的 mapState 和 mapDispatch 方法 */}
                <h3>state: {this.props.num}</h3>
                <Button onClick={this.props.add}>+1</Button>
                <Button onClick={this.props.down}>-1</Button>
            </div>
        )
    }
}

export default connect(mapState, mapDispatch)(ReduxTest)
```

## 3. redux 中间件

![Redux 中间件](/images/JavaScript/redux_middle.jpg)

利⽤redux中间件机制可以在实际action响应前执⾏其它额外的业务逻辑。

通常我们没有必要⾃⼰写中间件，介绍两款⽐较成熟的中间件
1. redux-logger:处理⽇志记录的中间件
2. Redux-thunk:处理异步action

```js
cnpm i redux-thunk redux-logger -S
```

### 3.1 装载 redux 中间件
redux 中间使用前需要装载:

```js
// src/store.js 中装载插件
import {createStore, applyMiddleware} from "redux"
import logger from "redux-logger"
import thunk from 'redux-thunk'

function counter(state = 0, action){
    // action.type 是 Action dispatch 触发的动作类型
     switch (action.type) {
        case "+":
             return state + 1
             break;
        case "-":
            return state - 1
        default:
            return state
     }
}


// 1. 使用 applyMiddleware 装载中间件
const store = createStore(counter, applyMiddleware(logger, thunk))

export default store
```

### 3.2 使用 redux-thunk 进行异步操作
redux 中 Action 默认接收一个对象，表示执行的下一个任务，这个执行的过程必须是同步的。如果在执行之前需要一些异步操作，需要借助 redux-thunk 中间，此时 Action 接收一个函数。

```js
const asyncAdd = (dispatch)=>{
        setTimeout(() => {
            dispatch({type: '+'})
        }, 1000);
    }

// 2. 修改 store
const mapDispatch = dispatch => {
    return {
        add(){
            dispatch({type: '+'})
        },
        down(){
            dispatch({type: '-'})
        },
        asyncAdd:()=>{
            dispatch(asyncAdd)
        }
    }
}

```

## 4. redux 状态模块化
当 redux 中管理的共享状态越来越多时，我们需要对其模块化。redux 提供了 combineReducers 函数用于对模块进行整合。

```js
// src/store.js Reducer 整合
const store = createStore(combineReducers({
    counter 
}), applyMiddleware(logger, thunk))

// 状态访问
const mapState = state => {
    return {
        // 相应的对状态进行访问时，也要带上响应的键。
        num: state.counter
    }
}
```

## 5. mobx 简介
mobx 是react 中另一款实现状态共享的组件。推荐在中小项目中使用。在 mobx 和 react 的组合中:
1. React是⼀个消费者，将应⽤状态 state 渲染到组件树
2. Mobx是⼀个提供者，⽤于存储和更新状态state

![Mobx 数据流](/images/JavaScript/mobx_flow.jpg)

```bash
cnpm i mobx mobx-react -S
```

### 5.1 mobx 使用
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
              {/* 直接通过属性注入的方式使用 state */}
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
                {/* 直接通过 props 操作 state */}
                <p>{this.props.appState.num}</p>

                {/* 注意此处必须使用箭头函数 */}
                <Button onClick={()=>{this.props.appState.add()}}>+1</Button>
            </div>
        )
    }
}
// 4. 组件监听状态的变化
export default observer(MobxTest)
```

### 5.2 appState 的装饰器写法
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


### 5.3 对⽐ redux 和Mobx
1. 学习难度 redux > mobx
2. ⼯作量 redux > mobx
3. 内存开销 redux > mobx
4. 状态管理的集中性 redux > mobx
5. 样板代码的必要性 redux > mobx

结论：使⽤Mobx⼊⻔简单，构建应⽤迅速，但是当项⽬⾜够⼤的时候，还是redux,爱不释⼿，那还是开启严格模式，再加上⼀套状态管理的规范，代码的复用性非常的高


## 6. redux-saga
redux-saga 是⼀个⽤于管理应⽤程序 Side Effect（副作⽤，例如异步获取数据，访问浏览器缓存等）的 library，redux-saga 使⽤了 ES6 的 Generator 功能，让异步的流程更易于读取，写⼊和测试。通过这样的⽅式，这些异步的流程看起来就像是标准同步的Javascript 代码。
不同于 redux thunk，你不会再遇到回调地狱了，你可以很容易地测试异步流程并保持你的 action 是⼲净的。

```bash
npm i redux-saga -S
```