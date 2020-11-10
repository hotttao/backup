---
title: 4 Vue 组件化开发
date: 2020-10-04
categories:
    - 前端
tags:
	- Vue
	- 入门指南
---

<!-- more -->

## 1. Vue 组件概述
Vue 中组件可以认为组合 html+css+js 的单元，优点类似于 CSS 网格布局中的一个 Container 容器。通过组件，Vue 可以在更高的层次上复用代码。 通常一个应用会以一棵嵌套的组件树的形式来组织：

![组件树](/images/JavaScript/vue_container.png)

Vue 中组件分为:
1. 全局组件: 无论组件是否被使用都会被加载
2. 局部组件: 只有被使用时，才会被加载

## 2. 局部组件的创建和使用
使用局部组件包含: 创建，挂载和使用三个步骤

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>

<body>
    <div id="app">
        <!-- 3. 使用组件 -->
        <App></App>
    </div>
    <script src="./vue.js"></script>
    <script>
        // 1. 创建子组件
        const App = {
            // 组件的 data 属性必须是一个函数，避免复用组件带来的共享引用问题
            data() {
                return {
                    msg: "学习组件使用"
                }
            },
            // 组件必须包含 template 模板，定义组件包含的具体内容
            // template 必须要包含一个闭合标签，这里 div 标签不可省略
            template: `
            <div>
                <h3>{{msg}}</h3>
                <button @click="handleApp"> 点击</button>
            </div>
            
            `,
            methods: {
                handleApp() {
                    this.msg = "我是APP组件"
                }
            }

        }
        new Vue({
            el: "#app",
            data: {

            },
            // 2. 挂载子组件
            components: {
                App
            },
        })
    </script>
</body>

</html>
```

## 3. 全局组件的创建和使用
全局组件的创建是通过 Vue.component 函数，并且全局组件无须挂载可直接使用:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>

<body>
    <div id="app">
        <App></App>
    </div>
    <script src="./vue.js"></script>
    <script>
        // 1. 创建全局组件
        // 第一个参数是组件名，第二是组件的配置，与局部组件的配置完全相同
        Vue.component("Vheader", {
            template: `
            <div>
                <h3>我是一个全局的导航组件</h3>
            </div>
            `
        })

        // 这是一个局部组件
        const App = {
            // 2. 直接使用全局组件，无须挂载可直接使用
            template: `
            <div>
                <Vheader></Vheader>
            </div>
            `
        }

        // Vue 实例
        new Vue({
            el: "#app",
            data: {

            },
            // 2. 挂载子组件
            components: {
                App
            },
        })
    </script>
</body>

</html>
```