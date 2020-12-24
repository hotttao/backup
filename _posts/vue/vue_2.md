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
为简化 DOM 操作，Vue 为我们提供了插值表达式和一些指令，这些是 Vue 的使用基础。插值表达式和指令可以访问 Vue 实例中定义的特定方法，包括 data，watch，filter，method，这些特定方法定义了数据，以及各种监听和操作数据的方法。最终的目的是为了达到数据驱动视图。

### 1.1 插值表达式和指令 
插值表达式和指令: 提供了类似模板引擎的功能，包括:
- 插值表达式使用双大括号: `{{}}`
- v-if/v-else/v-else-if: 只有条件为 true 是元素才会渲染，有更高的切换开销
- v-show: 条件渲染，不管初始变量如何，元素总是被渲染，有更高的初始化开销
- v-text: 
- v-html: 
- v-bind: 属性绑定
- v-on: 事件绑定，vue 还提供了事件修饰符，用于阻止默认事件，阻止冒泡等常用的事件处理功能
- v-model: 双向数据绑定

下面这些基础指令的使用示例:

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

### 1.2 双向数据绑定
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

v-model 存在三个修饰符:
1. .lazy: 在默认情况下，v-model 在每次 input 事件触发后将输入框的值与数据进行同步 (除了上述输入法组合文字时)。你可以添加 lazy 修饰符，从而转为在 change 事件之后进行同步
2. .number: 将用户的输入值转为数值类型
3. .trim: 自动过滤用户输入的首尾空白字符

```html
<!-- 在“change”时而非“input”时更新 -->
<input v-model.lazy="msg">
```

## 2. Vue 实例中的方法
Vue 实例可以定义如下属性和方法:
1. data: Vue 示例包含的数据
1. watch: 监听器用于监听值的变化
2. computed: 计算属性有三个核心作用:
    - 用于封装复杂的计算逻辑
    - 缓存计算结果
    - 监听变量，并自动更新计算
3. filters: 过滤器，用于格式化数据，分为全局过滤和局部过滤器，局部过滤器只能在当前的 vue 实例中使用

### 2.1 watch 监听器
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

### 2.2 computed 计算属性

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

### 2.3 过滤器

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