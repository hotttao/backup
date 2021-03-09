import { Request, Response } from 'express';

export default {
    "GET /api/topology/topology": (req: Request, res: Response) => {
        res.send({
            success: true,
            message: "OK",
            data: {
                strategy: [
                    {
                        name: "error_factory_normal", 
                        label: {
                            target: ['I_A'], 
                            meter_id: [1, 2],
                        },
                        param: {
                            mean: [0.0, 0.0],
                            variance: [0.1, 0.1]
                        }
                    },
                    
                ],
                link: [
                    {from: -1, to: 0},
                    {from: 0, to: 1},
                    {from:0, to: 2},
                    {from:1, to: 1000},
                    {from:2, to: 2000},
                    {from:2000, to: 2001}
                    
                ],
                info: [
                    {   
                        node_id: 0, 
                        type: 0, 
                        line_length: 0
                    },
                    {node_id: 1, type: 1, "line_length": 0},
                    {node_id: 2, type: 1, "line_length": 0},
                    {node_id: 1000, type: 2, "line_length": 4},
                    {node_id: 2000, type: 1, "line_length": 4},
                    {node_id: 2001, type: 2, "line_length": 4}
                ]
            }
        })
    },
    "GET /api/simulate/strategy": (req: Request, res: Response) => {
        res.send({
            success: true,
            message: "OK",
            data: [
                {
                    name: "amplifier",
                    description: "值放大器",
                    target_scope: [],
                    params: {
                        target: "目标属性",
                        multiple: "放大倍数"
                    }
                },
                {
                    name: "power_factory",
                    description: "功率因数设置",
                    target_scope: ['P_A', 'P_B', 'P_C'],
                    params: {
                        target: "目标属性",
                        lower: "功率因数下限",
                        upper: "功率因数上线"
                    }
                }
            ]
        })
    },
    "GET /api/simulate/output": (req: Request, res: Response) => {
        res.send({
            success: true,
            message: "OK",
            data: [
                {
                    name: "day_and_96_freeze",
                    description: "冻结数据转化输出",
                    params: {
                        index_96_freezing: "96点索引位置",
                        index_day_freezing: "日冻结索引位置"
                    }
                },
                {
                    name: "ui_data",
                    description: "UI数据转化输出",
                    params: {
                        ui_index: "UI数据索引位置"
                    }
                }
            ]
        })
    },
    "GET /api/simulate/simulate": (req: Request, res: Response) => {
        
    }
}

