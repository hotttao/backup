---
title: 6 React 中的组件使用
date: 2020-11-06
categories:
    - 前端
tags:
	- React
---
React 组件使用
<!-- more -->


## 1. 聪明组件VS傻⽠组件
基本原则:
1. 聪明组件(容器组件)负责数据获取
2. 傻⽠组件(展示组件)
  - 负责根据props显示信息内容
  - 傻瓜式组件通常是函数式组件，函数通过参数进行传值，只要约定好数据接口就可以进行复用

在下面的示例中，Comment 就是我们的傻瓜式组件，接收评论内容，负责评论部分的展示。但是这个示例存在一个问题: 没请求一次评论数据，Comment 组件都会渲染一次，无论数据是否变化。此时我们需要生命周期中的 shouldComponentUpdate 方法，进行组件渲染优化。

```js
import React, { Component } from 'react'

function Comment(props){
    const {id, author, content} = props.comment
    console.log("render")
    return (
        <div>
            <p>{id}</p>
            <p>{author}</p>
            <p>{content}</p>
        </div>
    )
}

export default class CommentList extends Component {
    constructor(props){
        super(props)
        this.state = {
            comments: []
        }
    }
    componentDidMount(){
        console.log("组件数据获取")
        setInterval(()=>{
            this.setState({
                comments: [
                    {
                        id: 1,
                        author: "facebook",
                        content: "react is good"
                    },
                    {
                        id: 2,
                        author: "由于西",
                        content: "vue is more good"
                    }
                ]
            })
        }, 2000)
        
    }
    
    render() {
        // console.log(this.state.comments)
        return (
            <div>
                {
                    this.state.comments.map(item=>{
                        return <Comment key={item.id} comment={item}></Comment>
                    })
                }
            </div>
        )
    }
}

```
## 2. 组件渲染优化
前面的示例我们提到了，组件渲染的优化问题，我们有下面几种解决方案:
1. 使用 shouldComponentUpdate 生命周期方法
2. 让组件继承自 PureComponent:
  - PureComponent 已实现了 shouldComponentUpdate 会自动执行 props 更新前后的比较
  - PureComponent 实现的的是浅层比较，因此需要改变组件传值的方式，只能传递基础类型，引用类型，如果两个对象值相同但是不同的对象，PureComponent 同样会判断为不同的对象
3. 使用 React 高阶组件 React.memo，其功能与 PureComponent 类似

### 2.1 shouldComponentUpdate

```js
class Comment extends Component{
    shouldComponentUpdate(nextProps, nextState){
        // 性能优化的方法
        // console.log(nextProps)
        // console.log(nextState)
        if (nextProps.comment.content === this.props.comment.content){
            return false
        } else {
            return true
        }
    }
    render(){
        const {id, author, content} = this.props.comment
        console.log("render")
        return (
            <div>
                <p>{id}</p>
                <p>{author}</p>
                <p>{content}</p>
            </div>
        )
    }
}

```

### 2.2 PureComponent

```js
import React, { Component,PureComponent } from 'react'


// 1. 更改组件继承的类
class Comment extends PureComponent{
    render(){
        const {id, author, content} = this.props
        console.log("render")
        return (
            <div>
                <p>{id}</p>
                <p>{author}</p>
                <p>{content}</p>
            </div>
        )
    }
}

export default class CommentList extends Component {
    constructor(props){
        super(props)
        this.state = {
            comments: []
        }
    }
    componentDidMount(){
        console.log("组件数据获取")
        setInterval(()=>{
            this.setState({
                comments: [
                    {
                        id: 1,
                        author: "facebook",
                        content: "react is good"
                    },
                    {
                        id: 2,
                        author: "由于西",
                        content: "vue is more good"
                    }
                ]
            })
        }, 2000)
        
    }
    
    render() {
        // console.log(this.state.comments)
        return (
            <div>
                {
                    this.state.comments.map(item=>{
                        // 更2. 改数据的传递方式
                        return <Comment key={item.id} {...item}></Comment>
                    })
                }
            </div>
        )
    }
}

```

### 2.3 高级组件 React.memo
React.memo 接收一个函数，返回一个函数式组件，所以称为高级组件，功能与 PureComponent 类似，可以进行自动的值比较。

```js
const Comment = React.memo(({id, author, content})=>{
    console.log("render")
    return (
        <div>
            <p>{id}</p>
            <p>{author}</p>
            <p>{content}</p>
        </div>
    )
})
```

## 3. 组件组合而非继承
React 有非常强大的组合模式，推荐使用组件组合而非继承的方式实现组件的重用。下面示例的重点就是展示如何将 Button 和 Dialog 组件组合使用。

```js
import React, { Component } from 'react'
import {Button} from "antd"


function Dialog(props){
    return (
        // 3. 设置边框样式，注意这里的 ES6 语法
        <div style={{border: `1px solid ${props.color}`}}>
            {/* 1. 好比 vue 中的匿名插槽 */}
            {props.children}
            <div>
                {/* 4. 接收并显示组件 */}
                {props.btn}
            </div>
        </div>
    )
}


function Welcome(props){
    // 重点: 优先使用组件组合，将 Button 和 Dialog 组件组合使用，而不是继承
    const confirmBtn = <Button type='info'>确认</Button>
    return (
        // 3. 也可以将组件作为属性传入其他组件中
        <Dialog color="red" btn={confirmBtn}>
            {/* 2. Dialog 内的内容将作为 props.children 传给 Dialog 的 props */}
            <h3>Welcom</h3>
            <p>你好，欢迎光临</p>
        </Dialog>
    )
    
}
export default class Compod extends Component {
    render() {
        return (
            <div>
                <Welcome></Welcome>
            </div>
        )
    }
}
```

