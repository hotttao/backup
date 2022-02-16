---
title: 9 Antd 组件设计
date: 2020-11-09
categories:
    - 前端
tags:
	- Vue
---
本节我们仿照 Antd 自己实现一个登陆表单
<!-- more -->

## 1. Antd 的表单示例
下面是一个从 Antd 摘录的横向登陆表单的创建示例:

```js
import React, { useState, useEffect } from 'react';
import { Form, Input, Button } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

const HorizontalLoginForm = () => {
  const [form] = Form.useForm();
  const [, forceUpdate] = useState({}); // To disable submit button at the beginning.

  useEffect(() => {
    forceUpdate({});
  }, []);

  const onFinish = (values) => {
    console.log('Finish:', values);
  };

  return (
    <Form form={form} name="horizontal_login" layout="inline" onFinish={onFinish}>
      <Form.Item
        name="username"
        rules={[
          {
            required: true,
            message: 'Please input your username!',
          },
        ]}
      >
        <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="Username" />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[
          {
            required: true,
            message: 'Please input your password!',
          },
        ]}
      >
        <Input
          prefix={<LockOutlined className="site-form-item-icon" />}
          type="password"
          placeholder="Password"
        />
      </Form.Item>
      <Form.Item shouldUpdate={true}>
        {() => (
          <Button
            type="primary"
            htmlType="submit"
            disabled={
              !form.isFieldsTouched(true) ||
              !!form.getFieldsError().filter(({ errors }) => errors.length).length
            }
          >
            Log in
          </Button>
        )}
      </Form.Item>
    </Form>
  );
};

export { HorizontalLoginForm }
```

从这个示例中我们可以看到:
1. Form 组件接收了一个 form 
2. Button 提交表单通过 form.getFieldsError() 获取校验状态来决定是否可以提交

由此可见 form 对象中收集了所有表单的验证的和校验结果，form 对象需要做如下几个事情:
1. 获取 Form.Item 组件的表单名称和验证规则
2. 为 Button 组件绑定 onChange 事件获取表单输入值，并进行校验收集验证状态
3. 提供 getFieldsError 方法返回最终的校验状态
4. isFieldsTouched 表示表单是否被触碰，通过表单的 onFocus 事件进行处理

综上所述，想要实现 Antd 的表单关键在于 form 对象以及如何在 Form 组件内获取其子组件 Form.Item 以及子子组件 Button 等表单组件的信息。


