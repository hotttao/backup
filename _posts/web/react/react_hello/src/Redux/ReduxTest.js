import React, { Component } from 'react'
import store from "../store"
import {Button} from "antd"
import {connect} from 'react-redux'

// 1. 读取 store 
const mapState = state => {
    return {
        num: state.counter
    }
}

const asyncAdd = (dispatch)=>{
        setTimeout(() => {
            dispatch({type: '+'})
        }, 1000);
    }

// 2. 修改 store
const mapDispatch = dispatch => {
    return {
        add(){
            dispatch({type: '+'})
        },
        down(){
            dispatch({type: '-'})
        },
        asyncAdd:()=>{
            dispatch(asyncAdd)
        }
    }
}

class ReduxTest extends Component {
    render() {
        console.log(store)
        return (
            <div>
                <h2>Redux 使用</h2>
                {/* 3. 子组件通过 props 读取注入的 mapState 和 mapDispatch 方法 */}
                <h3>state: {this.props.num}</h3>
                <Button onClick={this.props.add}>+1</Button>
                <Button onClick={this.props.down}>-1</Button>
                <Button onClick={this.props.asyncAdd}>异步-1</Button>
            </div>
        )
    }
}

export default connect(mapState, mapDispatch)(ReduxTest)