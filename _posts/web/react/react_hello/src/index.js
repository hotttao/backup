import ReactDOM from "react-dom"
import App from "./App"
import Control, {UnCotrol} from "./Control"
import FormV from "./Form"
import CommentList from "./Components/CommentList"
import Compod from "./Components/Dialog"

ReactDOM.render(<App name="你好"/>, document.querySelector("#root"))
// ReactDOM.render(<UnCotrol></UnCotrol>, document.querySelector("#root"))
// ReactDOM.render(<FormV></FormV>, document.querySelector("#root"))

ReactDOM.render(<CommentList></CommentList>, document.querySelector("#root"))
ReactDOM.render(<Compod></Compod>, document.querySelector("#root"))