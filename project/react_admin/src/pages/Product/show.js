import React, { Component } from 'react'
import { Button } from 'antd'
import { withRouter } from 'react-router-dom'

import RichTextEditor from '../../component/RichTextEditor'

class ProductShow extends Component {
    render() {
        return (
            <div>

                <Button onClick={() => { this.props.history.push('/product/update')}}>修改</Button>
                <Button onClick={() => { this.props.history.push('/product/detail/aaaa')}}>详情</Button>
                <RichTextEditor></RichTextEditor>
            </div>
        )
    }
}

export default withRouter(ProductShow)