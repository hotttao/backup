import React, { Component } from 'react'
import {Button} from 'antd'


export default class CourseDetail extends Component {
    goHome = () => {
        // 3. 带参数进行页面跳转
        // 目标页面的组件通过 this.props.location.state 可以访问到传入的参数
        this.props.history.push({
            pathname: '/',
            state: {
                for: 'bar'
            }
        })
    }
    render() {
        const {match} = this.props
        // console.log(this.props)
        return (
            <div>
                当前课程为: {match.params.courseName}
                {/* 1. 返回上一页 */}
                <Button onClick={()=>this.props.history.goBack()}>返回上一页</Button>
                {/* 2. 命名导航，跳转到特定页面 */}
                <Button onClick={()=>this.props.history.push('/')}>跳转首页</Button>
                <Button onClick={this.goHome}>跳转首页带参数</Button>
            </div>
        )
    }
}
