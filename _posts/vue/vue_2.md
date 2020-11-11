---
title: 2 Vue 入门
date: 2020-10-02
categories:
    - 前端
tags:
	- Vue
---

<!-- more -->

## 1. Vue 中的基本概念
Vue 为我们提供了如下基本操作:
1. 插值表达式和指令: 提供了类似模板引擎的功能，包括:
	- v-if/v-else/v-else-if: 只有条件为 true 是元素才会渲染，有更高的切换开销
	- v-show: 条件渲染，不管初始变量如何，元素总是被渲染，有更高的初始化开销
	- v-text
	- v-html
	- v-bind: 属性绑定
	- v-on: 事件绑定，vue 还提供了事件修饰符，用于阻止默认事件，阻止冒泡等常用的事件处理功能


## 2. Vue 指令的使用示例
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        .active {
            color: red;
        }
    </style>
</head>

<body>
    <div id="app">
        <!-- 1. 插值表达式，可以插入任何的 js 表达式 -->
        <!-- 可访问 vue 实例中定义的所有属性和方法 -->
        <div id=1>
            <h1>1. 插值表达式</h1>
            <p>{{ msg }}</p>
            <p>{{ {id: msg} }}</p>
            <p>{{ 1 > 2 ? "真的" : "假的"}}</p>
            <p>{{ getContents() }}</p>
        </div>

        <!-- 2. 插入可被渲染的标签: v-text 与 v-html 指令 -->
        <!-- v-text 相当于原生的 innerText -->
        <!-- v-html 相当于原生的 innerHT -->
        <div id="2">
            <h1>2. 插入可渲染文本</h1>
            <h3 v-text='msg'></h3>
            <div v-html='htmlMsg'>
            </div>
        </div>


        <div id="3">
            <h1>3. 循环和判断</h1>
            <!-- 3. v-if v-else v-else-if 条件显示-->
            <!-- 会将元素从 DOM 中插入或删除 -->
            <div v-if="Math.random() > 0.5">
                显示
            </div>
            <div v-else>
                隐藏
            </div>

            <!-- 4. v-show 条件显示-->
            <!-- 控制的元素的 display 属性，false 时，display: none -->
            <h3 v-show="!isShow"> isShow 显示</h3>

            <!-- 5. v-for 循环 -->
            <ul>
                <!-- v-for 建议绑定 :key，key 会成为单个元素的标识，便于 vue 进行局部更新， -->
                <!-- 如果 vue 无法定位数据变更会更改哪些元素，他将更新所有元素 -->
                <li v-for="(item,index) in menus" :key='item.id'>
                    菜名{{index}}: {{item.name}}
                </li>

                <li v-for="item in menus" :key='item.id'>
                    菜名{{item.id}}: {{item.name}}
                </li>
            </ul>
        </div>

        <div class="4">
            <h1>4. 属性绑定</h1>
            <!-- 6. v-bind 将属性值绑定到 vue 实例的属性 -->
            <a v-bind:href="ref.url" v-bind:title="ref.title">{{ref.name}}</a>
            <!-- v-bind 的简写 -->
            <a :href="ref.url" :title="ref.title">{{ref.name}}</a>
            <!-- 根据 isActive 决定是否 class=active，多个 class 会自动合并 -->
            <h3 class="size" v-bind:class="{active: isActive}">控制 class 属性值</h3>
            <p :style="{color:pColor,size: fontSize + 'px'}"> 控制 style 属性</p>
        </div>

        <div id="5">
            <h1>5. 事件绑定</h1>
            <!-- 7. v-on 事件绑定 -->
            <p :class='{active: isActive}'>{{num}}</p>
            <button v-on:click="num+=1">+1</button>
            <!-- v-on 简写 @ -->
            <button @click="handleClick">+2</button>
            <!-- 8. 事件修饰符 -->

            <!-- 阻止单击事件继续传播 -->
            <a v-on:click.stop="doThis"></a>
            <!-- 提交事件不再重载页面 -->
            <form v-on:submit.prevent="onSubmit"></form>
            <!-- 修饰符可以串联 -->
            <a v-on:click.stop.prevent="doThat"></a>
            <!-- 只有修饰符 -->
            <form v-on:submit.prevent></form>

            <!-- 添加事件监听器时使用事件捕获模式 -->
            <!-- 即内部元素触发的事件先在此处理，然后才交由内部元素进行处理 -->
            <div v-on:click.capture="doThis">...</div>

            <!-- 只当在 event.target 是当前元素自身时触发处理函数 -->
            <!-- 即事件不是从内部元素触发的 -->
            <div v-on:click.self="doThat">...</div>

            <!-- 点击事件将只会触发一次 -->
            <a v-on:click.once="doThis"></a>

        </div>

    </div>
    <!-- 1. 引包 -->
    <script src="./vue.js"></script>
    <script>
        // 2. 实例化 Vue
        new Vue({
            el: "#app", // 绑定的元素
            // 数据属性
            data: {
                msg: "hello world", // data 中属性将被保存为 vue 实例的属性
                htmlMsg: "<p>v-html插入可渲染的标签</p>",
                isShow: true,
                ref: {
                    name: "百度",
                    url: "https://www.baidu.com",
                    title: "百度一下"
                },
                isActive: false,
                pColor: "red",
                fontSize: "30",
                num: 1,
                menus: [{
                    "id": 1,
                    name: "鸡翅"
                }, {
                    "id": 2,
                    name: "土豆"
                }]
            },
            // 方法
            methods: {
                getContents() {
                    return this.msg; // this 指向 vue 实例，可以直接访问 data 中保存在 vue 的属性
                },
                handleClick() {
                    this.num += 2
                    this.isActive = !this.isActive
                }
            }
        })
    </script>
</body>

</html>

```