---
title: 6 React 表单
date: 2020-11-03
categories:
    - 前端
tags:
	- Vue
---
React 表单: 受控组件和非受控组件
<!-- more -->

## 1. 受控组件
受控组件，就是受状态控制的组件，需要与状态进⾏相应的绑定
1. 受控组件必须要有⼀个 onChange 事件，否则不能使⽤
2. 受控组件可以赋予默认值（实际上就是设置初始状态）
3. 官⽅推荐使⽤受控组件的写法，可以使⽤受控组件实现双向绑定。

⾮受控组件，则不是通过与状态进⾏绑定来实现的，⽽是通过操作 DOM 来实现。除⾮操作 DOM，否则没有办法设置默认值。一个受控组件的实现如下:

```js
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

```

## 2. 非受控组件
一个非受控组件实现如下:

```js
export class UnCotrol extends Component{
    constructor(props){
        super(props)
        this.state = {
            val: ""
        }
    }
    handleInput(e){
        let v1 = e.target.value
        // 2. 我们可以通过事件获取表单输入的值
        // 3. 通过 this.refs.a 我们可以获取 ref="a" 标识的组件，这种方式我们也可以获取表单输入的值 
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
                {/* 1. input 输入框并没有绑定组件状态 */}
                <input type="text" onChange={(e)=>{this.handleInput(e)}} ref="a"/>
            </div>
        )
        
    }
}
```

## 3. React 中表单的使用
React 中的表单都是通过受控组件来实现即通过 value=组件状态和 onChange 事件来实时获取表单中的值。不同表单的使用示例可以看[官方文档](https://react.docschina.org/docs/forms.html)。下面是摘录的 select 表单使用示例:

```js
class FlavorForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {value: 'coconut'};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
  }

  handleSubmit(event) {
    alert('你喜欢的风味是: ' + this.state.value);
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          选择你喜欢的风味:
          <select value={this.state.value} onChange={this.handleChange}>
            <option value="grapefruit">葡萄柚</option>
            <option value="lime">酸橙</option>
            <option value="coconut">椰子</option>
            <option value="mango">芒果</option>
          </select>
        </label>
        <input type="submit" value="提交" />
      </form>
    );
  }
}
```