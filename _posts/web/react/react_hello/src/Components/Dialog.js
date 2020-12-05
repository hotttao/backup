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
