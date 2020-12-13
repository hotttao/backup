---
title: 18 react 项目实战 
date: 2020-11-18
categories:
    - 前端
tags:
	- Vue
---
react 项目实战
<!-- more -->

## 1. 项目初始化
```bash
# 1. 安装 create-react-app
cnpm i -g create-react-app

# 2. 创建项目
create-react-app react_admin

# 3. 安装所需的包
cnpm i -S antd axios babel-plugin-import customize-cra draft-js draftjs-to-html echarts echarts-for-react html-to-draftjs jsonp less less-loader  react-draft-wysiwyg react-redux redux store wangeditor

cnpm i -S @craco/craco craco-less @babel/plugin-proposal-decorators

# 3. 修改 package.json 项目启动方式
"scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test",
    "eject": "react-scripts eject"
  },

# 4. 根目录创建 craco.config.js 文件
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
  ],
};
```