import React, { Component } from 'react'
import { connect } from 'react-redux'
import { mapUserOp, mapUserState } from  "../store/userReducer"

@connect(mapUserState, mapUserOp)
class Login extends Component {
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

export default Login