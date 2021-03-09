import * as go from "gojs"
import {useState, useEffect} from 'react'
import {ReactDiagram} from 'gojs-react'
import {Form, Input, Button} from 'antd'
import React from 'react';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

import styles from './ivs.less';
import { useRequest } from "umi";
import {queryTopology} from '../service'
import TopoBuilder, {nodeDataExample, linkDataExample} from './ivs_util'

function initDiagram():go.Diagram {
    var $ = go.GraphObject.make;  // for conciseness in defining templates
    const myDiagram =
      $(go.Diagram, "myDiagramDiv",
        {
          allowCopy: false,
          "draggingTool.dragsTree": true,
          "commandHandler.deletesTree": true,
          layout:
            $(go.TreeLayout,
              { angle: 90, arrangement: go.TreeLayout.ArrangementFixedRoots }),
          "undoManager.isEnabled": true,
          model: $(go.GraphLinksModel,
            {
              linkKeyProperty: 'key',  // IMPORTANT! must be defined for merges and data sync when using GraphLinksModel
              // positive keys for nodes
              makeUniqueKeyFunction: (m: go.Model, data: any) => {
                let k = data.key || 1;
                while (m.findNodeDataForKey(k)) k++;
                data.key = k;
                return k;
              },
              // negative keys for links
              makeUniqueLinkKeyFunction: (m: go.GraphLinksModel, data: any) => {
                let k = data.key || -1;
                while (m.findLinkDataForKey(k)) k--;
                data.key = k;
                return k;
              }
            })
        });

    // when the document is modified, add a "*" to the title and enable the "Save" button
    myDiagram.addDiagramListener("Modified", function(e) {
      var button = document.getElementById("SaveButton");
      if (button) button.disabled = !myDiagram.isModified;
      var idx = document.title.indexOf("*");
      if (myDiagram.isModified) {
        if (idx < 0) document.title += "*";
      } else {
        if (idx >= 0) document.title = document.title.substr(0, idx);
      }
    });

    var bluegrad = $(go.Brush, "Linear", { 0: "#C4ECFF", 1: "#70D4FF" });
    var greengrad = $(go.Brush, "Linear", { 0: "#B1E2A5", 1: "#7AE060" });

    // each action is represented by a shape and some text
    var actionTemplate =
      $(go.Panel, "Horizontal",
        $(go.Shape,
          { width: 12, height: 12 },
          new go.Binding("figure"),
          new go.Binding("fill")
        ),
        $(go.TextBlock,
          { font: "10pt Verdana, sans-serif" },
          new go.Binding("text")
        )
      );

    // each regular Node has body consisting of a title followed by a collapsible list of actions,
    // controlled by a PanelExpanderButton, with a TreeExpanderButton underneath the body
    myDiagram.nodeTemplate =  // the default node template
      $(go.Node, "Vertical",
        new go.Binding("isTreeExpanded").makeTwoWay(),  // remember the expansion state for
        new go.Binding("wasTreeExpanded").makeTwoWay(), //   when the model is re-loaded
        { selectionObjectName: "BODY" },
        // the main "BODY" consists of a RoundedRectangle surrounding nested Panels
        $(go.Panel, "Auto",
          { name: "BODY" },
          $(go.Shape, "Rectangle",
            { fill: bluegrad, stroke: null }
          ),
          $(go.Panel, "Vertical",
            { margin: 3 },
            // the title
            $(go.TextBlock,
              {
                stretch: go.GraphObject.Horizontal,
                font: "bold 12pt Verdana, sans-serif"
              },
              new go.Binding("text", "question")
            ),
            // the optional list of actions
            $(go.Panel, "Vertical",
              { stretch: go.GraphObject.Horizontal, visible: false },  // not visible unless there is more than one action
              new go.Binding("visible", "actions", function(acts) {
                return (Array.isArray(acts) && acts.length > 0);
              }),
              // headered by a label and a PanelExpanderButton inside a Table
              $(go.Panel, "Table",
                { stretch: go.GraphObject.Horizontal },
                $(go.TextBlock, "Choices",
                  {
                    alignment: go.Spot.Left,
                    font: "10pt Verdana, sans-serif"
                  }
                ),
                $("PanelExpanderButton", "COLLAPSIBLE",  // name of the object to make visible or invisible
                  { column: 1, alignment: go.Spot.Right }
                )
              ), // end Table panel
              // with the list data bound in the Vertical Panel
              $(go.Panel, "Vertical",
                {
                  name: "COLLAPSIBLE",  // identify to the PanelExpanderButton
                  padding: 2,
                  stretch: go.GraphObject.Horizontal,  // take up whole available width
                  background: "white",  // to distinguish from the node's body
                  defaultAlignment: go.Spot.Left,  // thus no need to specify alignment on each element
                  itemTemplate: actionTemplate  // the Panel created for each item in Panel.itemArray
                },
                new go.Binding("itemArray", "actions")  // bind Panel.itemArray to nodedata.actions
              )  // end action list Vertical Panel
            )  // end optional Vertical Panel
          )  // end outer Vertical Panel
        ),  // end "BODY"  Auto Panel
        $(go.Panel,  // this is underneath the "BODY"
          { height: 17 },  // always this height, even if the TreeExpanderButton is not visible
          $("TreeExpanderButton")
        )
      );

    // define a second kind of Node:
    myDiagram.nodeTemplateMap.add("Terminal",
      $(go.Node, "Spot",
        $(go.Shape, "Circle",
          { width: 55, height: 55, fill: greengrad, stroke: null }
        ),
        $(go.TextBlock,
          { font: "10pt Verdana, sans-serif" },
          new go.Binding("text")
        )
      )
    );

    myDiagram.linkTemplate =
      $(go.Link, go.Link.Orthogonal,
        { deletable: false, corner: 10 },
        $(go.Shape,
          { strokeWidth: 2 }
        ),
        $(go.TextBlock, go.Link.OrientUpright,
          {
            background: "white",
            visible: false,  // unless the binding sets it to true for a non-empty string
            segmentIndex: -2,
            segmentOrientation: go.Link.None
          },
          new go.Binding("text", "answer"),
          // hide empty string;
          // if the "answer" property is undefined, visible is false due to above default setting
          new go.Binding("visible", "answer", function(a) { return (a ? true : false); })
        )
      );
    return myDiagram;
}


