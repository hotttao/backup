export const initTopo = ()=>{
    return {
        strategy: [],
        link: [],
        info: [],
        output: [],
        default: {},
        tg: {},
        task: {}
    }
    
};

export function reducerTopo(state, action:any) {
  switch (action.type) {
    case 'reset':
        return initTopo();
    case 'init':
        let topo = initTopo()
        topo = {...topo, ...action.topo}
        console.log("初始化台区拓扑:", topo)
        return topo
    case 'addStrategy':
        let newState = {...state, strategy: [...state['strategy'], action.strategy]}
        console.log("添加策略配置段:", newState)
        return newState
    case 'addOutput':
        if (!('output' in state)){
            state['output'] = []
        }
        newState = {...state, output: [...state['output'], action.transOut]}
        console.log("添加输出配置段:", newState)
        return newState
    case 'addBaseConfig':
        newState = {...state, ...action.baseConfig}
        console.log("添加基础配置段:", newState)
        return newState
    default:
        throw new Error();
  }
}


export function db2Gojs(topoConfig: any){
    // 返回 gojs 展示台区拓扑所需的数据格式s
    let nodeDataArray = []
    let linkDataArray = []
    let strategyArray = []
    
    if (topoConfig){
        let {link, info, strategy} = topoConfig
        strategyArray = strategy
        
        nodeDataArray = info.map(el=>{
            let nodeInfo = {key: el.node_id, question: String(el.node_id)}
            // if (el.type === 2){
            // nodeInfo['category'] = 'Terminal'
            // nodeInfo['text'] = el.node_id
            return nodeInfo
            }
        )
        linkDataArray = link
        strategy2Action(nodeDataArray, strategyArray)
    }
    return {nodeDataArray, linkDataArray, strategyArray}
}


export function strategy2Action(nodeDataArray:any, strategyArray:any){
    // 将策略信息转换为 Gojs 的 Action
    let strategy_map = new Map()
    strategyArray.forEach(el => {
        let meter_ids = el?.label?.meter_id
        if (meter_ids){
            for (let index in meter_ids){
                let i = meter_ids[index]
                if (!(i in strategy_map)){
                    strategy_map[i] = []
                }
                let actions = strategy_map[i]
                let target = (el?.label?.target || []).join(',')
                let desc = {'text': `${el.name}(${target})`}
                actions.push(desc)
            }
        }
    });
    // console.log(strategy_map)
    // console.log(strategyArray)
    nodeDataArray = nodeDataArray.map(el=>{
        if (el.key in strategy_map){
            let actions = el?.actions || []
            actions.push(...strategy_map[el.key])
            el['actions'] = actions
        }
        return el
    })
    // console.log(nodeDataArray)
    return {nodeDataArray, strategyArray}
}


export function trans2SimulationConfig(topo:any){
    // 输出后台接收的仿真仿真配置文件
    let config =  {
        TASK: topo['task'],
        TOPOLOGY: {
            link: topo['link'],
            info: topo['info']
        },
        DEFAULT: topo['default'],
        TG: topo['tg'],
        OUTPUT: topo['output'],
        UI_SIMULATION: topo['strategy']
    }
    let description = topo['task']?.description || ""

    return {config, description}
}

export var nodeDataExample = [
    {
    key: 1, question: "Greeting",
    actions: [
        { text: "Sales", figure: "ElectricalHazard", fill: "blue" },
        { text: "Parts and Services", figure: "FireHazard", fill: "red" },
        { text: "Representative", figure: "IrritationHazard", fill: "yellow" }
    ]
    },
    {
    key: 2, question: "Sales",
    actions: [
        { text: "Compact", figure: "ElectricalHazard", fill: "blue" },
        { text: "Mid-Size", figure: "FireHazard", fill: "red" },
        { text: "Large", figure: "IrritationHazard", fill: "yellow" }
    ]
    },
    {
    key: 3, question: "Parts and Services",
    actions: [
        { text: "Maintenance", figure: "ElectricalHazard", fill: "blue" },
        { text: "Repairs", figure: "FireHazard", fill: "red" },
        { text: "State Inspection", figure: "IrritationHazard", fill: "yellow" }
    ]
    },
    { key: 4, question: "Representative" },
    { key: 5, question: "Compact" },
    { key: 6, question: "Mid-Size" },
    {
    key: 7, question: "Large",
    actions: [
        { text: "SUV", figure: "ElectricalHazard", fill: "blue" },
        { text: "Van", figure: "FireHazard", fill: "red" }
    ]
    },
    { key: 8, question: "Maintenance" },
    { key: 9, question: "Repairs" },
    { key: 10, question: "State Inspection" },
    { key: 11, question: "SUV" },
    { key: 12, question: "Van" },
    { key: 13, category: "Terminal", text: "Susan" },
    { key: 14, category: "Terminal", text: "Eric" },
    { key: 15, category: "Terminal", text: "Steven" },
    { key: 16, category: "Terminal", text: "Tom" },
    { key: 17, category: "Terminal", text: "Emily" },
    { key: 18, category: "Terminal", text: "Tony" },
    { key: 19, category: "Terminal", text: "Ken" },
    { key: 20, category: "Terminal", text: "Rachel" }
];

export var linkDataExample = [
    { from: 1, to: 2, answer: 1 },
    { from: 1, to: 3, answer: 2 },
    { from: 1, to: 4, answer: 3 },
    { from: 2, to: 5, answer: 1 },
    { from: 2, to: 6, answer: 2 },
    { from: 2, to: 7, answer: 3 },
    { from: 3, to: 8, answer: 1 },
    { from: 3, to: 9, answer: 2 },
    { from: 3, to: 10, answer: 3 },
    { from: 7, to: 11, answer: 1 },
    { from: 7, to: 12, answer: 2 },
    { from: 5, to: 13 },
    { from: 6, to: 14 },
    { from: 11, to: 15 },
    { from: 12, to: 16 },
    { from: 8, to: 17 },
    { from: 9, to: 18 },
    { from: 10, to: 19 },
    { from: 4, to: 20 }
];
