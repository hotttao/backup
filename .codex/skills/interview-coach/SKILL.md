---
name: interview-coach
description: |
  面试辅导与模拟面试工具。当用户需要：(1) 准备特定公司/岗位的面试，(2) 根据简历生成模拟面试题，(3) 获取面试题的参考答案和讲解，(4) 进行编程面试练习，(5) 生成笔试题/OA练习，请使用此 skill。触发词包括：面试准备、模拟面试、面试辅导、简历匹配、面试练习、笔试题、OA、编程题、算法题、SQL题。
---

# Interview Coach 面试辅导工具

## 工作流程

### Phase 1: 信息收集

收集以下必要信息（按顺序询问缺失项）：

1. **简历** - 用户的标准简历（文件或文本）
2. **目标岗位** - 公司名称 + 职位名称
3. **面试官风格** - 从预设中选择或自定义

如用户未提供简历，提示上传或粘贴。

### Phase 2: 岗位研究

使用 web_search 搜索：

- `"{公司名}" "{职位}" site:linkedin.com OR site:glassdoor.com` - 获取 JD
- `"{公司名}" 面试题 经验` - 获取面经
- `"{公司名}" 技术栈 工程文化` - 了解公司特点

提取关键信息：

- 岗位职责与要求
- 技术栈匹配度
- 公司文化与价值观
- 面试流程特点

### Phase 3: 简历-岗位匹配分析

输出格式：

```
## 匹配度分析

### ✅ 强匹配项
- [简历中的经历] → [JD 中的要求]

### ⚠️ 需强化项
- [JD 要求] - 建议准备方向

### 📍 差异化优势
- [可突出的独特经历]
```

### Phase 4: 生成模拟面试

根据选择的面试官风格（见 `references/interviewer-styles.md`）和问题类型（见 `references/question-types.md`），生成：

**面试题结构**（每轮 5-8 题）：

1. **开场热身** (1 题) - 自我介绍或项目概述
2. **简历深挖** (2-3 题) - 基于简历的追问
3. **岗位相关** (2-3 题) - 匹配 JD 的技术/业务问题
4. **综合场景** (1-2 题) - 情景题或系统设计

输出格式：

```
## 模拟面试题 - [公司] [职位]
**面试官风格**: [风格名称]

### Q1: [问题]
**考察点**: [技能/素质]
**难度**: ⭐/⭐⭐/⭐⭐⭐

<details>
<summary>💡 参考答案要点</summary>

[答案框架和要点]

</details>

---
```

### Phase 5: 互动练习

用户可以：

1. **请求讲解** - 深入解释某道题的答题思路
2. **模拟对答** - 用户回答，Claude 扮演面试官追问
3. **代码练习** - 如果是编程题，创建可执行代码环境

代码练习流程：

1. 提供题目和测试用例
2. 创建代码模板文件
3. 用户编写解答
4. 运行测试验证
5. 提供优化建议

## 面试官风格

详见 `references/interviewer-styles.md`，包括：

- 🔍 追问型 - 层层深入，追根溯源
- 🌊 发散型 - 横向拓展，关联思考
- 🎯 务实型 - 直奔主题，结果导向
- 🤝 压力型 - 挑战观点，考验应变
- 💬 对话型 - 平等交流，开放讨论

## Phase 6: 笔试题生成

当用户需要**笔试练习**时，使用 `assets/` 中的模板生成可执行的练习文件。

### 模板使用流程

1. **选择模板** — 根据题型选择：

   - `assets/coding-python.py` → Python 编程题
   - `assets/coding-javascript.js` → JavaScript 编程题

2. **复制模板** — 将模板复制到工作目录

   ```bash
   cp assets/coding-python.py /home/claude/{公司}_{题目}.py
   ```

3. **填充占位符** — 替换所有 `{placeholder}` 为实际内容：

   - `{company}`, `{position}` → 公司和岗位
   - `{title}`, `{description}` → 题目信息
   - `{test_input_*}`, `{test_output_*}` → 测试用例
   - `{reference_solution}` → 参考答案（折叠隐藏）

4. **输出文件** — 保存到 `/mnt/user-data/outputs/`

### 笔试题类型

| 模板       | 适用场景    | 特点                   |
| ---------- | ----------- | ---------------------- |
| Python     | 后端/算法岗 | 带测试框架，可直接运行 |
| JavaScript | 前端岗      | Node.js 环境，含断言   |
| SQL        | 数据岗      | 含建表语句和示例数据   |
| 综合卷     | 全面考察    | 选择+简答+编程+设计    |

### 难度控制

根据岗位级别调整：

- **初级**: 1-2 ⭐，基础数据结构，30 分钟/题
- **中级**: 2-3 ⭐，常见算法变体，45 分钟/题
- **高级**: 3-4 ⭐，复杂场景+优化，60 分钟/题

## Phase 7: 脚本工具

`scripts/` 目录包含可直接执行的工具脚本，无需读入上下文。

### 题目生成器 `scripts/generate_problem.py`

自动从模板生成编程题文件，替代手动填充占位符。

```bash
# 方式一：使用配置文件
python scripts/generate_problem.py \
    --lang python \
    --config problem_config.json \
    --output /mnt/user-data/outputs/题目.py

# 方式二：直接参数
python scripts/generate_problem.py \
    --lang python \
    --company "字节跳动" \
    --title "两数之和" \
    --difficulty 2 \
    --time-limit 30 \
    --description "给定整数数组，找出和为目标值的两个数" \
    --output /mnt/user-data/outputs/twosum.py
```

配置文件格式 (JSON):

```json
{
  "company": "字节跳动",
  "position": "后端工程师",
  "title": "两数之和",
  "difficulty": 2,
  "time_limit": 30,
  "description": "题目描述...",
  "params": "nums, target",
  "test_cases": [
    { "input": [[2, 7, 11, 15], 9], "output": [0, 1] },
    { "input": [[3, 2, 4], 6], "output": [1, 2] }
  ],
  "hint": "使用哈希表...",
  "solution": "def solution(nums, target): ...",
  "time_complexity": "O(n)",
  "space_complexity": "O(n)"
}
```

### 代码评测器 `scripts/judge.py`

运行用户代码，对比测试用例，给出评分。

```bash
# 评测用户解答
python scripts/judge.py \
    --solution user_solution.py \
    --function solution \
    --test-cases cases.json

# 直接传入测试用例
python scripts/judge.py \
    --solution user_solution.py \
    --cases '[{"input": [[2,7,11,15], 9], "expected": [0,1]}]'

# JSON 格式输出（便于程序解析）
python scripts/judge.py -s solution.py -t cases.json --json
```

输出示例:

```
============================================================
📋 评测报告
============================================================
✅ 用例 1: 基础用例
   耗时: 0.05ms
❌ 用例 2: 边界用例
   期望: [1,2], 实际: None
------------------------------------------------------------
📊 统计:
   通过: 1/2
   得分: 50/100
============================================================
```

### 工作流整合

典型使用流程：

1. **生成题目** → `generate_problem.py` 创建练习文件
2. **用户作答** → 用户在生成的文件中编写 `solution` 函数
3. **评测反馈** → `judge.py` 运行测试并给出评分
4. **迭代优化** → 根据反馈修改代码，重新评测

## 输出规范

- 面试题使用中文，技术术语保留英文
- 参考答案提供框架而非完整稿，避免"背答案"
- 笔试代码文件必须可直接运行测试
- 保存完整面试题到 `/mnt/user-data/outputs/` 供下载
