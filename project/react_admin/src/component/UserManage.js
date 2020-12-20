import React, { Component } from 'react'
import { Modal } from 'antd';

export default class UserManager extends Component {
    state = {
      visible: false
    };
  
    showModal = () => {
      this.setState({
        visible: true,
      });
    };
  
    handleOk = () => {
        if (this.props.commit()) { 
            this.setState({ visible: false });
        }
    };
  
    handleCancel = () => {
      this.setState({ visible: false });
    };
  
    render() {
      const { visible } = this.state;
      return (
          <Modal
            visible={visible}
              title={ this.props.title}
            onOk={this.handleOk}
            onCancel={this.handleCancel}
          >
              {this.props.children}
          </Modal>
      );
    }
  }
