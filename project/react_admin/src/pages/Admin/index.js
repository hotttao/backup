import React, { Component } from 'react'
import { Redirect } from 'react-router-dom'
import userStore from '../../utils/storage'

export default class Admin extends Component {
    render() {
        const user = userStore.getUser()
        if (!user._id) { 
            return  <Redirect to="/login"></Redirect>
        }
        return (
            <div>
                管理页面
            </div>
        )
    }
}
