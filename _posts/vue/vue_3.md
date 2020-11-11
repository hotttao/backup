---
title: 3 Vue 使用进阶
date: 2020-10-03
categories:
    - 前端
tags:
	- Vue
---

<!-- more -->

## 1. Vue 中的基本概念
我们接着上一节的内容继续学习 Vue 的指令，这一节我们来介绍 vue 中的一些复杂指令和用法，包括:
1. v-model: 双向数据绑定
2. watch: 监听器用于监听值的变化
3. computed: 计算属性有三个核心作用:
    - 用于封装复杂的计算逻辑
    - 缓存计算结果
    - 监听变量，并自动更新计算
4. filters: 过滤器，用于格式化数据，分为全局过滤和局部过滤器，局部过滤器只能在当前的 vue 实例中使用

## 2. v-model 双向数据绑定
所谓双向数据绑定，是针对像 input，textarea 等表单元素，用于实现:
1. 将变量绑定到视图(标签元素)
2. 修改表单元素可以修改变量值

这样的 变量->视图，视图->变量的双向数据绑定。我们来看下面这个示例:

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
        <!-- 1. 输入框 -->
        <p>{{ msg }}</p>
        <input type="text" v-model="msg">
        <!-- 2. 单选框，变量将保存为 true 或 false-->
        <label for="checkbox">{{checked}}</label>
        <input type="checkbox" id="checkbox" v-model="checked">

        <!-- 3. 复选框将保存到值为列表的变量中 -->
        <div class="box">
            <label for="a">黄瓜</label>
            <input type="checkbox" name="" id="a" value="黄瓜" v-model="boxCollect">

            <label for="b">西红柿</label>
            <input type="checkbox" name="" id="b" value="西红柿" v-model="boxCollect">

            <p>{{boxCollect}}</p>
        </div>
    </div>
    <script src="./vue.js"></script>
    <script>
        new Vue({
            el: "#app",
            data: {
                msg: "hello",
                checked: true,
                boxCollect: []
            }
        })
    </script>

</body>

</html>

```

### 2.1 v-model 的修饰符
v-model 存在三个修饰符:
1. .lazy: 在默认情况下，v-model 在每次 input 事件触发后将输入框的值与数据进行同步 (除了上述输入法组合文字时)。你可以添加 lazy 修饰符，从而转为在 change 事件_之后_进行同步
2. .number: 将用户的输入值转为数值类型
3. .trim: 自动过滤用户输入的首尾空白字符

```html
<!-- 在“change”时而非“input”时更新 -->
<input v-model.lazy="msg">
```

## 3. watch 监听器
JavaScript 中值分为基础类型和引用类型，对于引用类型要想监听其值的变化，我们需要深度监听

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
        <!-- 2. v-model 双向数据绑定，通过输入框改变变量的值 -->
        <label for="person">{{who}}</label>
        <input type="text" name="" id="person" v-model="who">

        <label for="study">{{student[0].name}}</label>
        <button @click="student[0].name='好棒'">改变学生</button>
    </div>
    <script src="./vue.js"></script>
    <script>
        new Vue({
            el: "#app",
            data: {
                who: "tsong", // 1. 被监听的变量
                student: [{
                    "name": "高手"
                }]
            },
            watch: {
                // 3. 函数名是监听的变量名，函数接收变量的(新值, 旧值)
                who(newV, oldV) {
                    console.log(newV)
                },
                // 4. 深度监听
                student: {
                    deep: true, // 表示深度监听
                    // handler 表示深度监听处理器
                    handler: function(newV, oldV) {
                        console.log(newV)
                    }
                }
            }
        })
    </script>
</body>

</html>
```

## 4. computed 计算属性

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
        <p>{{reverse}}</p>
        <p>{{computedSetter}}</p>
        <button @click='change'>更新值</button>
        <button @click='setCom'>计算属性设置 setter</button>
    </div>
    <script src="./vue.js"></script>
    <script>
        new Vue({
            el: "#app",
            data: {
                msg: "hello", // 1. computed 监听的变量
            },
            methods: {
                change() {
                    this.msg = "你好" // 3. 变量更新后，计算属性会监听到变化，并自动更新
                },
                setCom(event) {
                    const {
                        value
                    } = event.target;
                    this.computedSetter = "更新了"; // 5. 为计算属性直接赋值
                }
            },
            computed: {
                // 2. 计算属性，会自动计算并缓存，如果数据没有变化，计算属性直接从缓存中取值
                reverse() {
                    return this.msg.split('').reverse().join('')
                },

                // 4. 可以像下面这样，把计算属性定义成一个访问器属性
                computedSetter: {
                    get: function() {
                        return this.msg + " getter"
                    },
                    set: function(newV) { // 6. 计算属性接收值并更新变量
                        this.msg = newV
                    }
                }
            }
        })
    </script>
</body>

</html>
```

## 5. 过滤器

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
        <!-- 2. 通过管道符使用过滤器，price 和 $ 将传给过滤器函数-->
        <h3>{{price | formatPrice("$")}}</h3>
        <h3>{{msg | reverse("$")}}</h3>

    </div>
    <script src="./vue.js"></script>
    <script>
        // 3. 创建全局过滤器，可以在所有 Vue 组件中使用
        Vue.filter("reverse", value => {
            return value.split('').reverse().join("");
        });
        new Vue({
            el: "#app",
            data: {
                msg: "hello",
                price: 10
            },
            // 1. 定义局部过滤器
            filters: {

                formatPrice: function(price, f) {
                    return f + price;
                }
            }
        })
    </script>
</body>

</html>
```