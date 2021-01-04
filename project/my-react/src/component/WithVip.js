import React, { Component } from 'react'


const withAuth = role => Comp => { 
    
    return class extends Component {
        constructor(props) { 
            super(props)
            this.state = {
                'isAuth': false
            }
        }

        componentDidMount() { 
            const user = "VIP"
            this.setState({
                'isAuth': user === role
            })
        }
        render() {
            if (this.state.isAuth) {
                return (
                    <Comp {...this.props}></Comp>
                )
            } else { 
                return (
                    <div>
                        没有权限访问
                    </div>
                )
            }
            
        }
    }
    
}

@withAuth("VIP")
class PageA extends Component {
    render() {
        return (
            <div>
                Page A 页面
            </div>
        )
    }
}

@withAuth("Admin")
class PageB extends Component {
    render() {
        return (
            <div>
                Page B 页面
            </div>
        )
    }
}

export { PageB, PageA};