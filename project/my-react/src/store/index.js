import { createStore, applyMiddleware, combineReducers } from 'redux'
import user from "./userReducer"
import logger from 'redux-logger'
import createSagaMiddleware from 'redux-saga'
import userSaga from './userSaga'

// 1. 创建 saga 中间件
const sageMid = createSagaMiddleware()

// 2. 创建 store
const store = createStore(combineReducers({
    user
}), applyMiddleware(logger, sageMid))

// 3. 运行 saga 中间件
sageMid.run(userSaga)

export default store
