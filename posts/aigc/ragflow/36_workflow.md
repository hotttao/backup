---
weight: 1
title: "RagFlow Workflow"
date: 2025-08-20T16:00:00+08:00
lastmod: 2025-08-20T16:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow Workflow"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

## RAGFlow Workflow 相关代码分析

### 1. Workflow 创建流程

#### 前端代码
**主要文件位置：**
- `web/src/pages/agent/` - 代理页面主目录
- `web/src/pages/agent/canvas/` - 工作流画布组件
- `web/src/pages/agent/store.ts` - 状态管理
- `web/src/services/agent-service.ts` - API服务

**核心组件：**

1. **画布组件** (`web/src/pages/agent/canvas/index.tsx`)
   - 基于 ReactFlow 实现可视化工作流编辑
   - 支持节点拖拽、连接和参数配置
   - 包含多种节点类型：Begin、Agent、Tool、Categorize、Switch等

2. **节点组件** (`web/src/pages/agent/canvas/node/`)
   - AgentNode - 代理节点
   - BeginNode - 开始节点  
   - ToolNode - 工具节点
   - MessageNode - 消息节点
   - 各种业务逻辑节点

3. **状态管理** (`web/src/pages/agent/store.ts`)
   - 管理节点和边的状态
   - 提供节点创建、更新、删除操作
   - 同步画布数据到DSL格式

#### 后端接口

**主要API端点** (`api/apps/canvas_app.py`)：

```python
# 保存工作流
@manager.route('/set', methods=['POST'])
def save():
    # 保存DSL配置和版本管理
    
# 获取工作流详情
@manager.route('/get/<canvas_id>', methods=['GET']) 
def get(canvas_id):
    # 返回工作流配置

# 工作流模板
@manager.route('/templates', methods=['GET'])
def templates():
    # 返回预设模板列表
```

**DSL数据结构：**
```json
{
  "components": {
    "begin": {
      "obj": {
        "component_name": "Begin",
        "params": {}
      },
      "downstream": ["node_id"],
      "upstream": []
    }
  },
  "history": [],
  "path": [],
  "globals": {}
}
```

### 2. Workflow 执行流程

#### 前端发起执行

