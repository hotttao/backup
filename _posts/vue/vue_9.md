---
title: 9 Vue 组件混入技术
date: 2020-10-09
categories:
    - 前端
tags:
	- Vue
---
Vue 组件混入技术
<!-- more -->


## 1. Vue 组件混入技术概述
类似于面向对象的混入技术，Vue 组件也通过 mixin 混入其他组件，以此来分发组件中的可复用功能。

## 2. 局部混入组件实现

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