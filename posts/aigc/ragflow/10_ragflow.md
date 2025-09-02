---
weight: 1
title: "RagFlow 框架"
date: 2025-08-20T08:00:00+08:00
lastmod: 2025-08-20T08:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "RagFlow 框架"
featuredImage: 

tags: ["RagFlow"]
categories: ["langchain"]

lightgallery: true

toc:
  auto: false
---

ragflow 相比于之前看的 deerflow 要复杂许多。这一节我们将从如下几个方面了解这个项目的整体结构:
1. 项目结构: 通过 ChatGpt 了解项目每个目录的作用
2. 环境搭建: 搭建测试环境，方便后续学习测试
3. 启动脚本: 了解项目的启动流程，便于后续读代码，找到切入口

## 1. 项目结构

- 核心定位：RAGFlow 是基于深度文档理解的 RAG 引擎，整合 LLM、检索、视觉解析、工作流编排与插件工具，提供端到端的问答与智能体能力。
- 主要组成：
  - 后端服务层：
    - `api/` 提供 HTTP/Web API、会话与数据管理；
    - `rag/` 实现 RAG 核心策略与流程；
    - `deepdoc/` 提供 OCR/布局/表格解析等深度文档理解；
    - `graphrag/` 图谱增强检索；
    - `agent/` + `agentic_reasoning/` 智能体工作流；
    - `sandbox/` 安全代码执行沙箱；
    - `plugin/` 插件框架；
    - `mcp/` MCP 集成。
  - 前端：`web/` React + TS 的管理与交互 UI。
  - 部署与运维：`docker/`、`helm/`、`conf/`。
  - SDK 与示例：`sdk/python/`、`example/`、`docs/`、`test/`、`intergrations/`。

### 1. 运行入口
- `api/ragflow_server.py`：
  - 初始化日志、配置与版本输出，加载插件，初始化数据库表与初始数据，注册 SMTP，启动 HTTP 服务。
  - 周期任务：通过 Redis 分布式锁触发 `DocumentService.update_progress()` 刷新解析/索引进度。
  - 信号处理：优雅关闭、释放 MCP 会话。


### 1.2 后端核心

#### api/
- 作用：后端 HTTP/Web 服务入口、路由注册、鉴权、数据访问与业务服务聚合。
- 关键入口
  - `ragflow_server.py`：见上。
  - `settings.py`：后端环境与配置初始化。
- 应用与路由
  - `apps/`
    - `api_app.py`：主 API 注册/蓝图装配。
    - `canvas_app.py`：与前端画布/工作流（Agent Canvas）相关接口。
    - `auth/`：鉴权模块
      - `oauth.py`：OAuth 通用流程
      - `github.py`：GitHub 登录
      - 其他鉴权文件（+2）
    - `sdk/`：对外 SDK 风格的接口
      - `agent.py`、`chat.py`、`dataset.py`、…：智能体、聊天、数据集等资源的 API 适配
    - 其他应用子目录（+15）：涵盖模型管理、会话、上传、检索、任务编排等路由
- 常量与工具
  - `constants.py`：全局常量
  - `utils/`：通用工具
    - `api_utils.py`、`base64_image.py`、…：请求工具、图片处理、日志等
- 数据访问层
  - `db/`
    - `db_models.py`：SQLAlchemy 数据模型定义
    - `db_utils.py`：数据库会话/工具
    - `services/`：业务服务层
      - `api_service.py`、`canvas_service.py`、…（+15）：面向路由的业务逻辑聚合（文档、知识库、检索、对话、任务状态等）
    - `init_data.py`：初始数据装载（由入口引用）
    - `runtime_config.py`：运行时配置（如 DEBUG、端口、依赖服务地址）
- 版本
  - `versions.py`：版本号/渠道（由入口读取展示）

