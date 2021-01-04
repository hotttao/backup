import React, { Component } from 'react'

function Hoc(Comp) { 
    return props => { 
        let attr = { type: "高阶组件" }
        return <Comp {...props} {...attr}></Comp>
    }
}

@Hoc
class Base extends Component {
    render() {
        return (
            <div>
                {this.props.type} 
            </div>
        )
    }
}


export default Base