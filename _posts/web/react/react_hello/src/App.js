import React, { Component } from 'react'

class Comment extends Component{
    handleClick = ()=>{
        console.log("子组件button")
        this.props.add("子组件传递过来的值")
    }
    render(){
        return (
            // 2. 父组件
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
        this.state = {
            count: 0
        }
    }
    add(val){
        console.log(this)
        this.state.count += 1
        console.log(this.state.count)
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