**执行触发** (`web/src/pages/agent/index.tsx`)：
- 用户点击"运行"按钮
- 触发 [handleRunAgent](file://d:\Code\rag\ragflow\web\src\pages\agent\run-sheet\index.tsx#L31-L43) 函数
- 通过 [useSaveGraphBeforeOpeningDebugDrawer](file://d:\Code\rag\ragflow\web\src\pages\agent\hooks\use-save-graph.ts#L33-L53) 保存图形并重置状态

**运行相关Hooks** (`web/src/pages/agent/hooks/use-save-graph.ts`)：
```typescript
export const useSaveGraphBeforeOpeningDebugDrawer = (show: () => void) => {
  const { saveGraph, loading } = useSaveGraph();
  const { resetAgent } = useResetAgent();

  const handleRun = useCallback(
    async (nextNodes?: RAGFlowNodeType[]) => {
      const saveRet = await saveGraph(nextNodes);
      if (saveRet?.code === 0) {
        const resetRet = await resetAgent();
        if (resetRet?.code === 0) {
          show(); // 显示聊天界面
        }
      }
    },
    [saveGraph, resetAgent, show],
  );

  return { handleRun, loading };
};
```

**消息发送** (`web/src/pages/agent/chat/use-send-agent-message.ts`)：
- 通过 SSE 流式接口发送消息
- 处理实时响应和状态更新
- 管理聊天历史和参考文档

#### 后端执行接口

**执行端点** (`api/apps/canvas_app.py`)：
```python
@manager.route('/completion', methods=['POST'])
def run():
    # 1. 验证权限和获取DSL
    e, cvs = UserCanvasService.get_by_id(req["id"])
    
    # 2. 创建Canvas实例
    canvas = Canvas(cvs.dsl, current_user.id, req["id"])
    
    # 3. SSE流式执行
    def sse():
        for ans in canvas.run(query=query, files=files, user_id=user_id, inputs=inputs):
            yield "data:" + json.dumps(ans, ensure_ascii=False) + "\n\n"
    
    return Response(sse(), mimetype="text/event-stream")
```

#### 核心执行引擎

**Canvas执行器** (`agent/canvas.py`)：
```python
class Canvas:
    def run(self, **kwargs):
        # 1. 初始化执行环境
        self.message_id = get_uuid()
        self.add_user_input(kwargs.get("query"))
        
        # 2. 设置全局变量
        for k in kwargs.keys():
            if k in ["query", "user_id", "files"] and kwargs[k]:
                self.globals[f"sys.{k}"] = kwargs[k]
        
        # 3. 执行工作流路径
        while idx < len(self.path):
            # 批量执行组件
            _run_batch(idx, to)
            
            # 处理组件输出
            for i in range(idx, to):
                cpn_obj = self.get_component_obj(self.path[i])
                
                # 根据组件类型处理下游路径
                if cpn_obj.component_name.lower() == "categorize":
                    _extend_path(cpn_obj.output("_next"))
                elif cpn_obj.component_name.lower() == "iteration":
                    _append_path(cpn_obj.get_start())
                # ... 其他组件类型处理
                
            # 错误处理和状态更新
            if self.error:
                break
                
        # 4. 返回执行结果
        yield decorate("workflow_finished", {
            "inputs": kwargs.get("inputs"),
            "outputs": self.get_component_obj(self.path[-1]).output(),
            "elapsed_time": time.perf_counter() - st
        })
```

### 3. 核心组件系统

**组件基类** (`agent/component/base.py`)：
- 所有工作流组件都继承自 [ComponentBase](file://d:\Code\rag\ragflow\agent\component\base.py#L392-L558)
- 提供统一的参数验证、执行接口
- 支持输入输出管理和错误处理

**具体组件实现** (`agent/component/`)：
- [begin.py](file://d:\Code\rag\ragflow\agent\component\begin.py) - 开始组件
- [agent_with_tools.py](file://d:\Code\rag\ragflow\agent\component\agent_with_tools.py) - 带工具的代理组件
- [categorize.py](file://d:\Code\rag\ragflow\agent\component\categorize.py) - 分类组件
- [switch.py](file://d:\Code\rag\ragflow\agent\component\switch.py) - 开关组件
- [iteration.py](file://d:\Code\rag\ragflow\agent\component\iteration.py) - 迭代组件
- [message.py](file://d:\Code\rag\ragflow\agent\component\message.py) - 消息组件

### 4. 前端状态管理

**Graph Store** (`web/src/pages/agent/store.ts`)：
- 使用 Zustand 管理画布状态
- 提供节点和边的CRUD操作
- 同步前端状态到后端DSL格式

**数据流转：**
1. 用户在画布上操作 → 更新 Graph Store
2. 自动保存触发 → 调用 [buildDslData](file://d:\Code\rag\ragflow\web\src\pages\flow\hooks\use-build-dsl.ts#L10-L25) 转换为DSL
3. 发送到后端 → 保存到数据库
4. 执行时 → 后端加载DSL → Canvas执行引擎运行

### 5. 关键API接口总结

**创建相关：**
- `POST /canvas/set` - 保存工作流
- `GET /canvas/templates` - 获取模板
- `GET /canvas/get/<canvas_id>` - 获取工作流详情

**执行相关：**
- `POST /canvas/completion` - 执行工作流（SSE流式）
- `POST /canvas/reset` - 重置工作流状态
- `GET /canvas/trace` - 获取执行日志

这个系统实现了完整的可视化工作流编辑、保存和执行流程，前后端通过DSL格式进行数据交换，支持实时流式执行和日志跟踪。