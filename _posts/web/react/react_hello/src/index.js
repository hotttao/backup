import ReactDOM from "react-dom"
import App from "./App"
import Control, {UnCotrol} from "./Control"
import FormV from "./Form"
import CommentList from "./Components/CommentList"
import Compod from "./Components/Dialog"
import Hoc from './Components/Hoc'
import ReduxTest from './Redux/ReduxTest'
import store from './store'
import {Provider} from 'react-redux'


// ReactDOM.render(<App name="你好"/>, document.querySelector("#root"))
// ReactDOM.render(<UnCotrol></UnCotrol>, document.querySelector("#root"))
// ReactDOM.render(<FormV></FormV>, document.querySelector("#root"))

// ReactDOM.render(<CommentList></CommentList>, document.querySelector("#root"))
// ReactDOM.render(<Compod></Compod>, document.querySelector("#root"))
// ReactDOM.render(<Hoc></Hoc>, document.querySelector("#root"))

function render(){
    ReactDOM.render((
        // 1. 通过 Provider 将 store 导入到特定组件
        <Provider store={store}>
            <ReduxTest></ReduxTest>
        </Provider>
    ), document.querySelector("#root"))
}


render()

// 2. 不需要再注册和订阅 react 组件
// store.subscribe(render)