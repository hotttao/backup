import React, { Component } from 'react'



export const fetchMovie = (fetch) => (Comp) =>{
    return class extends Component{
        constructor(props){
            super(props)
            this.state = {
                movies: []
            }
        }

        componentDidMount(){
            if (fetch === "A") {
                this.setState({
                    movies: [
                        {
                            'id': 1,
                            'movie': "夏洛特烦恼",
                            'category': "A"
                        }
                    ]
                })
            } else if (fetch === "B") {
                this.setState({
                    movies: [
                        {
                            'id': 1,
                            'movie': "黄飞红",
                            'category': "B"
                        }
                    ]
                })
            }
        }

        render(){
            return (
                <div>
                    <Comp {...this.props} data={this.state.movies}></Comp>
                </div>
            )
        }
    }
}