#### rag/
- 作用：RAG 领域核心：检索、重排、生成、Prompt、对话流程与工具整合。
- 子模块
  - `app/`：应用级组合能力
    - `audio.py`、`book.py`、`…`（+12）：面向不同场景（音频、书籍等）的 RAG 流程封装
  - `llm/`：模型抽象
    - `chat_model.py`、`cv_model.py`、`…`：聊天/视觉模型统一封装与适配
  - `nlp/`
    - `query.py`、`rag_tokenizer.py`：查询处理、分词/切分
  - `prompts/`：Prompt 模板与相关脚本（大量 `.md`）
  - `svr/`：服务封装
    - `cache_file_svr.py`、`discord_svr.py`、`jina_server.py`：缓存/渠道/外部服务适配
  - `utils/`
    - `azure_*_conn.py`、`…`（+12）：云存储/鉴权、Redis、并发等工具
  - `benchmark.py`、`raptor.py`：基准/检索策略扩展（如 RAPTOR）

#### deepdoc/
- 作用：深度文档理解，包括 OCR、版面分析、表结构识别、跨格式解析。
- 文档
  - `README_zh.md`/`README.md`：视觉/解析器说明与试运行脚本
- 视觉
  - `vision/`
    - `ocr.py`：OCR 管线
    - `layout_recognizer.py`：版面分析（文本、标题、图、表、页眉页脚、公式等）
    - `…`（+7）：推理/可视化/模型装载等
- 解析器
  - `parser/`
    - `docx_parser.py`、`excel_parser.py`、`…`：多格式解析器
    - `resume/`：
      - `entities/`（+6）：简历领域实体定义
      - `step_one.py`、`step_two.py`：分步解析流程

#### graphrag/
- 作用：图谱增强型 RAG（实体抽取、关系生成、社区报告、轻量版管线）。
- 模块
  - `entity_resolution.py`、`entity_resolution_prompt.py`
  - `general/`：通用图抽取/报告生成
    - `community_reports_extractor.py`、`…`（+9）
  - `light/`：轻量图抽取流程
    - `graph_extractor.py`、`graph_prompt.py`、…

#### agent/
- 作用：智能体组件与画布编排执行。
- 顶层
  - `canvas.py`：工作流画布的结构/运行时编排
  - `settings.py`：Agent 配置
- 组件
  - `component/`
    - `base.py`：组件基类/协议
    - `agent_with_tools.py`：具工具调用能力的 Agent
    - 其他组件（+10）：如检索、生成、交互、改写、分类、关键词等（与文档 `docs/guides/agent/*` 对应）
- 工具
  - `tools/`：外部工具适配（由 Agent 调用）
    - 示例：`akshare.py`（财经数据）、`arxiv.py`、`…`（+19）
- 模板
  - `templates/`：Agent/工作流模板 JSON
    - 如 `choose_your_knowledge_base_agent.json`、`customer_review_analysis.json`、…
- 测试
  - `test/`：Agent 客户端与 DSL 示例

#### agentic_reasoning/
- 作用：更深入的推理/研究工作流。
- 模块
  - `deep_research.py`：Deep Research 风格的多步检索-聚合-总结
  - `prompts.py`：推理流程 Prompt

#### mcp/
- 作用：Model Context Protocol（MCP）集成。
- 结构
  - `server/server.py`：MCP 服务端
  - `client/`：客户端（`client.py`、`streamable_http_client.py`）
- 入口整合
  - 由 `rag.utils.mcp_tool_call_conn` 管理会话生命周期（入口负责关闭）

#### plugin/
- 作用：插件系统，通过 `GlobalPluginManager` 加载并扩展工具与能力。
- 模块
  - `llm_tool_plugin.py`、`embedded_plugins/llm_tools/bad_calculator.py`
  - `common.py`：插件接口/工具
  - 可扩展：外部插件包通过约定入口被加载

#### sandbox/
- 作用：安全的代码执行沙箱（依赖 gVisor）。
- 子服务：`executor_manager/` 独立微服务
  - `api/`：路由与处理器
  - `core/`：容器与环境管理
  - `models/`：API Schema、枚举
  - `services/`：执行/限流
  - `Dockerfile`、`requirements.txt`：隔离环境构建
  - `tests/`：安全测试
- 基础镜像：`sandbox_base_image/`（Node.js、Python 执行镜像）

### 1.3 前端与接口

#### web/
- 作用：前端 UI（React + TypeScript + Ant Design 风格）。
- 结构
  - `src/app.tsx`：应用入口
  - `components/`（50+）：对话、Agent 画布、数据集管理、模型管理等 UI 组件
  - `pages/`：路由页（聊天、AI 搜索、Agent、数据集、模型等）
  - `services/`：与后端交互的请求封装
  - `hooks/`、`utils/`、`constants/`、`locales/`：状态、工具、多语言
  - `public/`：静态资源
