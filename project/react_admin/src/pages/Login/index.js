import React, { Component } from 'react'
import './login.less'
import logo from '../../assets/images/logo.svg'

export default class Login extends Component {
    render() {
        return (
            <div className="login">
                <div className="login-header">
                    <img src={logo} alt=""/>
                    <h1>React 后台管理</h1>
                </div>        
                <div className="login-content">
                    <h1>用户登录</h1>
                    
                </div>
            </div>
        )
    }
}
