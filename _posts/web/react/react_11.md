---
title: 11 react-router
date: 2020-11-11
categories:
    - 前端
tags:
	- React
---
react-router
<!-- more -->

## 1. react-router

react-router 是 react 中实现路由创建单页面的路由组件。

```bash
cnpm i react-router-dom -S
```

react-router-dom 提供了如下几个对象:
1. 要想使用路由，html 必须位于 HashRouter 或者 BrowserRouter 组件内
    - HashRouter 显示的 url 带有 /#/
    - BrowserRouter 显示的时干净的 url
2. Link: 相当于 a 标签表示一个页面
3. Route: 路由配置
4. Switch: 表示匹配成功一个路由后，就不再继续匹配，默认情况下，Route 匹配后会继续往下执行，进行匹配

### 1.1 react-router 基本使用
```js
import React, { Component } from 'react'
import {BrowserRouter, HashRouter, Link, Route, Switch, Redirect} from 'react-router-dom'
import Home from './pages/Home'
import Course from './pages/Course'
import User from './pages/User'
import NotFound from './pages/NotFound'


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
                    {/* state 用于 react 内传递参数，可以通过 this.props.location.state 访问 state 中的参数 */}
                    {/* seach 用于设置 url 的查询参数，
                        解析时使用 const params= new URLSearchParams(this.props.location.search) 
                        params.get("id") 就可以获取对应的值*/}
                    <li><Link to={pathname: "/user", state:{}, search: "?id=1"}>用户</Link></li>
                    {/* <Prompt when={true} message={location=>{`确定跳转至 ${location.pathname}`}}></Prompt> */}
                    
                </ul>
                {/* 5. 默认情况下，Route 匹配后会继续往下执行，进行匹配 */}
                {/* Switch 表示匹配成功一个路由后，就不再继续匹配 */}
                <Switch>
                    {/* 3. Router 用于路由配置 */}  
                    {/* exact 加上之后表示精准匹配，就不会总是显示第一个路由 */}
                    <Route exact path="/" component={Home}></Route>
                    <Route path="/course" component={Course}></Route>
                    <Route path="/user" component={User}></Route>
                    {/* 5. 重定向 */}
                    <Redirect to="/home"></Redirect>
                    {/* to 也可以是一个对象，其中 state 将传递给组件的 this.props.location.state */}
                    <Redirect to={pathname: "/home", state: {from: "/about"}}></Redirect>
                    {/* 4. 不设置 path 用于配置 404 路由 */}
                    <Route component={NotFound}></Route>
                </Switch>
                
                {/* <Button type='primary'>登录</Button>  */}
            </HashRouter>            
        )
    }
}

```

Route 会为 component 指定的路由组件添加三个属性 location, match, history
1. location: 本地信息对象
    - pathname: 当前页面的 url
    - search: url 中的查询参数，通过`new UrlSearchParams 解析`
    - hash: 
    - state: 通过 history.push({state: ""}) 传递的参数
2. match: 匹配的路由信息对象，含了当前的路由信息，和 url 参数
    - params: url 参数
    - path: 匹配的路由
    - url: 当前页面的 url
3. history: 页面跳转
    - goBack(): 返回上一页
    - push(): 跳转到特定页面


### 1.2 实现二级路由
react-router 实现二级路由与一级路由类似，直接在需要配置二级路由的组件中编写路由代码即可:

```js
import React, { Component } from 'react'
import {Link, Route} from 'react-router-dom'
import CourseDetail from './CourseDetail'
import CourseIndex from './CourseIndex'

export default class Course extends Component {
    render() {
        console.log(this.props)
        return (
            <div>
                {/* 1. 实现二级路由 */}
                <ul>
                    {/* 2. Route 会为 component 指定的路由组件添加三个属性 location, match, history  */}
                    {/* match 中包含了当前的路由信息，和 url 参数 */}
                    <li><Link to={`${this.props.match.url}/python`}>Python</Link></li>
                    <li><Link to="/course/goland">GoLang</Link></li>
                    <li><Link to="/course/javascript">Javascript</Link></li>
                </ul>
                {/* 4. 配置路由 */}
                {/* 与 vue 类似，同样可以设置路由参数，复用组件 */}
                <Route path="/course/:courseName" component={CourseDetail}></Route>
                {/* 5. 表示进入到 /course 二级根页面显示的信息 */}
                <Route exact path={this.props.match.path} component={CourseIndex}></Route>
            </div>
        )
    }
}

```

