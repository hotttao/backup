---
title: 4 Vue 声明周期
date: 2020-10-04
categories:
    - 前端
tags:
	- Vue
---
Vue 声明周期
<!-- more -->

## 1. Vue 生命周期概述

所谓生命周期就是 Vue 实例从创建到销毁的整个过程，通过在这个过程中安插一些钩子函数，我们就可以实现面向切面编程。下面是 Vue 声明周期的示意图:

![Vue 生命周期](/images/JavaScript/vue_life.png)

## 2. 生命周期中的各个钩子函数

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Document</title>
    <style>
        .active{
            color: red;
        }
    </style>
</head>

<body>
    <div id="app">
        <!-- 3.使用子组件 -->
        <App></App>

    </div>
    <script src="./vue.js"></script>
    <script>
        /*
        beforeCreate
        created
        beforeMount
        mounted
        beforeUpdate
        updated
        activated 激活
        deactivated 停用
        配合keep-alive
        beforeDestroy
        destroyed
        */
        Vue.component('Test', {
            data() {
                return {
                    msg: "小马哥",
                    isRed:false
                }
            },
            methods: {
                handlerClick() {
                    this.msg = 'alex';
                    this.isRed = true;
                }
            },
            template: `
                <div>

                    <button @click='handlerClick'>改变</button>
                    <h3 :class='{active:isRed}'>{{msg}}</h3>    
                </div>
            `,
            beforeCreate() {
                console.log('组件创建之前', this.$data);
            },
            created() {
                // 非常重要的事情,在此时发送ajax 请求后端的数据
                console.log('组件创建完成', this.$data);
            },
            beforeMount() {
                // 即将挂载
                console.log('DOM挂载之前', document.getElementById('app'));
            },
            mounted() {
                // 发送ajax
                console.log('DOM挂载完成', document.getElementById('app'));

            },
            beforeUpdate() {
                // 获取更新之前的DOM
                console.log('更新之前的DOM', document.getElementById('app').innerHTML);

            },
            updated() {
                // 获取最新的DOM
                console.log('更新之后的DOM', document.getElementById('app').innerHTML);
            },
            beforeDestroy() {
                console.log('销毁之前');

            },
            destroyed() {
                console.log('销毁完成');

            },
            activated(){
                console.log('组件被激活了');
                
            },
            deactivated(){
                console.log('组件被停用了');
                
            }
        })

        const App = {
            data() {
                return {
                    isShow: true
                }
            },
            components: {},
            methods: {
                clickHandler() {
                    this.isShow = !this.isShow;
                }
            },
            template: `
                 <div>
                    <keep-alive>
                        <Test v-if='isShow'></Test>
                    </keep-alive>
                    <button @click='clickHandler'>改变生死</button>
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

### 2.1 activated/deactivated
`<keep-alive></keep-alive>` 用于当组件逻辑上被销毁时，不销毁而是放入到一个缓存中，当需要组件时不是重新创建而是直接从缓存中取出:
1. `deactivated`: 组件被停用，即当组件被放入缓存时调用
2. `activated`: 组件被激活，即组件被重新使用时调用

组件被缓存时会保留所有当前状态，所以 `<keep-alive></keep-alive>` 可以避免用户意外操作导致当前的状态，比如编辑的文本意外丢失。
