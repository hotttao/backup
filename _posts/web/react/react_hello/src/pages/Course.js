import React, { Component } from 'react'
import {Link, Route} from 'react-router-dom'
import CourseDetail from './CourseDetail'
import CourseIndex from './CourseIndex'

export default class Course extends Component {
    render() {
        console.log(this.props)
        return (
            <div>
                {/* 1. 实现二级路由 */}
                <ul>
                    {/* 2. 使用 Link 表示路由 */}
                    {/* 3. Link 中包含了三个属性 location, match, history 三个属性 */}
                    {/* match 中包含了当前的路由信息，和 url 参数 */}
                    <li><Link to={`${this.props.match.url}/python`}>Python</Link></li>
                    <li><Link to="/course/goland">GoLang</Link></li>
                    <li><Link to="/course/javascript">Javascript</Link></li>
                </ul>
                {/* 4. 配置路由 */}
                {/* 与 vue 类似，同样可以设置路由参数，复用组件 */}
                <Route path="/course/:courseName" component={CourseDetail}></Route>
                {/* 5. 表示进入到 /course 二级根页面显示的信息 */}
                <Route exact path={this.props.match.path} component={CourseIndex}></Route>
            </div>
        )
    }
}
