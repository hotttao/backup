import React, { Component } from 'react'

export default class CourseDetail extends Component {
    render() {
        const {match} = this.props
        return (
            <div>
                当前课程为: {match.params.courseName}
            </div>
        )
    }
}
