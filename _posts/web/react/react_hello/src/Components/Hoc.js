import React, { Component } from 'react'

// 一：返回函数式的高阶组件
function funcHighOrderComp(Comp){
    console.log("新的组件")
    return (props)=>{
        console.log("调用新组件")
        const attach = {'title': "react", "price": 1688}
        return (
            <div>
                {/* 注意 React 中组件名必须大写 */}
                <Comp {...props} {...attach}></Comp>
            </div>
        )
    }
}

// 二：返回类的高阶组件，组件内部就可以定义类组件的声明周期函数
const funcHigh = (Comp)=>{
    return class extends Component{
        componentDidMount(){
            console.log("发起 Ajax 请求")
        }
        render(){
            const attach = {'title': "react", "price": 1688}
            return (
                <div>
                    {/* 注意 React 中组件名必须大写 */}
                    <Comp {...this.props} {...attach}></Comp>
                </div>
            )
        }
    }
}

@funcHigh
class BaseCom extends Component {
    render() {
        console.log("-----------")
        return (
            <div>
                <p>当前价格: {this.props.price}</p>
            </div>
        )
    }
}

export default BaseCom