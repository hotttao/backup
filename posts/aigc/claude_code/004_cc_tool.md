---
weight: 1
title: "Claude Code Tool 设计"
date: 2026-04-02T22:00:00+08:00
lastmod: 2026-04-02T22:00:00+08:00
draft: false
author: "宋涛"
authorLink: "https://hotttao.github.io/"
description: "Claude Code Context Compact"
featuredImage:

tags: ["Claude Code"]
categories: ["agent_core"]

lightgallery: true
---

这一节我们来学习 [Claude Code 实现的通用基础工具](https://github.com/Yuyz0112/claude-code-reverse/blob/main/results/tools/)。

<!-- more -->

## 1. Edit Tool
Edit Tool 的核心需求是实现精准修改。

```yaml
name: Edit
description: >-
  对文件执行精确的字符串替换。


  使用方式：

  - 在对话中编辑之前，必须至少使用一次 `Read` 工具。
  如果尝试未读取文件就编辑，此工具将报错。

  - 使用 Read 工具输出的文本进行编辑时，请确保保留行号前缀之后显示的确切缩进（制表符/空格）。
  行号前缀格式为：空格 + 行号 + 制表符。制表符之后的所有内容才是要匹配的实际文件内容。
  切勿在 old_string 或 new_string 中包含行号前缀的任何部分。

  - 始终优先编辑代码库中已存在的文件。除非有明确要求，绝不编写新文件。

  - 仅在用户明确要求时使用emoji。除非被要求，避免向文件添加emoji。

  - 如果 `old_string` 在文件中不唯一，编辑将会失败。
  请提供包含更多周边上下文的更长字符串使其唯一，或使用 `replace_all` 更改每一处 `old_string`。

  - 使用 `replace_all` 在整个文件中替换和重命名字符串。该参数适用于例如重命名变量的场景。
input_schema:
  type: object
  properties:
    file_path:
      type: string
      description: 待修改文件的绝对路径
    old_string:
      type: string
      description: 要替换的文本
    new_string:
      type: string
      description: 用来替换的文本（必须与 old_string 不同）
    replace_all:
      type: boolean
      default: false
      description: 替换所有 old_string 的匹配项（默认为 false）
  required:
    - file_path
    - old_string
    - new_string
  additionalProperties: false
  $schema: http://json-schema.org/draft-07/schema#
```


## 2. TodoWriter

<table style="width: 100%; table-layout: fixed;">
  <thead>
    <tr>
      <th width="50%" style="text-align: left;">English original</th>
      <th width="50%" style="text-align: left;">中文翻译</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">name: TodoWrite
description: &gt;- Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user. It also helps the user understand the progress of the task and overall progress of their requests.</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">名称：TodoWrite
描述：&gt;- 使用此工具为当前编码会话创建和管理结构化任务列表。它可以帮助你跟踪进度、组织复杂任务，并向用户展示工作的周全程度。它还能帮助用户了解任务的执行进度，以及其请求的整体完成情况。</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>When to Use This Tool</strong>
Use this tool proactively in these scenarios:

1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos
6. When you start working on a task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>何时使用此工具</strong>
在以下场景中，应主动使用此工具：

1. 复杂的多步骤任务——当一个任务需要 3 个或更多不同的步骤或操作时
2. 不简单且复杂的任务——需要仔细规划或执行多项操作的任务
3. 用户明确要求待办列表——当用户直接要求你使用待办列表时
4. 用户提供多个任务——当用户给出一组需要完成的事项时（以编号或逗号分隔）
5. 收到新指令后——立即将用户需求记录为待办事项
6. 开始处理任务时——在开始工作之前将其标记为 in_progress。理想情况下，同一时间只能有一个待办事项处于 in_progress 状态
7. 完成任务后——将其标记为 completed，并添加实现过程中发现的任何后续任务</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>When NOT to Use This Tool</strong>

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>何时不应使用此工具</strong>

在以下情况下跳过此工具：
1. 只有一个简单直接的任务
2. 任务微不足道，跟踪它不能带来任何组织上的益处
3. 任务可以在不到 3 个简单步骤内完成
4. 任务纯粹是对话或信息咨询

请注意，如果只有一个简单任务要做，就不应使用此工具。在这种情况下，直接完成任务会更合适。</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>Examples of When to Use the Todo List</strong>

&lt;example&gt;
User: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!
Assistant: I'll help add a dark mode toggle to your application settings. Let me create a todo list to track this implementation.
<em>Creates todo list with the following items:</em>
1. Create dark mode toggle component in Settings page
2. Add dark mode state management (context/store)
3. Implement CSS-in-JS styles for dark theme
4. Update existing components to support theme switching
5. Run tests and build process, addressing any failures or errors that occur
<em>Begins working on the first task</em>

&lt;reasoning&gt;
The assistant used the todo list because:
1. Adding dark mode is a multi-step feature requiring UI, state management, and styling changes
2. The user explicitly requested tests and build be run afterward
3. The assistant inferred that tests and build need to pass by adding "Ensure tests and build succeed" as the final task
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>应使用待办列表的示例</strong>

&lt;example&gt;
用户：我想在应用程序设置中添加一个深色模式开关。完成后请确保运行测试和构建！
助手：我会帮你在应用程序设置中添加深色模式开关。让我创建一个待办列表来跟踪这项实现工作。
<em>创建包含以下事项的待办列表：</em>
1. 在 Settings 页面创建深色模式开关组件
2. 添加深色模式状态管理（context/store）
3. 为深色主题实现 CSS-in-JS 样式
4. 更新现有组件以支持主题切换
5. 运行测试和构建流程，并处理出现的任何失败或错误
<em>开始处理第一个任务</em>

&lt;reasoning&gt;
助手使用待办列表的原因：
1. 添加深色模式是一项多步骤功能，需要更改 UI、状态管理和样式
2. 用户明确要求之后运行测试和构建
3. 助手推断测试和构建必须通过，因此将“确保测试和构建成功”添加为最后一个任务
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: Let me first search through your codebase to find all occurrences of 'getCwd'.
<em>Uses grep or search tools to locate all instances of getCwd in the codebase</em>
Assistant: I've found 15 instances of 'getCwd' across 8 different files. Let me create a todo list to track these changes.
<em>Creates todo list with specific items for each file that needs updating</em>

&lt;reasoning&gt;
The assistant used the todo list because:
1. First, the assistant searched to understand the scope of the task
2. Upon finding multiple occurrences across different files, it determined this was a complex task with multiple steps
3. The todo list helps ensure every instance is tracked and updated systematically
4. This approach prevents missing any occurrences and maintains code consistency
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：请帮我在整个项目中将函数 getCwd 重命名为 getCurrentWorkingDirectory。
助手：让我先搜索代码库，找出所有出现 'getCwd' 的位置。
<em>使用 grep 或搜索工具定位代码库中 getCwd 的所有实例</em>
助手：我在 8 个不同文件中找到了 15 个 'getCwd' 实例。让我创建一个待办列表来跟踪这些更改。
<em>创建待办列表，为每个需要更新的文件列出具体事项</em>

&lt;reasoning&gt;
助手使用待办列表的原因：
1. 助手首先通过搜索了解任务范围
2. 在不同文件中发现多处实例后，判定这是一个包含多个步骤的复杂任务
3. 待办列表有助于确保每个实例都得到系统化的跟踪和更新
4. 这种方法可以避免遗漏任何实例，并保持代码一致性
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.
Assistant: I'll help implement these features. First, let's add all the features to the todo list.
<em>Creates a todo list breaking down each feature into specific tasks based on the project architecture</em>
Assistant: Let's start with user registration. This will involve creating database models, API endpoints, and frontend forms that integrate with your existing authentication system.

&lt;reasoning&gt;
The assistant used the todo list because:
1. The user provided multiple complex features to implement in a comma separated list
2. The todo list helps organize these large features into manageable tasks
3. This approach allows for tracking progress across the entire implementation
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：我需要为电商网站实现这些功能：用户注册、商品目录、购物车和结账流程。
助手：我会帮你实现这些功能。首先，让我们把所有功能添加到待办列表中。
<em>根据项目架构创建待办列表，将每项功能拆分成具体任务</em>
助手：让我们从用户注册开始。这将涉及创建数据库模型、API 端点，以及与现有身份验证系统集成的前端表单。

&lt;reasoning&gt;
助手使用待办列表的原因：
1. 用户以逗号分隔的列表提供了多个需要实现的复杂功能
2. 待办列表有助于将这些大型功能组织成易于管理的任务
3. 这种方法可以跟踪整个实现过程中的进度
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: Can you help optimize my React application? It's rendering slowly and has performance issues.
&lt;/user&gt;
Assistant: I'll help optimize your React application. First, let me examine your codebase to identify potential performance bottlenecks.
<em>Reviews component structure, render patterns, state management, and data fetching</em>
Assistant: After analyzing your codebase, I've identified several performance issues. Let me create a todo list to track our optimization efforts.
<em>Creates todo list with items like: 1) Implement memoization for expensive calculations in ProductList, 2) Add virtualization for long lists in Dashboard, 3) Optimize image loading in Gallery component, 4) Fix state update loops in ShoppingCart, 5) Review bundle size and implement code splitting</em>
Let's start by implementing memoization for the expensive calculations in your ProductList component.
&lt;/assistant&gt;

