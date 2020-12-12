import React, { Component } from 'react'
import {BrowserRouter, HashRouter, Link, Route, Switch, Redirect, Prompt} from 'react-router-dom'
import {Button} from "antd"
import './App.css'
import Home from './pages/Home'
import Course from './pages/Course'
import User from './pages/User'
import NotFound from './pages/NotFound'
import About from './pages/About'
import Login from './pages/Login'
import RequireLogin, {PrivateRoute} from  './hoc/RequireLogin'
import Admin from './pages/Admin'


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
                    <li><Link to="/admin">后台管理</Link></li>
                </ul>
                {/* 5. 默认情况下，Route 匹配后会继续往下执行，进行匹配 */}
                {/* Switch 表示匹配成功一个路由后，就不再继续匹配 */}
                <Switch>
                    {/* 3. Router 用于路由配置 */}
                    {/* exact 加上之后表示精准匹配，就不会总是显示第一个路由 */}
                    <Route exact path="/home" component={Home}></Route>
                    <Route path="/course" component={Course}></Route>
                    <Route path="/user" component={User}></Route>
                    <Route path="/admin" component={Admin}></Route>
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