- 测试配置：`jest.config.ts`、`jest-setup.ts`

#### sdk/python/
- 作用：Python 客户端 SDK。
- 内容
  - `ragflow_sdk/`：SDK 包含会话、Agent、数据集、模型等模块
  - `hello_ragflow.py`：快速上手示例
  - `test/`：SDK 级测试与前后端 API 测试

#### docs/
- 作用：用户/开发者文档与参考。
- 范畴
  - 使用指南（Chat、Agent、Dataset、Models…）
  - 开发者指南（MCP、部署、配置）
  - 参考（HTTP API、Python API、术语表）
  - FAQ 与迁移指南等

#### example/
- 作用：示例脚本
  - `http/dataset_example.sh`、`sdk/dataset_example.py`：数据集/知识库示例

#### intergrations/
- 作用：第三方集成
  - `chatgpt-on-wechat/`：微信机器人插件
  - `extension_chrome/`：浏览器插件

### 1.4 基础设施与配置


#### docker/
- 作用：基于 Docker Compose 的一键部署与运维。
- 内容
  - `docker-compose*.yml`：含 CPU/GPU、中国镜像等多种编排
  - `nginx/`：反向代理配置
  - `service_conf.yaml.template`、`.env`（在 README 内详述）
  - 启动脚本与日志

#### helm/
- 作用：Kubernetes 部署 Chart
- `templates/`：ES/Infinity、MinIO、Redis、MySQL、Server 等模板与探针

#### conf/
- 作用：系统配置/映射文件
  - `llm_factories.json`：模型厂商/路由配置
  - `mapping.json`、`infinity_mapping.json`：索引/Schema/引擎映射
  - 其他 YAML/JSON

#### Dockerfile*（根目录）
- `Dockerfile`、`Dockerfile.deps`、`Dockerfile.scratch.oc9`：镜像构建（包含/不包含嵌入模型、精简版等）

### 1.5 测试与质量

#### test/
- 作用：端到端/HTTP/API/SDK 测试集合
- 结构
  - `testcases/`：按层次划分（http_api、sdk_api、web_api）
  - `utils/`、`libs/`：测试通用库（鉴权、文件工具、假设生成）

### 1.6 其他配套


#### agentic 设计配套文档
- `docs/guides/agent/*`：Agent 概念、组件、模板与编辑器说明

#### MCP 文档与客户端
- `docs/develop/mcp/*`、`mcp/client/*`：如何启动/使用 MCP

#### 版本与路线
- `README.md` 与 `docs/release_notes`、Roadmap issue：版本功能更新、差异与计划

#### 与外部依赖的关系
- 存储/检索：Elasticsearch 或 Infinity（二选一），MinIO（对象存储），MySQL（元数据），Redis（任务/缓存/锁），Nginx（代理）
- 模型：外部 LLM（OpenAI/Ollama/Xinference 等）+ 内置/外置 Embedding；DeepDoc 模型通过 HuggingFace 拉取或镜像替代

#### 跨模块协作简述
- 文档入库：前端上传 → `api` 持久化元数据与对象存储 → `deepdoc` 解析 → `rag` 切分/嵌入 → ES/Infinity 建索引 → `services` 更新进度 → Web 可视化分块/引用。
- 对话/检索：`api/apps` 路由调度 → `rag` 检索/重排/生成 → 可选 `graphrag`/Agent 工具 → 前端展示与追溯引用。
- Agent 工作流：前端画布 → `agent/canvas.py` 解析执行 → `agent/component/*` 节点 → `agent/tools/*` 工具调用 → `agentic_reasoning` 深研流程（可结合 Tavily/网络检索）。

## 2. 环境搭建
RagFlow 本地环境搭建还是比较复杂的，详细过程参考文档，这里记录踩坑过程
1. 前端项目缺少依赖包
2. 注意配置环境变量
3. 执行 `uv run download_deps.py` 添加 `--china-mirrors` 参数

