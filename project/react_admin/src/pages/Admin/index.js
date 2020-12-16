import React, { Component } from 'react'
import { Layout } from 'antd';

import { Redirect, Switch, Route } from 'react-router-dom'
import userStore from '../../utils/storage'
import LeftNav from '../../component/LeftNav'

import Home from '../Home/home';
import Category from '../Category/category';
import Product from '../Product/product';
import Role from '../Role/role';
import User from '../User/user';
import Bar from '../Charts/bar';
import Line from '../Charts/line';
import Pie from '../Charts/pie';

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
                    <Switch>
                        <Route path='/home' component={Home}></Route>
                        <Route path='/category' component={Category}></Route>
                        <Route path='/product' component={Product} />
                        <Route path='/role' component={Role} />
                        <Route path='/user' component={User} />
                        <Route path='/charts/bar' component={Bar} />
                        <Route path='/charts/line' component={Line} />
                        <Route path='/charts/pie' component={Pie} />
                        <Redirect to='/home' />
                    </Switch>
                </Content>
                <Footer style={{ textAlign: 'center' }}>Ant Design ©2018 Created by Ant UED</Footer>
    
                </Layout>
            </Layout>
        )
    }
}
