---
title: 7 Vue 声明周期
date: 2020-10-07
categories:
    - 前端
tags:
	- Vue
---
Vue 生命周期
<!-- more -->

## 1. Vue 生命周期概述

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
1. `deactivated`: 组件别停用，即当组件被放入缓存时调用
2. `activated`: 组件被激活，即组件被重新使用时调用

什么使用 `<keep-alive></keep-alive>`，取决于具体的使用场景。


## 3. 组件的异步加载
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