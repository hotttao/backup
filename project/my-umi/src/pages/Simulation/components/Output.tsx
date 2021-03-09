import { Form, Input, Button, Select } from 'antd';
import { useRequest } from 'umi';
import {queryOutput} from '../service'

const { Option } = Select;

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 8, span: 16 },
};

const Output = (props) => {
  let {dispatchTopo} = props
  const {loading, data} = useRequest(queryOutput)
  let trans = data
  

  // 表单事件处理
  const [form] = Form.useForm();

  const onOutputChange = (value: string) => {
    console.log(value)
  };

  const onTransChange = (value: string) => {
    console.log(value)
  };

  const onFinish = (values: any) => {
    // console.log(values);
    const trans = values['trans']
    const save = values['save']
    let transOut = {trans: {name: trans, param: {}}, save_to: save}
    Object.keys(values).map(k => {
      if (!['trans', 'save'].includes(k)){
        transOut['trans']['param'][k] = values[k]
      }
    })
    // console.log(transOut)
    dispatchTopo({"type": "addOutput", transOut})
    onReset()
  };

  const onReset = () => {
    form.resetFields();
  };

  if (loading){
    return <div>
        策略加载中....
    </div>
}

  return (
    <Form {...layout} form={form} name="control-hooks" onFinish={onFinish}>
      <Form.Item name="trans" label="数据格式" rules={[{ required: true }]}>
        <Select
          placeholder="选择数据转换格式"
          onChange={onTransChange}
          allowClear
        >
            {trans.map((el: any)=>{
                return <Option value={el.name} key={el.name}>{el.description}</Option>
            })}
        </Select>
      </Form.Item>

      <Form.Item name="save" label="输出格式" rules={[{ required: true }]}>
        <Select
          mode="multiple"
          optionLabelProp="label"
          placeholder="选择数据输出类型"
          onChange={onOutputChange}
          allowClear
        >
            <Option value="csv" key="csv">CSV</Option>
            <Option value="elasticsearch" key="elasticsearch">Elasticsearch</Option>
        </Select>
      </Form.Item>
      
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.trans !== currentValues.trans}
      >
        {({ getFieldValue }) => {
            let selected = getFieldValue("trans")
            // console.log(trans, selected)
            let transArray = trans.filter((el:any) => {
                if (el.name === selected){
                    return el
                }
            })
            // console.log(selected, transArray)
            if (transArray.length > 0){
                let transDes = transArray[0]
                let params = transDes.params
                return Object.keys(params).map((el:string) => {
                    // console.log(el)
                    return (
                        <Form.Item key={el} name={el} label={params[el]} rules={[{ required: true }]}>
                            <Input></Input>
                        </Form.Item>
                    )
                })
            }
          return null;
        }}
      </Form.Item>
      <Form.Item {...tailLayout}>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
        <Button htmlType="button" onClick={onReset}>
          Reset
        </Button>
      </Form.Item>
    </Form>
  );
};

export default Output