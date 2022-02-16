---
title: 5 组件使用
date: 2020-11-05
categories:
    - 前端
tags:
	- Vue
---
React 表单: 受控组件和非受控组件
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

# 装饰器的插件
yarn add @babel/plugin-proposal-decorators
yarn add craco-less

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

# 如果要支持装饰器语法，需要将 craco.config.js 配置为
const CracoLessPlugin = require('craco-less');

module.exports = {
  babel: {   //用来支持装饰器
	   plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]]
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: { '@primary-color': '#1DA57A' },
            javascriptEnabled: true,
          },
        },
      },
    },
  ]
};

# 4. App.js 中部分导入
import {Button} from "antd"
import './App.css'

# 5. App.css 中导入样式
@import '~antd/dist/antd.css';
```
