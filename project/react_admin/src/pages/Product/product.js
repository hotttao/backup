import React, { Component } from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'

import Show from './show'
import Update from './update'
import Detail from './detail'


export default class Product extends Component {
  render() {
    return (
      <div>
        <Switch>
          <Route exact path='/product' component={ Show}></Route>
          <Route path='/product/update' component={ Update}></Route>
          <Route path='/product/detail/:id' component={ Detail}></Route>
        </Switch>
      </div>
    )
  }
}
