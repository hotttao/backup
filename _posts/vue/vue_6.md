---
title: 6 Vue 插槽
date: 2020-10-06
categories:
    - 前端
tags:
	- Vue
---
Vue 的插槽
<!-- more -->

## 1. Vue 插槽概述
Vue 的插槽分为:
1. 匿名插槽
2. 具名插槽
3. 作用域插槽

至于插槽是什么，我们来一一介绍

## 2. 匿名插槽

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
        Vue.component("MBtn", {
            // 2. slot 定义的匿名占位符，会被组件名标签中的内容替换
            // 匿名插槽又称默认插槽，只能出现一次
            template: `
            <button>
                <slot></slot>
            </button>
            `
        })

        const App = {
            // 1. 组件名 MBtn == m-btn 
            // 3. <MBtn>内容</MBtn> 标签中的内容会自动填充占位符
            template: `
            <div>
                <MBtn>登录</MBtn>
                <m-btn>注册</m-btn>
            </div>
            `
        }

        new Vue({
            el: "#app",
            data: {

            },
            components: {
                App
            },
        })
    </script>
</body>

</html>
```

## 3. 具名插槽
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
        Vue.component("MBtn", {
            // 1. 具有name 属性的 slot 称为具名插槽
            template: `
            <button>
                <slot name="login"></slot>                
                <slot name="submit"></slot>
            </button>
            `
        })

        const App = {
            // 2. 通过 template 的 slot 属性去匹配插入的插槽的位置
            // 3. template 内容顺序决定了展示的顺序
            template: `
            <div>           
                <m-btn>
                    <template slot="submit">提交</template>
                </m-btn>
                <m-btn>
                    <template slot="login">登录</template>
                </m-btn>
            </div>
            `
        }

        new Vue({
            el: "#app",
            data: {

            },
            components: {
                App
            },
        })
    </script>
</body>

</html>
```

## 4. 作用域插槽
作用域插槽的提供了在不影响原有组间设计的情况下，扩展组件的能力，其能访问到插入组件内的数据。

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
        const todoList = {
            // 1. 通过为"匿名/具名插"槽绑定自定义属性，可以对外传输值
            template: `
                <ul>
                    <li v-for="item in todo">
                        <slot :itemValue="item"></slot>
                        {{item.title}}
                    </li>
                </ul>
            `,
            props: ["todo"]

        }

        const App = {
            data() {
                return {
                    todoList: [{
                        title: '大哥你好么',
                        isComplate: true,
                        id: 1
                    }, {
                        title: '小弟我还行',
                        isComplate: false,
                        id: 2
                    }, {
                        title: '你在干什么',
                        isComplate: false,
                        id: 3
                    }, {
                        title: '抽烟喝酒烫头',
                        isComplate: true,
                        id: 4
                    }]
                }
            },
            // 2. v-slot/slot-scop 作用域插槽，可以接受插槽输出的值
            // 3. 通过 template 往插槽内插入值
            template: `
            <div>           
                <todoList :todo="todoList">
                    <template v-slot="data">
                        <input type="checkbox" v-model="data.itemValue.isComplate"></input>
                    </template>
                </todoList>
            </div>
            `,
            components: {
                todoList
            }
        }

        new Vue({
            el: "#app",
            data: {

            },
            components: {
                App
            },
        })
    </script>
</body>

</html>
```