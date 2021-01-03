---
title: 12 react 导航守卫
date: 2020-11-12
categories:
    - 前端
tags:
	- React
---
react 导航守卫
<!-- more -->

## 1. react 导航守卫
react 中没有提供特定的导航守卫的钩子函数，导航守卫通过高阶组件，包装 Route 组件来实现。要实现一个拦截验证登录的功能，需要以下几个步骤:
1. 使用 react-redux 来共享登录状态
2. 定义高阶组件，来包装 Route 验证登录状态

### 1.1 共享登录状态
#### 共享登录装填
```js
// store/auth.js
const authInfo = {
    isLogin: false,
    userInfo: {

    }
}

export function auth(state=authInfo, action){
    switch (action.type) {
        case 'login':
            return {isLogin: true}
        default:
            return state;
    }
}

export const mapAuthState = state => {
    return {
        auth: state.auth
    }
}

const Login = (dispatch)=>{
        setTimeout(()=>{
            dispatch({type: 'login'})
        }, 1000)
}

export const mapAuthDisPatch = dispatch => {
    return {
        login: ()=>{
            dispatch(Login)
        }
    }
}
```

#### 创建 store 对象
```js
// store/index.js
import logger from 'redux-logger'
import thunk from 'redux-thunk'

import {createStore, combineReducers, applyMiddleware} from "redux"
import {auth} from './auth'
import {counter} from './counter'


const store = createStore(combineReducers({
    auth,
    counter
}), applyMiddleware(logger, thunk))

export default store
```

## 2. 挂载 store

```js
// index.js
import ReactDOM from "react-dom"
import App from "./App"
import store from  './store'
import {Provider} from 'react-redux'

ReactDOM.render((
    <Provider store={store}>
        <App name="你好"/>
    </Provider>
), document.querySelector("#root"))
```

## 3. 定义验证登录的高阶组件
```js
// hoc/RequireLogin.js
import React, { Component } from 'react'
import {Redirect, Route} from  'react-router-dom'
import {mapAuthState} from '../store/auth'
import {connect} from 'react-redux'
import AuthUtil from "../utils/auth"

export function PrivateRoute({component: Comp, ...reset}){
    return (
        <Route {...reset} component={props=>{
            // return <UsedComp {...props}></UsedComp>
            if (AuthUtil.isAuth){
                return <Comp {...props}></Comp>
            }else{
                return <Redirect to={{pathname: '/login', state: props.location}}></Redirect>
            }
        }}></Route>
    )
}

class RequireLogin extends Component {
    render() {
        const Comp = this.props.component
        return (
            <Route {...this.props} component={props=>{
                // return <UsedComp {...props}></UsedComp>
                if (this.props.auth.isLogin){
                    return <Comp {...props}></Comp>
                }else{
                    return <Redirect to={{pathname: '/login', state: {from: props.location}}}></Redirect>
                }
            }}></Route>
        )
    }
}

export default connect(mapAuthState)(RequireLogin)
```

## 4. 使用验证登录的高阶组件
```js
// App.js
import React, { Component } from 'react'
import {BrowserRouter, HashRouter, Link, Route, Switch, Redirect} from 'react-router-dom'
import {Button} from "antd"
import './App.css'
import Home from './pages/Home'
import Course from './pages/Course'
import User from './pages/User'
import NotFound from './pages/NotFound'
import About from './pages/About'
import Login from './pages/Login'
import RequireLogin, {PrivateRoute} from  './hoc/RequireLogin'


export default class App extends Component {
    render() {
        return (
            // 1. 要想使用路由，html 必须位于 HashRouter 或者 BrowserRouter 组件内
            // HashRouter 显示的 url 带有 /#/ 
            // BrowserRouter 显示的时干净的 url
            <HashRouter>
                <ul>
                    {/* 2. Link 用于设置路由 */}
                    <li><Link to="/">首页</Link></li>
                    <li><Link to="/course">课程</Link></li>
                    <li><Link to="/user">用户</Link></li>
                    <li><Link to="/about">关于</Link></li>
                </ul>
                {/* 5. 默认情况下，Route 匹配后会继续往下执行，进行匹配 */}
                {/* Switch 表示匹配成功一个路由后，就不再继续匹配 */}
                <Switch>
                    {/* 3. Router 用于路由配置 */}
                    {/* exact 加上之后表示精准匹配，就不会总是显示第一个路由 */}
                    <Route exact path="/home" component={Home}></Route>
                    <Route path="/course" component={Course}></Route>
                    <Route path="/user" component={User}></Route>
                    {/* 6. 验证登录 */}
                    <RequireLogin path="/about" component={About}></RequireLogin>
                    <Route path="/login" component={Login}></Route>
                    {/* 5. 重定向 */}
                    <Redirect to="/home"></Redirect>
                    {/* 4. 不设置 path 用于配置 404 路由 */}
                    <Route component={NotFound}></Route>
                </Switch>
                
                {/* <Button type='primary'>登录</Button>  */}
            </HashRouter>            
        )
    }
}


```

## 5. 登录页面
```js
import React, { Component } from 'react'
import {connect} from 'react-redux'
import {Button} from 'antd'
import { Redirect } from 'react-router-dom'
import {mapAuthState, mapAuthDisPatch} from  '../store/auth'

class Login extends Component {
    handleLogin = ()=>{
        this.props.login()
    }
    render() {
        let {isLogin} = this.props.auth
        console.log(this.props)
        console.log(this.props.location)
        let path = this.props.location.state.from.pathname
        
        if (isLogin){
            return <Redirect to={path}></Redirect>
        } else {
            return (
                <div>
                    <p>请先登录</p>
                    <Button onClick={this.handleLogin}>登录</Button>
                </div>
            )
        }
    }
}

export default connect(mapAuthState, mapAuthDisPatch)(Login)
```