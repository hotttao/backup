import { Form, Input, Button, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const NormalLoginForm = (props) => {
  const onFinish = (values) => {
    console.log('Received values of form: ', values);
  };

  return (
    <Form
      name="normal_login"
      className="login-form"
      initialValues={{
        remember: true,
      }}
      onFinish={props.reqLogin}
    >
      <Form.Item
              name="username"
              initialValue="admin"
        rules={[
          {
            required: true,
            whitespace: true,
            message: 'Please input your Username!',
          },
          // ({ getFieldValue }) => ({
          //   validator(rule, value, callback) {
          //     if (!value || getFieldValue('password') === value) {
          //       return Promise.resolve();
          //     }
          //     return Promise.reject('The two passwords that you entered do not match!');
          //   },
          // }),
          {
            validator: (_, value) =>
              value ? Promise.resolve() : Promise.reject('Should accept agreement'),
          }
        ]}
      >
        <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="Username" />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[
          {
            required: true,
            message: 'Please input your Password!',
          }, {
            pattern: /^[a-zA-Z0-9_]+$/,
            message: "不能包括特殊字符"
          },
        ]}
      >
        <Input
          prefix={<LockOutlined className="site-form-item-icon" />}
          type="password"
          placeholder="Password"
        />
      </Form.Item>
      
      <Form.Item>
            <Button type='primary' htmlType='submit' style={{'width': '100%'}}>登录</Button>        
      </Form.Item>
          
    </Form>
  );
};

export default NormalLoginForm