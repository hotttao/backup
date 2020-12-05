import React, { Component,PureComponent } from 'react'


// // 1. 更改组件继承的类
// class Comment extends PureComponent{
//     render(){
//         const {id, author, content} = this.props
//         console.log("render")
//         return (
//             <div>
//                 <p>{id}</p>
//                 <p>{author}</p>
//                 <p>{content}</p>
//             </div>
//         )
//     }
// }

const Comment = React.memo(({id, author, content})=>{
    console.log("render")
    return (
        <div>
            <p>{id}</p>
            <p>{author}</p>
            <p>{content}</p>
        </div>
    )
})

export default class CommentList extends Component {
    constructor(props){
        super(props)
        this.state = {
            comments: []
        }
    }
    componentDidMount(){
        console.log("组件数据获取")
        setInterval(()=>{
            this.setState({
                comments: [
                    {
                        id: 1,
                        author: "facebook",
                        content: "react is good"
                    },
                    {
                        id: 2,
                        author: "由于西",
                        content: "vue is more good"
                    }
                ]
            })
        }, 2000)
        
    }
    
    render() {
        // console.log(this.state.comments)
        return (
            <div>
                {
                    this.state.comments.map(item=>{
                        // 更2. 改数据的传递方式
                        return <Comment key={item.id} {...item}></Comment>
                    })
                }
            </div>
        )
    }
}
