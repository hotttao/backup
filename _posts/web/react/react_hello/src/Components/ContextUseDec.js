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