```bash
# 前端缺少的依赖
@antv/g
@lexical/code
@lexical/rich-text
date-fns
katex
monaco-editor

# 配置环境变量
export UV_INDEX=https://mirrors.aliyun.com/pypi/simple
export HF_ENDPOINT=https://hf-mirror.com
```

## 3. 服务启动
服务启动执行的是 `bash docker/launch_backend_service.sh`，这个脚本会启动:
1. `api/ragflow_server.py`
2. `rag/svr/task_executor.py`

```bash
#!/bin/bash

# 如果任何命令返回非 0 状态码，立即退出脚本
set -e

# ====================== #
# 函数：加载 .env 环境变量 #
# ====================== #
load_env_file() {
    # 获取当前脚本所在的目录
    # BASH_SOURCE 是一个数组，保存了当前 脚本/函数的源文件名，即使是 source 进来的也能正确拿到
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local env_file="$script_dir/.env"

    # 如果 .env 文件存在，就加载其中的环境变量
    if [ -f "$env_file" ]; then
        echo "Loading environment variables from: $env_file"
        # set -a = allexport 启用后，所有定义的变量都会自动被 export 到环境变量
        set -a               # 自动导出变量
        source "$env_file"   # 加载 .env 文件
        set +a
    else
        echo "Warning: .env file not found at: $env_file"
    fi
}

# 调用函数，加载环境变量
load_env_file

# 清空 http/https 代理（避免 Docker 守护进程遗留的代理影响程序）
export http_proxy=""; export https_proxy=""; export no_proxy=""
export HTTP_PROXY=""; export HTTPS_PROXY=""; export NO_PROXY=""

# 设置 Python 搜索路径为当前目录
export PYTHONPATH=$(pwd)

# 设置动态库搜索路径（避免找不到依赖库）
export LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu/

# 使用 pkg-config 查找 jemalloc 库，并设置预加载路径
# 查询 jemalloc 库的安装路径（libdir，即库文件所在目录）
JEMALLOC_PATH=$(pkg-config --variable=libdir jemalloc)/libjemalloc.so

# 默认使用 python3 作为解释器
PY=python3

# 如果 WS（worker 数量）没有设置，或者小于 1，则默认设置为 1
if [[ -z "$WS" || $WS -lt 1 ]]; then
  WS=1
fi

# 每个进程最多重试 5 次
MAX_RETRIES=5

# 标志位：是否停止
STOP=false

# 用于记录子进程 PID 的数组
PIDS=()

# 设置 NLTK 数据目录（避免每次都联网下载）
export NLTK_DATA="./nltk_data"

# ============= #
# 函数：清理退出 #
# ============= #
cleanup() {
  echo "Termination signal received. Shutting down..."
  STOP=true
  # 遍历所有子进程 PID，逐个 kill
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Killing process $pid"
      kill "$pid"
    fi
  done
  exit 0
}

# 捕获 SIGINT (Ctrl+C) 和 SIGTERM (系统停止)，调用 cleanup
trap cleanup SIGINT SIGTERM

# ================================================= #
# 函数：启动 task_executor.py，并带有重试逻辑        #
# 参数：task_id                                      #
# ================================================= #
task_exe(){
    # 将函数参数 $1 赋给局部变量 task_id
    local task_id=$1
    local retry_count=0
    while ! $STOP && [ $retry_count -lt $MAX_RETRIES ]; do
        echo "Starting task_executor.py for task $task_id (Attempt $((retry_count+1)))"
        # 启动任务执行器，并预加载 jemalloc 库，减少内存碎片
        LD_PRELOAD=$JEMALLOC_PATH $PY rag/svr/task_executor.py "$task_id"
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            echo "task_executor.py for task $task_id exited successfully."
            break
        else
            echo "task_executor.py for task $task_id failed with exit code $EXIT_CODE. Retrying..." >&2
            retry_count=$((retry_count + 1))
            sleep 2
        fi
    done

    # 如果超过最大重试次数，调用 cleanup 停止所有进程
    if [ $retry_count -ge $MAX_RETRIES ]; then
        echo "task_executor.py for task $task_id failed after $MAX_RETRIES attempts. Exiting..." >&2
        cleanup
    fi
}

# ================================================= #
# 函数：启动 ragflow_server.py，并带有重试逻辑       #
# ================================================= #
run_server(){
    local retry_count=0
    while ! $STOP && [ $retry_count -lt $MAX_RETRIES ]; do
        echo "Starting ragflow_server.py (Attempt $((retry_count+1)))"
        $PY api/ragflow_server.py
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            echo "ragflow_server.py exited successfully."
            break
        else
            echo "ragflow_server.py failed with exit code $EXIT_CODE. Retrying..." >&2
            retry_count=$((retry_count + 1))
            sleep 2
        fi
    done

    if [ $retry_count -ge $MAX_RETRIES ]; then
        echo "ragflow_server.py failed after $MAX_RETRIES attempts. Exiting..." >&2
        cleanup
    fi
}

# ======================= #
# 启动多个 task_executor  #
# ======================= #
for ((i=0;i<WS;i++))
do
  task_exe "$i" &      # 后台运行
  PIDS+=($!)           # 保存子进程 PID
done

# 启动主服务器
run_server &
PIDS+=($!)

# 等待所有子进程结束
wait

```

