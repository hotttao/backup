import React, { Component } from 'react'
import { Switch, Link, BrowserRouter, Route, Prompt} from 'react-router-dom'

class Editor extends Component {
    constructor(props) { 
        super(props)
        this.state = {
            "isEditor": 0
        }
        this.editorMap = {
            0: "未修改",
            1: "修改进行中",
            2: "已经保存"
        }
    }
    handleChange = (e) => {
        this.setState({
            isEditor: 1
        })

    }
    handleSubmit = e => { 
        e.preventDefault();
        e.target.reset()
        this.setState({
            isEditor: 0
        })
        
    }
    render() {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    {/* 1. Prompt 组件在 when 属性为 true 时，在跳转前就会用弹窗提示用户是否需要跳转 */}
                    {/* message 就是提示信息，其是一个接受 location 对象的函数 */}
                    <Prompt
                        when={this.state.isEditor > 0}
                        message={ location=>`当前页面编辑未保存，确定要跳转至${location.pathname}么？`} >    
                    </Prompt>
                    <h3>编辑状态: {this.editorMap[this.state.isEditor]}</h3>
                    <input type="text" onChange={this.handleChange} />
                    <button>提交</button>
                </form>
                
            </div>
        )
    }
}


class EditorA extends Component {
    render() {
        return (
            <div>
                A页
            </div>
        )
    }
}

class EditorB extends Component {
    render() {
        return (
            <div>
                B页
            </div>
        )
    }
}


export default class BlockBack extends Component {
    render() {
        return (
            <BrowserRouter>
                <div>
                    <ul>
                        <li><Link to="/editor">编辑</Link></li>
                        <li><Link to="/editor/a">编辑A</Link></li>
                        <li><Link to="/editor/b">编辑B</Link></li>
                    </ul>
                </div>
                <Switch>
                    <Route exact path="/editor" component={ Editor}></Route>
                    <Route path="/editor/a" component={ EditorA}></Route>
                    <Route path="/editor/b" component={ EditorB}></Route>
                </Switch>
            </BrowserRouter>
            
            
        )
    }
}
