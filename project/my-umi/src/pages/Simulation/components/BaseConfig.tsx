import { Form, Input, Button, Select, Row, Col, DatePicker, InputNumber } from 'antd';
import moment from 'moment';

const { RangePicker } = DatePicker;

const { Option } = Select;

const layout = {
  labelCol: { span: 8 },
  wrapperCol: { span: 16 },
};
const tailLayout = {
  wrapperCol: { offset: 8, span: 16 },
};

const BaseConfig = (props) => {
  let { dispatchTopo } = props;

  // 表单事件处理
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log(values);
    let baseConfig = {
      task: {
        task_id: values['task_id'],
        status: values['status'],
        description: values['descriptions'] || ""
      },
      tg: {
        days: values['days'],
        rate: values['rate'],
        meter_lose: values['meter_lose'],
        same_meter_num: values['same_meter_num'],
        result_start_time: values['result_start_time'].format('YYYY-MM-DD'),
      },
    };
    console.log('基础配置段', baseConfig);
    dispatchTopo({ type: 'addBaseConfig', baseConfig });
    onReset();
  };

  const onReset = () => {
    form.resetFields();
  };

  return (
    <Form
      {...layout}
      form={form}
      name="control-hooks"
      onFinish={onFinish}
      initialValues={{
        ['status']: 'ui',
        ['rate']: 6,
        days: 50,
        meter_lose: 5,
        same_meter_num: 0,
        result_start_time: moment('2019-01-01', 'YYYY-MM-DD'),
      }}
    >
      <Row>
        <Col span={10}>
          <Form.Item name="status" label="任务类型" rules={[{ required: true }]}>
            <Select placeholder="请选择仿真的任务类型" allowClear>
              <Option value="ui">低压台区仿真</Option>
              <Option value="freeze">国网线损异常仿真</Option>
              <Option value="relation">国网户变异常仿真</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="task_id" label="任务ID" rules={[{ required: true }]}>
            <Input></Input>
          </Form.Item>
        </Col>

        {/* <Form.Item name="status" label="任务类型" rules={[{ required: true }]}>
            <Space direction="vertical" size={8}>
                <RangePicker
                    // showTime={{ format: 'HH:mm:ss' }}
                    format="YYYY-MM-DD"
                    />
            </Space>
          </Form.Item> */}
        <Col span={6}>
          <Form.Item name="rate" label="线损率" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              max={100}
              formatter={(value) => `${value}%`}
              parser={(value) => value.replace('%', '')}
            />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item
            name="same_meter_num"
            label="相关性高的表的数量"
            rules={[{ type: 'integer', message: '天数必须为正整数' }]}
          >
            <InputNumber min={0} max={20} />
          </Form.Item>
        </Col>

        <Col span={8}>
          <Form.Item
            name="days"
            label="天数"
            rules={[{ required: true }, { type: 'integer', message: '天数必须为正整数' }]}
          >
            <InputNumber min={3} max={500} />
          </Form.Item>
        </Col>

        <Col span={6}>
          <Form.Item name="meter_lose" label="固损" rules={[{ required: true }]}>
            <InputNumber
              min={0}
              max={20}
              formatter={(value) => `${value}w`}
              parser={(value) => value.replace('w', '')}
            />
          </Form.Item>
        </Col>

        <Col span={10}>
          <Form.Item
            name="result_start_time"
            label="入库数据的开始日期"
            rules={[{ required: true }]}
          >
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="description"
            label="仿真任务简介"
          >
            <Input></Input>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item {...tailLayout}>
        <Row justify="end">
          <Col span={8}>
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </Col>
          <Col span={8}>
            <Button htmlType="button" onClick={onReset}>
              Reset
            </Button>
          </Col>
        </Row>
      </Form.Item>
    </Form>
  );
};

export default BaseConfig;
