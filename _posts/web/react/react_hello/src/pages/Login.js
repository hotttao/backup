import React, { Component } from 'react'
import {connect} from 'react-redux'
import {Button} from 'antd'
import { Redirect } from 'react-router-dom'
import {mapAuthState, mapAuthDisPatch} from  '../store/auth'

class Login extends Component {
    handleLogin = ()=>{
        this.props.login()
    }
    render() {
        let {isLogin} = this.props.auth
        console.log(this.props)
        console.log(this.props.location)
        let path = this.props.location.state.from.pathname
        
        if (isLogin){
            return <Redirect to={path}></Redirect>
        } else {
            return (
                <div>
                    <p>请先登录</p>
                    <Button onClick={this.handleLogin}>登录</Button>
                </div>
            )
        }
    }
}

export default connect(mapAuthState, mapAuthDisPatch)(Login)