import React, { Component } from 'react'
import {Redirect, Route} from  'react-router-dom'
import {mapAuthState} from '../store/auth'
import {connect} from 'react-redux'
import AuthUtil from "../utils/auth"

export function PrivateRoute({component: Comp, ...reset}){
    return (
        <Route {...reset} component={props=>{
            // return <UsedComp {...props}></UsedComp>
            if (AuthUtil.isAuth){
                return <Comp {...props}></Comp>
            }else{
                return <Redirect to={{pathname: '/login', state: props.location}}></Redirect>
            }
        }}></Route>
    )
}

class RequireLogin extends Component {
    render() {
        const Comp = this.props.component
        return (
            <Route {...this.props} component={props=>{
                // return <UsedComp {...props}></UsedComp>
                if (this.props.auth.isLogin){
                    return <Comp {...props}></Comp>
                }else{
                    return <Redirect to={{pathname: '/login', state: {from: props.location}}}></Redirect>
                }
            }}></Route>
        )
    }
}

export default connect(mapAuthState)(RequireLogin)