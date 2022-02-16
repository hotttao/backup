---
title: 4 React 生命周期和受控组件
date: 2020-11-04
categories:
    - 前端
tags:
	- React
---
React 生命周期
<!-- more -->

## 1. React 生命周期的钩子函数
![react 老的生命周期](/images/JavaScript/react_life_old.png)
![react 新的生命周期](/images/JavaScript/react_life_new.png)

### 1.1 react 生命周期钩子函数示例

```js
import React, { Component } from 'react'
class SubCount extends Component {
  // 此方法在 父组件 render() 调用后，render() 完成前调用，因为子组件肯定在父组件 render() 函数内被使用
  componentWillReceiveProps(newProps){
    console.log('子组件将要接收新属性',newProps);
    
  }
  render() {
    return (
      <div>
        
      </div>
    );
  }
}

export default class LifyCycle extends Component {
  static defaultProps = {
    //1.加载默认的属性
    name: '小马哥',
    age: 18
  }
  constructor(props) {
    super(props);
    console.log('1.初始化 加载默认的状态');
    this.state = {
      count: 0
    }
  }
  componentWillMount() {
    console.log('2.父组件将要被挂载');

  }
  componentDidMount() {
    // 当前的这个方法中，发起ajax请求，获取数据 数据驱动视图
    console.log('4.父组件挂载完成');

  }
  shouldComponentUpdate(nextProps, nextState) {
    // 性能的优化点 重要
    console.log('5.组件是否要更新');
    if (nextState.count % 2 === 0) {
      return true;
    } else {
      return false;
    }

  }
  componentWillUpdate(){
    console.log('7.组件将要更新');
    
  }
  componentDidUpdate() {
    console.log('8.组件已经更新完成');

  }
  componentWillUnmount() {
    console.log('组件卸载完成');
    
  }
  handleClick = () => {
    this.setState((preveState, preveProps) => ({
      count: preveState.count + 1
    }), () => {
      console.log(this.state.count);
    })
  }
  render() {
    console.log('3.父组件(render)了');

    return (
      <div>
        <h2>当前的值:{this.state.count}</h2>
        <button onClick={this.handleClick}>+1</button>
        <SubCount count={this.state.count}></SubCount>
      </div>
    )
  }
}

```


## 2. 受控组件
受控组件，就是受状态控制的组件，需要与状态进⾏相应的绑定
1. 受控组件必须要有⼀个 onChange 事件，否则不能使⽤
2. 受控组件可以赋予默认值（实际上就是设置初始状态）
3. 官⽅推荐使⽤受控组件的写法，可以使⽤受控组件实现双向绑定。

无论受控和非受控组件，目的都是获取表单的值。受控组件通过绑定表单的 value 到 state 属性，然后通过 state 属性获取表单的值；非受控组件则是通过 ref 获取表单的引用，通过直接操作 DOM 来获取表单的值。

一个受控组件的实现如下:

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

## 3. 非受控组件
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

## 4. React 中表单的使用
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
    // 阻止默认事件，才会执行接下来定义的操作
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