import React, { Component } from 'react'
// import {MovieA, MovieB} from './Components/Movie'
import {Button} from "antd"
import './App.css'

import ContextUse from "./Components/ContextUse"
import ContextUseDec from "./Components/ContextUseDec"
import MForm from "./Components/MForm"

export default class App extends Component {
    render() {
        return (
            <div>
              <Button type='primary'>登录</Button>  
              {/* <MovieA></MovieA> */}
              {/* <MovieB></MovieB> */}
              <ContextUse></ContextUse>
              <ContextUseDec></ContextUseDec>
              <MForm></MForm>
            </div>

            
        )
    }
}

