import logger from 'redux-logger'
import thunk from 'redux-thunk'

import {createStore, combineReducers, applyMiddleware} from "redux"
import {auth} from './auth'
import {counter} from './counter'


const store = createStore(combineReducers({
    auth,
    counter
}), applyMiddleware(logger, thunk))

export default store