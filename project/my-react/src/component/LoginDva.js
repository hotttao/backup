import React, { Component } from 'react'
import { connect } from 'dva'

@connect(
    // 2. state 用于共享数据
    state => ({
    // 1. user 就是 dva model 的命名空间名称，返回的就是 model state 的数据
        user: state.user
    }),
    // 3. 映射数据修改的方法
    {
        login: (name) => ({
            type: 'user/login', // 2. action 需要带命名空间
            name
        })
    }
)
class LoginDva extends Component {
    render() {
        console.log('---------------')
        console.log(this.props)
        console.log(this.props.user.userInfo)
        return (
            <div>
                <h3>用户是否登录: {this.props.user.userInfo.name}</h3>
                <button onClick={() => { this.props.login("tsong") }}>登录</button>
            </div>
        )
    }
}

export default LoginDva