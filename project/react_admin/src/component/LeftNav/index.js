import React, { Component } from 'react'
import { Layout, Menu } from 'antd';
import { Link, withRouter } from 'react-router-dom'
import menuList from '../../config/menu'
import Logo from '../../assets/images/logo192.png'
import './index.less'
  
const { Sider } = Layout;
const { SubMenu } = Menu;

class LeftNav extends Component {
    getMenu = (menuList) => { 
        return menuList.map(item => { 
            // console.log(item.icon)
            
            if (item.children) {
                return (
                    <SubMenu key={item.key} icon={item.icon} title={item.title}>
                        { this.getMenu(item.children) }
                    </SubMenu>
                )
            } else { 
                return (
                    <Menu.Item key={item.key} icon={item.icon}>
                        <Link to={ item.key }>
                            <span>{ item.title }</span>
                        </Link> 
                    </Menu.Item>
                )
                
            }
        })
    }
    componentWillMount() { 
        this.menuComponent = this.getMenu(menuList)
    }
    render() {
        const defaultKey = this.props.location.pathname
        console.log(this.props)
        console.log(defaultKey)
        return (
            <Sider trigger={null} collapsible collapsed={this.props.collapsed}>
                <div className="logo" >
                    <Link className="left-nav-link" to='/home'>
                        <img src={Logo} alt="" />
                        <h2>小马哥后台</h2>
                    </Link> 
                    <Menu
                        defaultSelectedKeys={[defaultKey]}
                    defaultOpenKeys={['sub1']}
                    mode="inline"
                    theme="dark"
                    >
                        { this.menuComponent }
                    </Menu>
                    
                </div>
            </Sider>
        )
    }
}

export default withRouter(LeftNav)