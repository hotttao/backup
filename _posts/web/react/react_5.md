---
title: 5 React 生命周期
date: 2020-11-03
categories:
    - 前端
tags:
	- Vue
---
React 生命周期
<!-- more -->

## 1. React 生命周期的钩子函数

```js
import React, { Component } from 'react'
class SubCount extends Component {
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