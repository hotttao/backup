import React, { Component } from 'react'
import {fetchMovie} from '../Hoc/WithFetch'


class MovieList extends Component {
    render(){
        return (
            <div>
                <ul>
                    {this.props.movieList.map((item, i)=>{
                        return <li key={i}>{item.movie}-{item.category}</li>
                    })}
                </ul>
            </div>
        )
    }
}


@fetchMovie("A")
export class MovieA extends Component {
    render() {
        return (
            <MovieList movieList={this.props.data}></MovieList>
        )
    }
}

@fetchMovie("B")
export class MovieB extends Component {
    render() {
        return (
            <MovieList movieList={this.props.data}></MovieList>
        )
    }
}
