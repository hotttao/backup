---
title: 7 antd 使用
date: 2020-11-03
categories:
    - 前端
tags:
	- Vue
---
antd
<!-- more -->

## 1. antd 概述
antd 类似于 Vue 中的 vue-element-ui，是一个样式和表单组件的库

### 1. 安装

```bash
cnpm i antd -S
```

### 2. 导入
与 vue-element-ui 类似，全局导入 antd 会对服务器造成较大的压力，推荐使用局部导入的方式[文档](https://ant.design/docs/react/use-with-create-react-app-cn):

```bash
# 1. 安装 craco
yarn add @craco/craco
cnpm i @craco/craco -S

# 2. 修改 package.json 里的 scripts 属性
"scripts": {
-   "start": "react-scripts start",
-   "build": "react-scripts build",
-   "test": "react-scripts test",
+   "start": "craco start",
+   "build": "craco build",
+   "test": "craco test",
}

# 3. 在项目根目录创建一个 craco.config.js 用于修改默认配置
module.exports = {
  // ...
};

# 4. App.js 中部分导入
import {Button} from "antd"
import './App.css'

# 5. App.css 中导入样式
@import '~antd/dist/antd.css';
```
