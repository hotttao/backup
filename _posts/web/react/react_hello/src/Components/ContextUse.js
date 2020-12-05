import React, { Component } from 'react'
import {Button} from "antd"

// 1. 创建 Context
const ThemeContext = React.createContext()

class ThemeBtn extends Component {

    render() {
        return (
                <ThemeContext.Consumer>
                    {/* 2. 在子组件中使用 ThemeContext.Consumer 来消费 Context 提供的值，必须使用函数*/}
                    {
                        value=><Button type={value.type}>{value.name}</Button>
                    }
                </ThemeContext.Consumer>
        )
    }
}


function ToolBar(props){
    return (
        <ThemeBtn></ThemeBtn>        
    )
}

export default class ContextUse extends Component {
    constructor(props){
        super(props)
        this.state = {
            store : {
                type: "primary",
                name: "确认"
            }
        }
    }
    
    render() {
        return (
            <div>
                {/* 2. 在父组件中使用 Context.Provider 提供值，必须使用 value 属性来传值*/}
                <ThemeContext.Provider value={this.state.store}>
                    <ToolBar></ToolBar>
                </ThemeContext.Provider>
            </div>
        )
    }
}