const IVS: React.FC = ()=>{
  let [topoParam, setTopoParam] = useState({'type': '', 'meter_number': 0})
  const {data, run, loading } = useRequest(queryTopology, {manual: true})
  const [form] = Form.useForm();
  const [, forceUpdate] = useState({}); // To disable submit button at the beginning.
  
  useEffect(() => {
    forceUpdate({});
  }, []);
  let nodeDataArray = nodeDataExample
  let linkDataArray = linkDataExample
  // let builder = new TopoBuilder([])
  
  if (!loading){
    if (data){
      console.log(data)
      const {link, info} = data
      nodeDataArray = info.map(el=>{
        let nodeInfo = {key: el.node_id, question: String(el.node_id)}
        if (el.type === 2){
          nodeInfo['category'] = 'Terminal'
          nodeInfo['text'] = el.node_id
        }
        return nodeInfo
      })
      linkDataArray = link
      
    }
    
  }

  const onFinish = async (values) => {
    console.log('Finish:', values);
    setTopoParam(values)
    run(topoParam)
    
  };

  console.log(linkDataArray)
  console.log(nodeDataExample)

  return (
      <div>
          <Form form={form} name="horizontal_login" layout="inline" onFinish={onFinish} className={styles.topoForm}>
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
                  获取台区拓扑
                </Button>
              )}
            </Form.Item>
          </Form>

          <div id="myDiagramDiv"></div>
          <ReactDiagram
              initDiagram={initDiagram}
              divClassName={styles.ivs}
              nodeDataArray={nodeDataArray}
              linkDataArray={linkDataArray}
          ></ReactDiagram>    
      </div>
  )
}


export default IVS



