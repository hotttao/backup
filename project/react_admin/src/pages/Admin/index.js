import React, { Component } from 'react'
import { Layout } from 'antd';

import { Redirect } from 'react-router-dom'
import userStore from '../../utils/storage'
import LeftNav from '../../component/LeftNav'

import {
    MenuUnfoldOutlined,
    MenuFoldOutlined,
  } from '@ant-design/icons';
  
const { Header, Sider, Content, Footer } = Layout;

export default class Admin extends Component {
    state = {
        collapsed: false,
      };
    
      toggle = () => {
        this.setState({
          collapsed: !this.state.collapsed,
        });
    };
    
    render() {
        return (
            <Layout style={{'height': '100%'}}>
                <LeftNav collapsed={ this.state.collapsed }></LeftNav>
                <Layout className="site-layout">
                <Header className="site-layout-background" style={{ padding: 0 }}>
                        {React.createElement(this.state.collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
                            className: 'trigger',
                            onClick: this.toggle,
                            style: {'color': 'white'}
                    })}
                </Header>
                <Content
                    className="site-layout-background"
                    style={{
                    margin: '24px 16px',
                    padding: 24,
                    minHeight: 280,
                    }}
                >
                        Content
                </Content>
                <Footer style={{ textAlign: 'center' }}>Ant Design ©2018 Created by Ant UED</Footer>
    
                </Layout>
            </Layout>
        )
    }
}
