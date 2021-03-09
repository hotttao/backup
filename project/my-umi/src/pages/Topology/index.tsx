import { Tabs } from 'antd';
import React from 'react';
import EditorKoni from './components/EditorKoni'

const { TabPane } = Tabs;

function callback(key:any) {
  console.log(key);
}

const Topology: React.FC = () => {
  return (
      <Tabs defaultActiveKey="1" onChange={callback}>
          <TabPane tab="自定义拓扑" key="1">
            <EditorKoni></EditorKoni>  
            
          </TabPane>
          <TabPane tab="Tab 3" key="3">
          Content of Tab Pane 3
          </TabPane>
      </Tabs>
  )
};

export default Topology;