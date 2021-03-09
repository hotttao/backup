import {useState, useEffect} from 'react'
import {Form, Input, Button} from 'antd'
import React from 'react';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

import { useRequest } from "umi";
import {queryTopology} from '../service'


const IVS: React.FC = (props)=>{
  let {dispatchTopo} = props
  const [form] = Form.useForm();
  
  let [topoParam, setTopoParam] = useState({'type': '', 'meter_number': 0})
  const {run, loading} = useRequest(queryTopology, {
    manual: true,
    onSuccess: (result, params) => {
      console.log("重新发送请求")
      dispatchTopo({type: 'init', topo: result})   
      console.log("获取台区拓扑请求完成")
      form.resetFields();
    },
    onError: (error: Error, params: any[]) => {
      console.log("台区拓扑请求失败")
      console.log(error)
    }
  })
  
  const [, forceUpdate] = useState({}); // To disable submit button at the beginning.
  // console.log(topoParam)
  // let transTopo = useCallback(topo => {getTopology(topo)}, [topoParam['type'], topoParam['meter_number']])
  
  useEffect(() => {
    forceUpdate({});
  }, []);

  const onFinish = async (values:any) => {
    console.log('Finish:', values);
    setTopoParam(values)
    run(topoParam)
    
  };
  if (loading){
      return (
          <div>
              加载台区拓扑中
          </div>
      )
  }

  return (
      
      <div>
          <Form form={form} 
            name="horizontal_login" layout="inline" onFinish={onFinish}
            initialValues={{
              
            }}
            >
            <Form.Item
              name="type"
              rules={[
                {
                  required: true,
                  message: '请输入构建台区拓扑的方式!',
                },
              ]}
            >
              <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="台区拓扑构建方式" />
            </Form.Item>
            <Form.Item
              name="meter_number"
              rules={[
                {
                  required: true,
                  message: '请输入台区电能表数',
                },
              ]}
            >
              <Input
                prefix={<LockOutlined className="site-form-item-icon" />}
                placeholder="台区电能表数"
              />
            </Form.Item>

            {/* <Form.Item name="box">
              <Checkbox>是否分标箱</Checkbox>
            </Form.Item> */}

            <Form.Item shouldUpdate={true}>
              {() => (
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={
                    !form.isFieldsTouched(true) ||
                    !!form.getFieldsError().filter(({ errors }) => {return errors.length}).length
                  }
                >
                  获取台区拓扑
                </Button>
              )}
            </Form.Item>
          </Form>
      </div>
  )
}

export default IVS
