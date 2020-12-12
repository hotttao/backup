import ReactDOM from "react-dom"
import App from "./App"
import store from  './store'
import {Provider} from 'react-redux'

ReactDOM.render((
    <Provider store={store}>
        <App name="你好"/>
    </Provider>
), document.querySelector("#root"))


// ReactDOM.render((
//     <App name="你好"/>
// ), document.querySelector("#root"))