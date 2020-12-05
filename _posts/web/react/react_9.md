---
title: 9 高阶组件应用
date: 2020-11-09
categories:
    - 前端
tags:
	- Vue
---
高阶组件应用
<!-- more -->

## 1. 页面复用
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

## 2. 权限控制
