---
title: 5 Vue 组件异步加载和混入
date: 2020-10-05
categories:
    - 前端
tags:
	- Vue
---
响应式更新原理
<!-- more -->

## 1. 组件的异步加载
大型项目中，为了提高网页的加载速度，通常我们只会在使用相应组件时才会下载组件所在的 js 文件并加载组件。

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Document</title>
    <style>
    </style>
</head>

<body>
    <div id="app">
        <!-- 3.使用子组件 -->
        <App></App>

    </div>
    <script src="./vue.js"></script>
    <!-- 4. 因为使用了 ES6 import script 标签的 type 需要改为 module -->
    <script type='module'>
        import xxx from './modules.js';

        const App = {
            data() {
                return {
                    isShow: false
                }
            },
            methods: {
                asyncLoad() {
                    this.isShow = !this.isShow;
                }
            },
            // 2. 将组件挂载设置成一个工厂函数，实现异步按需挂载
            components: {
                Test:()=>import('./Test.js')
            },
            // 1. 当点击按钮时 Test 组件才会被加载，下载 modules.js 
            template: `
                 <div>            
                    <button @click='asyncLoad'>异步加载</button>
                    <Test v-if='isShow'></Test>
                 </div>
            `,
        }
        new Vue({
            el: '#app',
            data: {

            },
            components: {
                App
            }

        })
    </script>
</body>

</html>
```

## 2. 组件混入
类似于面向对象的混入技术，Vue 组件也通过 mixin 混入其他组件，以此来分发组件中的可复用功能。

### 2.1 局部混入组件实现

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
        <!-- <button @click="handlerMoTai">显示模态组件</button>
        <button @click="handlerTishi">显示提示组件</button>
        <Modal ref='mo'></Modal>
        <ToolTip ref='ti'></ToolTip> -->
    </div>
    <script src="./vue.js"></script>
    <script>
        // 1. 定义局部混入组件
        const toggleShow = {
            data() {
                return {
                    isShow: false
                }
            },
            methods: {
                toggleShow() {
                    this.isShow = !this.isShow
                }
            }
        }

        const Modal = {
            template: `
                <div v-if='isShow'><h3>模态框组件</h3></div>
            `,
            // 2. 混入局部的mixin
            mixins: [toggleShow]

        }

        const ToolTip = {
            template: `
            <div v-if='isShow'>
                <h2>提示框组件</h2>
            </div>
         `,
            // 3. 混入局部的 Mixin
            mixins: [toggleShow]
        }

        // Vue 实例
        new Vue({
            el: "#app",
            data: {

            },
            components: {
                Modal,
                ToolTip
            },
            template: `
                <div>
                    <button @click='handleModel'>模态框</button>
                    <button @click='handleToolTip'>提示框</button>
                    <Modal ref='modal'></Modal>
                    <ToolTip ref='toolTip'></ToolTip>
                </div>
            `,
            methods: {
                handleModel() {
                    this.$refs.modal.toggleShow();
                },
                handleToolTip() {
                    this.$refs.toolTip.toggleShow();
                }
            },
        })
    </script>
</body>

</html>
```

## 3. 全局混入组件实现
使用全局混入组件，要格外小心，因为每个组件实例创建时，它都会被调用，并混入到组件实例中

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
        {{msg}}
    </div>
    <script src="./vue.js"></script>
    <script>
        // 1. 全局混入组件
        VUe.mixins({
            
        })
    </script>
</body>

</html>
```
