import React, { Component } from 'react'
import {Button} from 'antd'


export default class CourseDetail extends Component {
    goHome = () => {
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
                <Button onClick={()=>this.props.history.push('/')}>跳转首页</Button>
                <Button onClick={this.goHome}>跳转首页待参数</Button>
            </div>
        )
    }
}
