import {observable, action} from "mobx"


// 创建观察者
export const appState = observable({
    num: 0
})

// action
appState.add = action(()=>{
    appState.num++
})


appState.down = action(()=>{
    appState.num--
})