## 4. deps
ragflow 系统初始化之前需要执行 `download_deps.py` 脚本，下载系统依赖。

```python
#!/usr/bin/env python3

# PEP 723 metadata
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub",
#   "nltk",
#   "argparse",
# ]
# ///

from huggingface_hub import snapshot_download
from typing import Union
import nltk
import os
import urllib.request
import argparse

def get_urls(use_china_mirrors=False) -> Union[str, list[str]]:
    if use_china_mirrors:
        return [
            "http://mirrors.tuna.tsinghua.edu.cn/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb",
            "http://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb",
            "https://repo.huaweicloud.com/repository/maven/org/apache/tika/tika-server-standard/3.0.0/tika-server-standard-3.0.0.jar",
            "https://repo.huaweicloud.com/repository/maven/org/apache/tika/tika-server-standard/3.0.0/tika-server-standard-3.0.0.jar.md5",
            "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
            ["https://registry.npmmirror.com/-/binary/chrome-for-testing/121.0.6167.85/linux64/chrome-linux64.zip", "chrome-linux64-121-0-6167-85"],
            ["https://registry.npmmirror.com/-/binary/chrome-for-testing/121.0.6167.85/linux64/chromedriver-linux64.zip", "chromedriver-linux64-121-0-6167-85"],
        ]
    else:
        return [
            "http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb",
            "http://ports.ubuntu.com/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb",
            "https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/3.0.0/tika-server-standard-3.0.0.jar",
            "https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/3.0.0/tika-server-standard-3.0.0.jar.md5",
            "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
            ["https://storage.googleapis.com/chrome-for-testing-public/121.0.6167.85/linux64/chrome-linux64.zip", "chrome-linux64-121-0-6167-85"],
            ["https://storage.googleapis.com/chrome-for-testing-public/121.0.6167.85/linux64/chromedriver-linux64.zip", "chromedriver-linux64-121-0-6167-85"],
        ]

repos = [
    "InfiniFlow/text_concat_xgb_v1.0",
    "InfiniFlow/deepdoc",
    "InfiniFlow/huqie",
    "BAAI/bge-large-zh-v1.5",
    "maidalun1020/bce-embedding-base_v1",
]

def download_model(repo_id):
    local_dir = os.path.abspath(os.path.join("huggingface.co", repo_id))
    os.makedirs(local_dir, exist_ok=True)
    snapshot_download(repo_id=repo_id, local_dir=local_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download dependencies with optional China mirror support')
    parser.add_argument('--china-mirrors', action='store_true', help='Use China-accessible mirrors for downloads')
    args = parser.parse_args()
    
    urls = get_urls(args.china_mirrors)
    
    for url in urls:
        download_url = url[0] if isinstance(url, list) else url
        filename = url[1] if isinstance(url, list) else url.split("/")[-1]
        print(f"Downloading {filename} from {download_url}...")
        if not os.path.exists(filename):
            urllib.request.urlretrieve(download_url, filename)

    local_dir = os.path.abspath('nltk_data')
    for data in ['wordnet', 'punkt', 'punkt_tab']:
        print(f"Downloading nltk {data}...")
        nltk.download(data, download_dir=local_dir)

    for repo_id in repos:
        print(f"Downloading huggingface repo {repo_id}...")
        download_model(repo_id)
```

