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
1. 创建 model 
2. 以 dva 方式注册 model，然后启动项目
3. 通过 connect 将 model 共享的数据和方法注册到组件中

### 2.1 model 创建

src/model/user.js

```js
// 异步请求的接口，将被 call 方法调用
function login(name) { 
    return () => {
        return new Promise((resolve) => {
            return setTimeout(() => {
                resolve({ id: 1, name })
            }, 1000)
        })
    }
}

export default {
    namespace: 'user', // 1. dva model 的命名空间，用于区分其他 model
    state: {           // 2. 共享的数据
        isLogin: false,
        userInfo: {

        }
    },
    reducers: {       // 3. reducer 同步方法
        // 直接修改 state 中的数据
        initLogin(state, action) { 
            // state 是当前的状态，action 是组件触发的动作，包括传入的载荷
            return {'userInfo': action.userInfo}
        }

    },
    effects: {        // 4. effects 异步方法
        *login(action, { call, put }) { 
            console.log(action)
            const ret = yield call(login(action.name))
            // 5. put 将操作提交至 reducer 进行同步修改
            yield put({
                type: 'initLogin',
                userInfo: ret
            })
        }

    }
}
```

### 2.2 dva 注册model 并启动项目
/src/index.js

```js
import React from 'react';
import './index.css';
import App from './App';
import user from './models/user'

import dva from 'dva'
const app = dva();

// 1. 注册 model，多个 model 需要使用多次 
app.model(user);

// 2. 注册路由
app.router(() => <App />);
app.start('#root');
```

### 2.3 connect 使用共享数据
src/compoents/LoginDva.js

```js
import React, { Component } from 'react'
import { connect } from 'dva'

@connect(
    // 2. state 用于共享数据
    state => ({
    // 1. user 就是 dva model 的命名空间名称，返回的就是 model state 的数据
        user: state.user
    }),
    // 3. 映射数据修改的方法
    {
        login: (name) => ({
            type: 'user/login', // 2. action 需要带命名空间
            name
        })
    }
)
class LoginDva extends Component {
    render() {
        console.log('---------------')
        console.log(this.props)
        console.log(this.props.user.userInfo)
        return (
            <div>
                <h3>用户是否登录: {this.props.user.userInfo.name}</h3>
                <button onClick={() => { this.props.login("tsong") }}>登录</button>
            </div>
        )
    }
}

export default LoginDva
```

## 3. UmiJS 中使用 dva
UmiJS 已经自动集成了 dva 使用起来非常方便，只需要定义 model 直接 connect 注入即可使用。
