import {createStore, applyMiddleware, combineReducers} from "redux"
import logger from "redux-logger"
import thunk from 'redux-thunk'

function counter(state = 0, action){
    // action.type 是 Action dispatch 触发的动作类型
     switch (action.type) {
        case "+":
             return state + 1
             break;
        case "-":
            return state - 1
        default:
            return state
     }
}


// 1. 使用 applyMiddleware 装载中间件
const store = createStore(combineReducers({
    counter
}), applyMiddleware(logger, thunk))

export default store