下载的内容分成三个部分:
1. 使用  `urllib.request.urlretrieve` 下载的程序依赖
2. 使用 `nltk.download` 下载的 NLTK 数据目录
3. 使用 `snapshot_download` 下载的 huggingface 模型

### 4.1 程序依赖
程序依赖一下文件:

| 文件名                                      | 类型          | 说明 / 作用                                      |
| ---------------------------------------- | ----------- | -------------------------------------------- |
| `libssl1.1_1.1.1f-1ubuntu2_amd64.deb`    | Ubuntu 软件包  | OpenSSL 1.1 库，提供加密和 SSL/TLS 支持（x86_64 架构）   |
| `libssl1.1_1.1.1f-1ubuntu2_arm64.deb`    | Ubuntu 软件包  | OpenSSL 1.1 库，提供加密和 SSL/TLS 支持（ARM64 架构）     |
| `tika-server-standard-3.0.0.jar`         | Java JAR 文件 | Apache Tika 服务器端标准包，用于文档解析（文本、元数据、OCR 等）     |
| `tika-server-standard-3.0.0.jar.md5`     | 校验文件        | 对应 JAR 文件的 MD5 校验值，用于验证文件完整性                 |
| `cl100k_base.tiktoken`                   | 编码文件        | OpenAI 的 tiktoken 编码模型文件，用于将文本编码成 tokens     |
| `chrome-linux64-121-0-6167-85.zip`       | 浏览器压缩包      | 测试版 Chrome 浏览器二进制文件（Linux 64 位），用于自动化测试或爬虫   |
| `chromedriver-linux64-121-0-6167-85.zip` | 驱动压缩包       | 对应 ChromeDriver 二进制文件，用于驱动 Chrome 浏览器进行自动化操作 |


#### Tika Server
`Tika Server` 是 **Apache Tika** 提供的一个独立服务器版服务，它可以运行在独立的 JVM 上，通过 **HTTP 接口** 提供文档内容解析和元数据提取的功能。

简单说，Tika Server 就是把 Tika 的功能封装成一个 **HTTP 服务**，你不需要在自己的程序里直接调用 Java 代码，只需要通过 HTTP 请求就能解析文档。

---

**核心功能**

| 功能        | 说明                                                |
| --------- | ------------------------------------------------- |
| 文本提取      | 从各种文档格式中提取纯文本，例如 PDF、Word、Excel、HTML、PowerPoint 等 |
| 元数据提取     | 获取文档的元信息，如作者、创建时间、文件类型等                           |
| OCR 支持    | 对图片或扫描文档进行文字识别（需要 Tesseract OCR）                  |
| MIME 类型检测 | 自动识别文件类型                                          |
| 支持多种格式    | Office 文档、PDF、HTML、图片、音频、视频等                      |

---

**使用方式**

1. **启动 Tika Server**
   下载 JAR 后，在命令行运行：

   ```bash
   java -jar tika-server-standard-3.0.0.jar
   ```

   默认会启动在 `http://localhost:9998`。

2. **通过 HTTP 请求解析文件**
   例如使用 `curl` 提取文本：

   ```bash
   curl -T example.pdf http://localhost:9998/tika
   ```

   也可以提取元数据：

   ```bash
   curl -H "Accept: application/json" -T example.pdf http://localhost:9998/meta
   ```

---

* **Tika** = Java 库，用于文档解析
* **Tika Server** = Tika 的独立 HTTP 服务版本
* 适合 **不想在程序里直接依赖 Java 库，但想远程解析文档** 的场景

#### `cl100k_base.tiktoken

`cl100k_base.tiktoken` 是 OpenAI 提供的 **基础编码模型文件**，用于 `tiktoken` 库将文本转换成 **tokens**（分词后的数字化表示），它不是大模型本身，而是 **文本编码规则/字典**。

**核心作用**

| 文件                     | 功能                                                               |
| ---------------------- | ---------------------------------------------------------------- |
| `cl100k_base.tiktoken` | 提供基础的 **tokenization 编码规则**，将文本拆分为 token ID，用于 GPT 系列模型的输入和计费计算。 |

