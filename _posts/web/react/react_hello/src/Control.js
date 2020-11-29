import React, { Component } from 'react'

export default class Control extends Component {
    constructor(props){
        super(props)
        this.state = {
            val: "", // 1. 为表单设置默认值
            data: []
        }
    }
    handleInput(e){
        // 4. 通过 onChange 事件捕获表单输入值，实现双向数据绑定
        let val = e.target.value;
        this.setState({
            val
        })
    }
    handleClick(){
        let data = [...this.state.data]
        data.push(this.state.val)
        console.log(data)
        this.setState({
            val: "",
            data: data
        })
    }
    render() {
        return (
            <div>
                <p>当前输入值: {this.state.val}</p>
                {/* 2. value 属性绑定默认值 */}
                {/* 3. onChange 事件用来捕获表单输入并更新组件状态 */}
                <input type="text" value={this.state.val} onChange={(e)=>this.handleInput(e)}/>  
                <button onClick={()=>this.handleClick()}>添加</button>              
                <ul>
                    {
                        this.state.data && this.state.data.map((item, index)=>{
                            return <li key={index}>{item}</li>
                        })
                    }
                </ul>
            </div>
        )
    }
}


export class UnCotrol extends Component{
    constructor(props){
        super(props)
        this.state = {
            val: ""
        }
    }
    handleInput(e){
        let v1 = e.target.value
        // 1. 通过 this.refs.a 我们可以获取 ref="a" 标识的组件 
        let v2 = this.refs.a.value
        console.log(v1, v2)
        this.setState({
            val: v1
        })
    }
    render(){
        return (
            <div>
                <p>输入: {this.state.val}</p>
                <input type="text" onChange={(e)=>{this.handleInput(e)}} ref="a"/>
            </div>
        )
        
    }
}