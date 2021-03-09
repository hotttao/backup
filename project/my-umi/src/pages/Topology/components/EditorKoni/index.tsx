import { Col, Row } from 'antd';
import GGEditor, { Koni, withPropsAPI } from 'gg-editor';

import { PageContainer } from '@ant-design/pro-layout';
import React from 'react';
import {Button} from 'antd'
import { formatMessage } from 'umi';
import EditorMinimap from './components/EditorMinimap';
import { KoniContextMenu } from './components/EditorContextMenu';
import { KoniDetailPanel } from './components/EditorDetailPanel';
import { KoniItemPanel } from './components/EditorItemPanel';
import { KoniToolbar } from './components/EditorToolbar';
import styles from './index.less';

GGEditor.setTrackable(false);

// class TopoSave extends React.Component{
//   handleClick = () => {
//     const { propsAPI } = this.props;

//     console.log(propsAPI.save());
//   };

//   render() {
//     return (
//       <div style={{ padding: 8 }}>
//         <button onClick={this.handleClick}>保存</button>
//       </div>
//     );
//   }
// }

// withPropsAPI(TopoSave)

export default () => (
  <PageContainer
    content={formatMessage({
      id: 'topologyandcomponentsandeditorkoni.description',
      defaultMessage: 'description',
    })}
  >
    <GGEditor className={styles.editor}>
      
      <Row className={styles.editorHd}>
        <Col span={24}>
          <KoniToolbar />
        </Col>
      </Row>
      <Row className={styles.editorBd}>
        <Col span={2} className={styles.editorSidebar}>
          <KoniItemPanel />
        </Col>
        <Col span={16} className={styles.editorContent}>
          <Koni className={styles.koni} />
        </Col>
        <Col span={6} className={styles.editorSidebar}>
          <KoniDetailPanel />
          <EditorMinimap />
        </Col>
      </Row>
      <KoniContextMenu />
      <Save></Save>
    </GGEditor>
  </PageContainer>
);


class Save extends React.Component {
  handleClick = () => {
    const { propsAPI } = this.props;

    let topo = propsAPI.save();
    let link = topo?.edges || []
    let info = topo?.nodes
    let m = new Map()
    if (!(!!link && !!info)){
      console.log("台区拓扑不能为空")
      return
    }

    link = link.map((el:any) => {
      // console.log(el)
      m[el.target] = el.length
      return {
        from: el.source,
        to: el.target
      }
    })

    info = info.map((el:any) => {
      // console.log(el)
      return {
        node_id: el.id,
        type: el.type,
        line_length: m[el.id] || 4
      }
    })
    // console.log(m)
    // console.log(link)
    // console.log(info)
  };

  render() {
    return (
      <div style={{ padding: 8 }}>
        <Button type="primary" danger className={styles.submit} onClick={this.handleClick}>保存拓扑</Button> 
      </div>
    );
  }
}

Save = withPropsAPI(Save)