&lt;reasoning&gt;
The assistant used the todo list because:
1. First, the assistant examined the codebase to identify specific performance issues
2. Based on this analysis, it identified multiple optimization opportunities
3. Performance optimization is a non-trivial task requiring multiple steps
4. The todo list helps methodically track improvements across different components
5. This systematic approach ensures all performance bottlenecks are addressed
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：你能帮我优化 React 应用吗？它渲染缓慢，并且存在性能问题。
&lt;/user&gt;
助手：我会帮你优化 React 应用。首先，让我检查代码库，找出潜在的性能瓶颈。
<em>检查组件结构、渲染模式、状态管理和数据获取</em>
助手：分析代码库后，我发现了几个性能问题。让我创建一个待办列表来跟踪优化工作。
<em>创建待办列表，其中包括：1）为 ProductList 中开销较大的计算实现记忆化，2）为 Dashboard 中的长列表添加虚拟化，3）优化 Gallery 组件中的图片加载，4）修复 ShoppingCart 中的状态更新循环，5）检查包体积并实现代码拆分</em>
让我们先为 ProductList 组件中开销较大的计算实现记忆化。
&lt;/assistant&gt;

&lt;reasoning&gt;
助手使用待办列表的原因：
1. 助手首先检查代码库，以识别具体的性能问题
2. 根据分析结果，发现了多个优化机会
3. 性能优化是一项需要多个步骤的复杂任务
4. 待办列表有助于有条理地跟踪不同组件的改进
5. 这种系统化方法可确保所有性能瓶颈都得到处理
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>Examples of When NOT to Use the Todo List</strong>

