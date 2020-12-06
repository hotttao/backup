import React, { Component } from 'react'
import { SmileOutlined } from '@ant-design/icons'

const MFormCreate = Comp => {
    return class extends Component{
        constructor(props){
            super(props)
            this.options = {} //
            this.state = {}
        }

        handleChange = e => {
            const {name, value} = e.target
            this.setState({
                [name]: value
            }, ()=>{
                this.validateField(name)
            })
        }

        handleFocus = e => {
            const fieldName = e.target.name
            this.setState({
                [fieldName + 'Focus']: true
            })
        }

        validateFields = callback => {
            const check = Object.keys(this.options).map(fieldName=>{
                return this.validateField(fieldName)
            })
            console.log(check)
            const ret = check.every(v=>v===true)
            
            callback(ret)
        }

        validateField = fieldName => {
            console.log(fieldName)
            const {rules} = this.options[fieldName]
            const ret = rules.some(rule=>{
                if (rule.required){
                    if (!this.state[fieldName]){
                        this.setState({
                            [fieldName + 'Message']: rule.message
                        })
                        return true
                    }
                }
            })
            if (!ret) {
                this.setState({
                    [fieldName + "Message"]: ''
                })
            }
            return !ret
        }

        getFieldDecorator = (fieldName, option)=>{
            this.options[fieldName] = option
            return InputComp => {
                return (
                    <div>
                        {
                            React.cloneElement(InputComp, {
                                name: fieldName,
                                value: this.state[fieldName] || '',
                                onChange: this.handleChange,
                                onFocus: this.handleFocus
                            })
                        }
                    </div>
                )
            }
        }

        form(){
            return {
                getFieldDecorator: this.getFieldDecorator,
                validateFields: this.validateFields,
                isFieldTouched: this.isFieldTouched,
                getFieldError: this.getFieldError
            }
        }

        isFieldTouched = (fieldName)=>{
            console.log(this.state)
            return !!this.state[fieldName + 'Focus']
        }

        getFieldError = (fieldName)=>{
            console.log(this.state)
            return this.state[fieldName + "Message"]
        }

        render(){
            return (
                <Comp {...this.props} form={this.form()}></Comp>
            )
            
        }
    }
}

class Input extends Component{
    render(){
        return (
            <div>
                {this.props.prefix}
                <input type={this.props.type} {...this.props}/>
            </div>
        )
    }
}

class FormItem extends Component{
    render(){
        return (
            <div>
                {
                    this.props.children
                }
                {
                    this.props.validateStatus && (
                    <p style={{color: 'red'}}>{this.props.help}</p>
                    )
                }
            </div>
            
        )
    }
}

@MFormCreate
class MForm extends Component {
    handlerSubmit = () => {
        console.log("提交验证")
        this.props.form.validateFields(isValid=>{
            if (isValid){
                alert("验证成功")
            } else{
                alert("验证失败")
            }
        })
    }
    render() {
        const {getFieldDecorator, isFieldTouched, getFieldError} = this.props.form
        const usererror = isFieldTouched('username') && getFieldError("username")
        const passworderror = isFieldTouched('password') && getFieldError("password")
        console.log(usererror)
        return (
            <div> 
                <FormItem validateStatus={usererror ? 'error' : ''} help={usererror || ''}>
                    {
                        getFieldDecorator('username', {
                            rules: [
                                {
                                    required: true,
                                    message: "用户名是必填的"
                                }
                            ]
                        })(<Input type="text" prefix={<SmileOutlined type='user' style={{color: 'red'}}/>}/>)
                    }
                </FormItem>
                
                <FormItem validateStatus={passworderror ? 'error' : ''} help={passworderror || ''}>
                    {
                    getFieldDecorator('password', {
                            rules: [
                                {
                                    required: true,
                                    message: "密码是必填的"
                                }
                            ]
                        })(<input type="password"/>)
                    }
                </FormItem>
                
                <input type="button" value="提交" onClick={this.handlerSubmit}/>
            </div>
        )
    }
}

export default MForm