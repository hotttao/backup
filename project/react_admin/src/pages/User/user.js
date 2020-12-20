import React, { Component } from 'react'
import { Card, Button } from 'antd'
import UserManage from '../../component/UserManage'
import UserRegisForm from './user-form'

export default class User extends Component {
  constructor(props) { 
    super(props)
    this.modalRef = React.createRef()
    this.formRef = React.createRef()
  }
  addUser = () => { 
    console.log(this.modalRef)
    this.modalRef.current.showModal()
  }

  commit = () => { 
    console.log(this.formRef.current)
    this.formRef.current.validator()
    return false
  }

  render() {
    const userBtn = (
      <Button onClick={ this.addUser } type='primary'>添加用户</Button>
    )
    return (
      <Card title={userBtn} extra='' style={{ width: 300 }}>
        <p>Card content</p>
        <p>Card content</p>
        <p>Card content</p>
        
        <UserManage ref={this.modalRef} commit={this.commit} title="添加用户">
          <UserRegisForm ref={ this.formRef }></UserRegisForm>
        </UserManage>
      </Card>
    )
  }
}
