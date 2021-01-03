import React, { Component } from 'react'

class Child extends Component {
    handleClick=()=> {
        this.props.add(1)
    }
    render() {
        return (
            <div>
                <button onClick={ this.handleClick}>加1</button>    
            </div>
        )
    }
}


export default class Parent extends Component {
    constructor(props) { 
        super(props)
        this.state = {
            count: 1
        }
    }
    add=(val)=> { 
        console.log(this)
        console.log(val)
        return <div>sss</div>
    }
    addE=(e)=> { 
        console.log(this)
        console.log(e)
        return <div>sss</div>
    }
    render() {
        return (
            <div>
                <h2>{this.state.count}</h2>
                <h2>{ this.add(1)}</h2>
                <Child add={this.add}></Child>
                <button onClick={this.addE}>+1</button>
            </div>
        )
    }
}