&lt;example&gt;
User: How do I print 'Hello World' in Python?
Assistant: In Python, you can print "Hello World" with this simple code:

python
print("Hello World")

This will output the text "Hello World" to the console when executed.
&lt;/assistant&gt;

&lt;reasoning&gt;
The assistant did not use the todo list because this is a single, trivial task that can be completed in one step. There's no need to track multiple tasks or steps for such a straightforward request.
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>不应使用待办列表的示例</strong>

&lt;example&gt;
用户：如何用 Python 打印 'Hello World'？
助手：在 Python 中，可以使用以下简单代码打印 "Hello World"：

python
print("Hello World")

执行后，控制台将输出文本 "Hello World"。
&lt;/assistant&gt;

&lt;reasoning&gt;
助手没有使用待办列表，因为这是一个可以一步完成的单一简单任务。对于这样直接的请求，无需跟踪多个任务或步骤。
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: What does the git status command do?
Assistant: The git status command shows the current state of your working directory and staging area. It displays which changes have been staged, which haven't, and which files aren't being tracked by Git. This is a fundamental command for understanding the current state of your repository before making commits.

&lt;reasoning&gt;
The assistant did not use the todo list because this is an informational request with no actual coding task to complete. The user is simply asking for an explanation, not for the assistant to perform multiple steps or tasks.
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：git status 命令有什么作用？
助手：git status 命令显示工作目录和暂存区的当前状态。它会显示哪些更改已暂存、哪些尚未暂存，以及哪些文件未被 Git 跟踪。这是在提交之前了解仓库当前状态的一条基础命令。

&lt;reasoning&gt;
助手没有使用待办列表，因为这是一个信息咨询请求，没有需要完成的实际编码任务。用户只是要求解释，并非要求助手执行多个步骤或任务。
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: Sure, let me add a comment to the calculateTotal function to explain what it does.
<em> Uses the Edit tool to add a comment to the calculateTotal function </em>

&lt;reasoning&gt;
The assistant did not use the todo list because this is a single, straightforward task confined to one location in the code. Adding a comment doesn't require tracking multiple steps or systematic organization.
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：你能给 calculateTotal 函数添加一条注释，解释它的作用吗？
助手：当然，让我给 calculateTotal 函数添加一条注释来解释它的作用。
<em> 使用 Edit 工具给 calculateTotal 函数添加注释 </em>

