import React, { Component } from 'react'
import { connect } from 'dva'

@connect(state => ({
    // 1. user 就是 dva model 的命名空间名称
    user: state.user
}))
class LoginDva extends Component {
    login = () => { 
        this.props.login()
    }
    render() {
        console.log(this.props)
        console.log(this.props.user.userInfo)
        return (
            <div>
                <h3>用户是否登录: {this.props.user.isLogin}</h3>
                <button onClick={ this.login}>登录</button>
            </div>
        )
    }
}

export default LoginDva