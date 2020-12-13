import React, { Component } from 'react'
import {BrowserRouter, Switch, Route} from 'react-router-dom'

import Login from './pages/Login'
import Admin from './pages/Admin'

import './App.css';


export default class App extends Component {
  render() {
    return (
        <BrowserRouter>
          <Switch>
            <Route path='/login' component={Login}></Route>
            <Route path='/admin' component={Admin}></Route>
          </Switch>
        </BrowserRouter>        
    )
  }
}