&lt;reasoning&gt;
助手没有使用待办列表，因为这是一个仅涉及代码中单一位置的简单任务。添加注释不需要跟踪多个步骤，也不需要进行系统化组织。
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
User: Run npm install for me and tell me what happens.
Assistant: I'll run the npm install command for you.

<em>Executes: npm install</em>

The command completed successfully. Here's the output:
[Output of npm install command]

All dependencies have been installed according to your package.json file.

&lt;reasoning&gt;
The assistant did not use the todo list because this is a single command execution with immediate results. There are no multiple steps to track or organize, making the todo list unnecessary for this straightforward task.
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">&lt;example&gt;
用户：帮我运行 npm install，并告诉我结果。
助手：我会为你运行 npm install 命令。

<em>执行：npm install</em>

命令已成功完成。输出如下：
[npm install 命令的输出]

已根据 package.json 文件安装所有依赖项。

&lt;reasoning&gt;
助手没有使用待办列表，因为这只是执行一条能立即得到结果的命令。没有多个需要跟踪或组织的步骤，因此这个简单任务不需要待办列表。
&lt;/reasoning&gt;
&lt;/example&gt;</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>Task States and Management</strong>

1. <strong>Task States</strong>: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. <strong>Task Management</strong>:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;"><strong>任务状态与管理</strong>

1. <strong>任务状态</strong>：使用以下状态跟踪进度：
   - pending：任务尚未开始
   - in_progress：当前正在处理（同一时间仅限一个任务）
   - completed：任务已成功完成

2. <strong>任务管理</strong>：
   - 工作时实时更新任务状态
   - 完成后立即将任务标记为完成（不要批量更新完成状态）
   - 任何时候都只能有一个任务处于 in_progress 状态
   - 先完成当前任务，再开始新任务
   - 从列表中彻底移除不再相关的任务</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">3. <strong>Task Completion Requirements</strong>:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. <strong>Task Breakdown</strong>:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; line-height: 1.6;">3. <strong>任务完成要求</strong>：
   - 只有在任务已全部完成时，才能将其标记为 completed
   - 如果遇到错误、阻碍或无法完成，请将任务保持为 in_progress 状态
   - 遇到阻碍时，创建一个新任务来说明需要解决的问题
   - 在以下情况下，绝不能将任务标记为 completed：
     - 测试失败
     - 实现尚不完整
     - 遇到未解决的错误
     - 无法找到所需的文件或依赖项

4. <strong>任务拆分</strong>：
   - 创建具体且可执行的事项
   - 将复杂任务拆分成更小、更易于管理的步骤
   - 使用清晰且具有描述性的任务名称

如有疑问，请使用此工具。主动管理任务能体现细致周到，并确保你成功完成所有要求。</pre></td>
    </tr>
    <tr>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: monospace; line-height: 1.6;">input_schema:
  type: object
  properties:
    todos:
      type: array
      items:
        type: object
        properties:
          content:
            type: string
            minLength: 1
          status:
            type: string
            enum:
              - pending
              - in_progress
              - completed
          priority:
            type: string
            enum:
              - high
              - medium
              - low
          id:
            type: string
        required:
          - content
          - status
          - priority
          - id
        additionalProperties: false
      description: The updated todo list
  required:
    - todos
  additionalProperties: false
  $schema: http://json-schema.org/draft-07/schema#</pre></td>
      <td style="vertical-align: top;"><pre style="margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: monospace; line-height: 1.6;">input_schema（输入模式）：
  type: object（对象）
  properties（属性）：
    todos（待办事项）：
      type: array（数组）
      items（数组项）：
        type: object（对象）
        properties（属性）：
          content（内容）：
            type: string（字符串）
            minLength: 1（最小长度为 1）
          status（状态）：
            type: string（字符串）
            enum（枚举）：
              - pending（待处理）
              - in_progress（进行中）
              - completed（已完成）
          priority（优先级）：
            type: string（字符串）
            enum（枚举）：
              - high（高）
              - medium（中）
              - low（低）
          id（标识符）：
            type: string（字符串）
        required（必填项）：
          - content（内容）
          - status（状态）
          - priority（优先级）
          - id（标识符）
        additionalProperties: false（不允许额外属性）
      description: The updated todo list（更新后的待办列表）
  required（必填项）：
    - todos（待办事项）
  additionalProperties: false（不允许额外属性）
  $schema: http://json-schema.org/draft-07/schema#</pre></td>
    </tr>
  </tbody>
</table>
