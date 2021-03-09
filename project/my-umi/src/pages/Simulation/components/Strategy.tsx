import { Form, Input, Button, Select } from 'antd';
import { useRequest } from 'umi';
import {queryStrategy} from '../service'

const TARGET_DEFAULT_SCOPE = ['I_A', 'I_B', 'I_C']

const { Option } = Select;

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 8, span: 16 },
};

const Demo = (props) => {
  let {gojsData, dispatchTopo} = props
  let meterArray = gojsData?.nodeDataArray||[]
  const {loading, data} = useRequest(queryStrategy)
  let strategy = data
  

  // 表单事件处理
  const [form] = Form.useForm();
  const onStrategyChange = (value: string) => {
    console.log(value)
  };

  const onMeterChange = (value: string) => {
    console.log(value)
  };

  const onTargetChange = (value: string) => {
    console.log(value)
  };

  const onFinish = (values: any) => {
    // console.log(values);
    const name = values['strategy']
    const meter_id = values['meter_id']
    const target = values['target']
    let strategy  = {name, label: {meter_id, target}, params: {}}
    Object.keys(values).map(k => {
      if (!['strategy', 'meter_id', 'target'].includes(k)){
        strategy['params'][k] = values[k]
      }
    })
    console.log("添加策略", strategy)
    dispatchTopo({"type": "addStrategy", strategy})
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
      <Form.Item name="strategy" label="策略" rules={[{ required: true }]}>
        <Select
          placeholder="选择仿真策略"
          onChange={onStrategyChange}
          allowClear
        >
            {strategy.map((el: any)=>{
                return <Option value={el.name} key={el.name}>{el.description}</Option>
            })}
        </Select>
      </Form.Item>
      <Form.Item name="meter_id" label="目标电能表" rules={[{ required: true }]}>
        <Select
            placeholder="选择仿真策略的目标电能表"
            onChange={onMeterChange}
            allowClear
            mode="multiple"
            optionLabelProp="label"
          >
              {meterArray.map((el: any)=>{
                  return <Option value={el.key} key={el.key}>{el.key}</Option>
              })}
        </Select>
      </Form.Item>
      
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.strategy !== currentValues.strategy}
      >
        {({ getFieldValue }) => {
            let selected = getFieldValue('strategy')
            // console.log(strategy, selected)
            let paramsArray = strategy.filter((el:any) => {
                if (el.name === selected){
                    return el
                }
            })
            // console.log(selected, paramsArray)
            if (paramsArray.length > 0){
                let paramDes = paramsArray[0]
                let params = paramDes.params
                let target_scope = paramDes?.target_scope || TARGET_DEFAULT_SCOPE
                // console.log(target_scope, paramDes)
                return Object.keys(params).map((el:string) => {
                    // console.log(el)
                    let d = <Input />
                    if (el === 'target'){
                        if (target_scope.length == 0){
                          target_scope = TARGET_DEFAULT_SCOPE
                        }
                        d = (
                          <Select
                              placeholder="目标属性"
                              onChange={onTargetChange}
                              allowClear
                              mode="multiple"
                              optionLabelProp="label"
                            >
                                {target_scope.map((scope: any)=>{
                                    return <Option value={scope} key={scope}>{scope}</Option>
                                })}
                          </Select>
                        )
                    }
                    return (
                        <Form.Item key={el} name={el} label={params[el]} rules={[{ required: true }]}>
                            {d}
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

export default Demo