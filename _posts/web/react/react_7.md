---
title: 7 高阶组件
date: 2020-11-07
categories:
    - 前端
tags:
	- React
---
高阶组件应用
<!-- more -->

## 1. 高阶组件(HOC)
所谓高阶组件是一个函数，其接收一个或多个组件，返回一个新的组件。感觉上就是一个函数装饰器

```js
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

export default funcHigh(BaseCom)
```

### 1.1 使用装饰器实现高阶组件

ES7 提供了装饰器语法，是的我们的高阶组件实现更加容易，在使用装饰器前，我们需要先安装两个包来做兼容:

```bash
# 1. 安装兼容插件
# cnpm install --save-dev babel-plugin-transformdecorators-legacy @babel/plugin-proposal-decorators
cnpm i craco-less -S
cnpm i  @babel/plugin-proposal-decorators -S

# 2. 修改 craco.config.js

const CracoLessPlugin = require('craco-less');

module.exports = {
  babel: {   //用来支持装饰器
	   plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]]
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: { '@primary-color': '#1DA57A' },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
};
```

### 1.2 装饰器语法
ES7 的装饰器语法与 Python 装饰器完全一样，上面示例中的高阶组件可以写成:

```js
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

// 可以使用装饰器

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
```

## 2. 高阶组件的应用
### 2.1 页面复用
页面复用经常需要使用带参数的装饰器

```js
import React, { Component } from 'react'

// 1. 闯将带参数的装饰器
export const fetchMovie = (fetch) => (Comp) =>{
    return class extends Component{
        constructor(props){
            super(props)
            this.state = {
                movies: []
            }
        }

        componentDidMount(){
            if (fetch === "A") {
                this.setState({
                    movies: [
                        {
                            'id': 1,
                            'movie': "夏洛特烦恼",
                            'category': "A"
                        }
                    ]
                })
            } else if (fetch === "B") {
                this.setState({
                    movies: [
                        {
                            'id': 1,
                            'movie': "黄飞红",
                            'category': "B"
                        }
                    ]
                })
            }
        }

        render(){
            return (
                <div>
                    <Comp {...this.props} data={this.state.movies}></Comp>
                </div>
            )
        }
    }
}

// 2. 使用参数的装饰器
@fetchMovie("A")
export class MovieA extends Component {
    render() {
        return (
            <MovieList movieList={this.props.data}></MovieList>
        )
    }
}
```

### 2.2 权限控制