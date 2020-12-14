import React, { Component } from 'react'
import { message } from 'antd'
import './login.less'
import logo from '../../assets/images/logo.svg'
import NormalLoginForm from "../../component/login_form"
import { reqLogin } from '../../api'
import userStore from  '../../utils/storage'

export default class Login extends Component {  
    login = async (values) => {
        console.log('Received values of form: ', values);
        const { username, password } = values
        const res = await reqLogin(username, password)
        console.log(res)
        if (res.status === 0) {
            const user = res.data
            userStore.saveUser(user)
            this.props.history.replace('/admin')
            message.info("登录成功")
        } else { 
            message.error("用户名或密码错误")
        }
    };
    render() {
        return (
            <div className="login">
                <div className="login-header">
                    <img src={logo} alt=""/>
                    <h1>React 后台管理</h1>
                </div>        
                <div className="login-content">
                  <h1>用户登录</h1>
                    <NormalLoginForm reqLogin={ this.login }></NormalLoginForm>
                </div>
            </div>
        )
    }
}
