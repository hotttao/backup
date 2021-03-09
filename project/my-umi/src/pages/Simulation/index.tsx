import styles from './index.less';
import {useReducer} from 'react'
import { Button, Tabs } from 'antd';
import SetConfig from './components/Strategy'
import GetTopo from  './components/GetTopo'
import Output from  './components/Output'
import BaseConfig from  './components/BaseConfig'
import {reducerTopo, initTopo, db2Gojs, trans2SimulationConfig} from './reducer'
import IVS from '../../components/IVS'

const { TabPane } = Tabs;


const TopologyTab: React.FC = () => {
  let [topo, dispatch] = useReducer(reducerTopo, null, initTopo)
  let gojsData = db2Gojs(topo)
  console.log("仿真页加载: ", topo)
  // console.log(gojsData)

  const commitSimulate = ()=>{
    const config = trans2SimulationConfig(topo)
    console.log(config)
  }

  const downConfig = ()=> {
    const config = trans2SimulationConfig(topo)
    console.log(config)
  }
  return (
    <div>
        <Tabs defaultActiveKey="1" className={styles.configTab}>
          <TabPane tab="基础配置" key="1">
            <div className={styles.multiSettings}>
              <BaseConfig dispatchTopo={dispatch}></BaseConfig>
            </div>
          </TabPane>
          <TabPane tab="输出配置" key="2">
            < div className={styles.settings}>
                <Output dispatchTopo={dispatch}></Output>
              </div>
          </TabPane>
          <TabPane tab="策略配置" key="3">
            <div className={styles.settings}>
              <SetConfig dispatchTopo={dispatch} gojsData={gojsData}></SetConfig> 
            </div>
          </TabPane>
          <TabPane tab="加载台区拓扑" key="4">
              <GetTopo dispatchTopo={dispatch}></GetTopo>
          </TabPane>
      </Tabs>
      <div className={styles.ivs}>
        <IVS gojsData={gojsData}></IVS>
      </div>

      <Button type="primary" danger className={styles.submit} onClick={commitSimulate}>提交仿真任务</Button> 
      <Button danger onClick={downConfig}>下载配置文件</Button>
    </div>
  );
};

export default TopologyTab;
