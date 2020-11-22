---
title: 12 Element UI
date: 2020-10-12
categories:
    - 前端
tags:
	- Vue
---
Element UI 表单设计组件
<!-- more -->

## 1. Element UI 组件安装

```bash
# https://element.eleme.cn/#/zh-CN/component/quickstart
# 1. 安装
cnpm i element-ui
# 借助 babel-plugin-component 可以实现按需导入 element-ui 组件 
cnpm i babel-plugin-component -D

# 2. 修改 .babelrc
{
  "presets": [["es2015", { "modules": false }]],
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}

# 3. 方式二: 使用 vue add element 直接使用
vue add element
```