import React, { Component } from 'react'
import { Layout, Menu } from 'antd';
import { Link } from 'react-router-dom'
import Logo from '../../assets/images/logo192.png'
import './index.less'
import {
    UserOutlined,
    VideoCameraOutlined,
    UploadOutlined,
  } from '@ant-design/icons';
  
const { Sider } = Layout;

export default class LeftNav extends Component {
    render() {
        return (
            <Sider trigger={null} collapsible collapsed={this.props.collapsed}>
                <div className="logo" >
                    <Link className="left-nav-link">
                        <img src={Logo} alt="" />
                        <h2>小马哥后台</h2>
                    </Link>       
                    <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']}>
                        <Menu.Item key="1" icon={<UserOutlined />}>
                        nav 1
                        </Menu.Item>
                        <Menu.Item key="2" icon={<VideoCameraOutlined />}>
                        nav 2
                        </Menu.Item>
                        <Menu.Item key="3" icon={<UploadOutlined />}>
                        nav 3
                        </Menu.Item>
                    </Menu>
                </div>
            </Sider>
        )
    }
}