---

**背景解释**

* OpenAI 的模型（如 GPT-4、GPT-3.5）内部处理的是 **token**，而不是直接处理字符或单词。
* `tiktoken` 是官方提供的 **Python 编码器**，用来把文本转成 token（模型可以理解的数字序列），或者把 token 转回文本。
* `cl100k_base` 是 OpenAI GPT-4/3.5 默认使用的 **基础编码表**，包含了常见字符、符号的编码方式。

---

**使用示例（Python）**

```python
import tiktoken

# 加载编码
encoding = tiktoken.get_encoding("cl100k_base")

text = "Hello, world!"
tokens = encoding.encode(text)
print(tokens)  # 输出 token ID 列表

decoded = encoding.decode(tokens)
print(decoded)  # 输出原始文本 "Hello, world!"
```

---

总结：

* 它是 **tokenizer 的核心文件**
* 不含模型权重，只负责 **文本 ↔ token 的映射**
* GPT 模型的输入必须先经过它编码成 token

### 4.2 nltk
`nltk_data` 是 **NLTK（Natural Language Toolkit）库** 用来存放各种自然语言处理资源的数据目录。它并不是 NLTK 的代码本身，而是 NLTK 依赖的一些外部数据集合，比如语料库、词典、模型等。

具体来说，`nltk_data` 通常包含以下几类资源：

| 资源类型               | 示例                                    | 说明                    |
| ------------------ | ------------------------------------- | --------------------- |
| **语料库（corpora）**   | `gutenberg`, `reuters`, `treebank`    | 提供文本数据，用于语言分析、训练模型等   |
| **词典/词汇资源**        | `wordnet`                             | 词汇关系网络，可用于同义词、反义词查询   |
| **模型（models）**     | `averaged_perceptron_tagger`, `punkt` | 用于词性标注、分词、命名实体识别等     |
| **停用词（stopwords）** | `stopwords`                           | 常用的停用词列表，用于文本清理       |
| **语法资源**           | `grammars`                            | 提供上下文无关文法文件，用于解析和生成句子 |

在安装或使用 NLTK 时，如果你需要某个资源，通常会执行：

```python
import nltk

# 下载指定资源
nltk.download('wordnet')  # 下载 WordNet 词典

# 或者下载全部资源
nltk.download('all')
```

下载完成后，这些资源就会存放在 `nltk_data` 文件夹中。

## 5. Hugging Face

### 5.1 如何从 Hugging Face 下载开源模型

主要有三种方式：

#### **方式 1：使用 `huggingface_hub`**

```bash
pip install huggingface_hub
```

下载模型：

```python
from huggingface_hub import snapshot_download

# 下载整个模型仓库（默认到 ~/.cache/huggingface/hub/）
model_path = snapshot_download(repo_id="bert-base-uncased")
print(model_path)
```

如果需要指定下载位置：

```python
snapshot_download(repo_id="bert-base-uncased", local_dir="./models/bert-base-uncased")
```

#### **方式 2：使用 `transformers` 自动下载**

```bash
pip install transformers
```

```python
from transformers import AutoModel, AutoTokenizer

model = AutoModel.from_pretrained("bert-base-uncased")
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
```

👉 这种方式会自动从 Hugging Face 下载模型并缓存。

#### **方式 3：用 `git lfs` 克隆**

