import React, { Component } from 'react'
// import {appState} from '../Store/mobx'
import {observer} from "mobx-react"
import {Button} from "antd"

class MobxTest extends Component {
    render() {
        return (
            <div>
                <h2>MuboxTest</h2>
                <p>{this.props.appState.num}</p>
                <Button onClick={()=>{this.props.appState.add()}}>+1</Button>
            </div>
        )
    }
}

export default observer(MobxTest)