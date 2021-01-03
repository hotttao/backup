---
title: 13 react 项目实战 
date: 2020-11-13
categories:
    - 前端
tags:
	- React
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

cnpm install --save react-draft-wysiwyg draft-js draftjs-to-html html-to-draftjs  

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

## 2. 数据准备以及后端服务启动
项目后台使用 nodejs，并使用 mongodb 数据库。因此需要安装 mongodb。

```bash
# 1. 启动mongo
mongod

# 2. 启动后台服务
node serve.js
# 也可以使用  nodemon 来启动服务实时监听后台代码的变化
nodemon server.js
```