通过组件内 this.props.match 我们可以获取路由中的参数信息

```js
import React, { Component } from 'react'

export default class CourseDetail extends Component {
    render() {
        const {match} = this.props
        return (
            <div>
                当前课程为: {match.params.courseName}
            </div>
        )
    }
}

```

### 1.3 页面跳转
React 组件的 this.props.history 为我们提供了页面跳转的功能:

```js
import React, { Component } from 'react'
import {Button} from 'antd'


export default class CourseDetail extends Component {
    goHome = () => {
        // 3. 带参数进行页面跳转
        // 目标页面的组件通过 this.props.location.state 可以访问到传入的参数
        this.props.history.push({
            pathname: '/',
            state: {
                for: 'bar'
            }
        })
    }
    render() {
        const {match} = this.props
        // console.log(this.props)
        return (
            <div>
                当前课程为: {match.params.courseName}
                {/* 1. 返回上一页 */}
                <Button onClick={()=>this.props.history.goBack()}>返回上一页</Button>
                {/* 2. 命名导航，跳转到特定页面 */}
                <Button onClick={()=>this.props.history.push('/')}>跳转首页</Button>
                <Button onClick={this.goHome}>跳转首页带参数</Button>
            </div>
        )
    }
}

```

### 1.3 编辑页面的未保存跳转提醒
在编辑页面，用户可能意外的点击其他链接，导致当前编辑的内容丢失，正常情况下，如果页面有未保存的内容，用户在离开时我们需要给予提示。这个提示也是通过路由实现的。使用的是 react-route-dom 的 Prompt 组件。

```js
import React, { Component } from 'react'
import { Switch, Link, BrowserRouter, Route, Prompt} from 'react-router-dom'

class Editor extends Component {
    constructor(props) { 
        super(props)
        this.state = {
            "isEditor": 0
        }
        this.editorMap = {
            0: "未修改",
            1: "修改进行中",
            2: "已经保存"
        }
    }
    handleChange = (e) => {
        this.setState({
            isEditor: 1
        })

    }
    handleSubmit = e => { 
        e.preventDefault();
        e.target.reset()
        this.setState({
            isEditor: 0
        })
        
    }
    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    {/* 1. Prompt 组件在 when 属性为 true 时，在跳转前就会用弹窗提示用户是否需要跳转 */}
                    {/* message 就是提示信息，其是一个接受 location 对象的函数 */}
                    <Prompt
                        when={this.state.isEditor > 0}
                        message={ location=>`当前页面编辑未保存，确定要跳转至${location.pathname}么？`} >    
                    </Prompt>
                    <h3>编辑状态: {this.editorMap[this.state.isEditor]}</h3>
                    <input type="text" onChange={this.handleChange} />
                    <button>提交</button>
                </form>
                
            </div>
        )
    }
}


class EditorA extends Component {
    render() {
        return (
            <div>
                A页
            </div>
        )
    }
}

class EditorB extends Component {
    render() {
        return (
            <div>
                B页
            </div>
        )
    }
}


export default class BlockBack extends Component {
    render() {
        return (
            <BrowserRouter>
                <div>
                    <ul>
                        <li><Link to="/editor">编辑</Link></li>
                        <li><Link to="/editor/a">编辑A</Link></li>
                        <li><Link to="/editor/b">编辑B</Link></li>
                    </ul>
                </div>
                <Switch>
                    <Route exact path="/editor" component={ Editor}></Route>
                    <Route path="/editor/a" component={ EditorA}></Route>
                    <Route path="/editor/b" component={ EditorB}></Route>
                </Switch>
            </BrowserRouter>
            
            
        )
    }
}

```