先安装 [git-lfs](https://git-lfs.com/)，然后：

```bash
git lfs install
git clone https://huggingface.co/bert-base-uncased
```

---

### 5.2 下载后模型的目录结构

以 `bert-base-uncased` 为例：

```
bert-base-uncased/
├── config.json            # 模型配置（层数、隐藏维度等）
├── pytorch_model.bin      # 模型权重（PyTorch）
├── tf_model.h5            # (可能有) TensorFlow 权重
├── tokenizer.json         # 分词器定义
├── tokenizer_config.json  # 分词器配置
├── vocab.txt              # 词表
└── special_tokens_map.json# 特殊 token 映射
```

不同模型会有差异，比如：

* LLaMA 类大模型会有多个分片：`pytorch_model-00001-of-00005.bin`
* Vision 模型可能有 `preprocessor_config.json`
* Diffusion 模型会有 `scheduler/`, `unet/`, `vae/` 等子目录

---

### 5.3 如何使用下载的模型

#### **方式 1：本地加载（推荐）**

```python
from transformers import AutoModel, AutoTokenizer

model_path = "./models/bert-base-uncased"  # 本地路径
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModel.from_pretrained(model_path)

inputs = tokenizer("Hello Hugging Face!", return_tensors="pt")
outputs = model(**inputs)
print(outputs.last_hidden_state.shape)
```

### **方式 2：pipeline 快速推理**

```python
from transformers import pipeline

classifier = pipeline("sentiment-analysis", model="./models/distilbert-base-uncased-finetuned-sst-2-english")
print(classifier("I love open-source models!"))
```

### **方式 3：大模型推理（以 LLaMA 为例）**

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

model_path = "./models/meta-llama/Llama-2-7b-hf"

tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForCausalLM.from_pretrained(model_path, device_map="auto")

prompt = "What is the capital of France?"
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=50)

print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

---

✅ **总结：**

1. 下载：`huggingface_hub` / `transformers` / `git lfs`
2. 目录：`config.json` + `权重文件` + `tokenizer配置`
3. 使用：本地路径加载，配合 `transformers` 的 `AutoModel` 和 `AutoTokenizer`

### 5.4 ragflow 下载的模型
dwonload_deps.py 总共下载了 5 个模型。

#### **InfiniFlow/text_concat_xgb_v1.0**

* 机构：**InfiniFlow**（一个做智能文档解析、RAG 基础设施的团队）
* 模型类型：传统 ML 模型（**XGBoost**）
* 作用：对文本拼接相关任务（text concatenation）做分类/排序。
* 可能用途：在文档拆分 + 拼接的场景中，用来判断哪些文本片段需要合并，比如多行表格、被换行的句子、跨页内容。

---

#### **InfiniFlow/deepdoc**

* 机构：**InfiniFlow**
* 模型类型：**文档解析模型（Document Parsing）**
* 作用：从复杂的 PDF / Office 文档中抽取结构化信息（段落、表格、标题等）。
* 类似的方向有 **LayoutLM**、**DocFormer** 这样的文档理解模型。
* 在 RAG / 文档管理系统里常用，负责把文档切成语义块再送去 embedding。

---

#### **InfiniFlow/huqie**

* 机构：**InfiniFlow**
* 模型类型：看名字像是“**互切/互嵌**”相关的 embedding / 匹配模型。
* 作用：用于语义相似度计算、问答匹配或文本检索。
* 具体细节官方文档里应该有，但大概率是 **中文语义表示模型**。

---

#### **BAAI/bge-large-zh-v1.5**

* 机构：**北京智源 BAAI**
* 模型类型：**中文文本 Embedding 模型**
* 作用：把中文文本编码成向量，用于相似度计算、检索、RAG。
* 特点：

  * 属于 BGE 系列，v1.5 在中文理解和鲁棒性上更好。
  * 向量维度 1024，适合中文检索任务。

---

#### **maidalun1020/bce-embedding-base_v1**

* 机构：网易有道（研究者账号：maidalun1020）
* 模型类型：**中英文双语 Embedding 模型**
* 作用：用于中文 + 英文语义检索 / RAG。
* 特点：

  * BCE 系列模型，支持跨语言向量检索。
  * 向量维度 768。

---

#### 总结


| 模型                                      | 来源         | 类型             | 主要用途               |
| --------------------------------------- | ---------- | -------------- | ------------------ |
| **InfiniFlow/text_concat_xgb_v1.0**  | InfiniFlow | XGBoost 排序模型   | 文本拼接判断（句子/段落合并）    |
| **InfiniFlow/deepdoc**                  | InfiniFlow | 文档解析模型         | PDF/Office 文档结构化抽取 |
| **InfiniFlow/huqie**                    | InfiniFlow | Embedding/匹配模型 | 中文语义相似度、检索         |
| **BAAI/bge-large-zh-v1.5**              | BAAI       | 中文 Embedding   | 中文检索、RAG           |
| **maidalun1020/bce-embedding-base_v1** | Youdao     | 中英 Embedding   | 跨语言检索、RAG          |

## 6. 