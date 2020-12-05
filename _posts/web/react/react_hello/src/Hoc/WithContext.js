import React, { Component } from 'react'

const ThemeContext = React.createContext()

export const withProvider = (Comp)=>{
    return class extends Component {
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
                    <ThemeContext.Provider value={this.state.store}>
                        <Comp {...this.props}></Comp>
                    </ThemeContext.Provider>
            )
        }
    }
}

export const withComsumer = (Comp)=>{
    console.log("Button 装饰完成")
    return class extends Component {
        render() {
            console.log("使用新组件")
            return (
                <ThemeContext.Consumer>
                    {
                        value=><Comp {...this.props} value={value}></Comp>
                    }
                </ThemeContext.Consumer>
            )
        }
    }
}