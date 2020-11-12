---
title: 5 Vue 组件通信
date: 2020-10-05
categories:
    - 前端
tags:
	- Vue
---
Vue 中的组件通信
<!-- more -->

## 1. Vue 组件通信概述
Vue 组件之间有如下四种通信方式:
- 父传子: 通过 props 以及绑定子组件自定义属性
- 子传父: 通过子组件事件
- 平行组件: 通过中央事件总线
- 其他方式: provide 和 inject 以及组件之间的引用关系
- refs: 通过引用直接访问

## 1. 父组件向子组件传值
父组件向子组件传值是通过"子组件标签的自定义属性"完成的:
1. 子组件通过 props 声明接收值的变量
2. 父组件中为子组件绑定同名的自定义属性来传值

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
        Vue.component("Vheader", {
            template: `
            <div>
                <h3>{{pMsg}}</h3>
            </div>
            `,
            // 1. 在子组件中声明 props 接收在父组件中挂载的属性
            // 2. props 中声明的变量可以在 template 中任意使用
            props: ['pMsg']
        })

        const App = {
            // 3. 在父组件中绑定自定义属性
            // pMsg 是绑定的自定义属性，同时也是子组件接收值的变量名
            template: `
            <div>
                <Vheader :pMsg='msg'></Vheader>
            </div>
            `,
            data() {
                return {
                    'msg': "我是父组件传过来的值"
                }
            }
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

## 2. 子组件向父组件传值
子组件向父组件传值的方式是: 子组件触发事件，父组件监听子组件事件。

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
        Vue.component("Vheader", {
            template: `
            <div>
                <h3>我是一个全局的导航组件</h3>
                <input type="text" @input=getName>
            </div>
            `,
            methods: {
                getName(e) {
                    const value = e.target.value;
                    // 2. 子组件通过 this.$emit 触发父组件绑定的自定义事件，并传值
                    this.$emit('sendValue', value)
                }
            },
        })

        const App = {
            // 1. 在父组件中的子组件标签上绑定自定义事件
            template: `
            <div>
                <p>{{childValue}}</p>
                <Vheader @sendValue='reciveName'></Vheader>
            </div>
            `,
            data() {
                return {
                    'childValue': ""
                }
            },
            methods: {
                reciveName(value) {
                    console.log(value)
                    this.childValue = value
                }
            },
        }

        // Vue 实例
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

## 3. 平行组件通信
平行组件的通信是通过全局的中央事件总线实现的:
1. 接收数据的组件事先在中央事件总线上注册事件和回调函数
2. 传值组件触发对应事件来传值

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
        // 1. 创建中央事件总线
        const bus = new Vue();

        Vue.component("A", {
            data() {
                return {
                    count: 0
                }
            },
            template: `
                <div>
                    <p>购物车数量: {{count}}</p>
                </div>
            `,
            // 2. 在组件被创建后绑定事件和回调函数，以接收值
            // 注意组件内的 this 指向了当前的组件实例，因此不同组件内 this 指向是不同的
            created() {
                bus.$on("eventAddShop", (value) => {
                    this.count += 1;
                });
            },
        })

        Vue.component("B", {
            template: `
                <div>
                    <button @click="addShop">添加购物车</button>
                </div>
            `,
            methods: {
                // 3. 触发中央总线上的相应事件，以传值
                addShop() {
                    bus.$emit("eventAddShop", 1);
                }
            },
        })

        const App = {
            template: `
            <div>
                <A></A>
                <B></B>
            </div>
            `
        }

        // Vue 实例
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


## 4. 父孙组件通信
所谓父孙组件通信是为了在父组件中实现，父组件与其嵌套的多层的子组件之间相互通信。其实现方式是:
1. 父组件通过 provide 提供变量
2. 子组件通过 inject 来注入变量，不论子组件嵌套的深度

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
        // 1. 创建中央事件总线
        const bus = new Vue();

        Vue.component("A", {
            template: `
                <div>
                    <p>{{msg}}</p>
                </div>
            `,
            // 2. 子组件通过 inject 注入变量，变量名必须与父组件提供的变量名相同
            inject: ['msg']
        })

        Vue.component("B", {
            template: `
                <div>
                    <A></A>
                </div>
            `
        })

        const App = {
            template: `
            <div>
                <B></B>
            </div>
            `,

            // 1. 父组件通过 provide 提供变量
            provide() {
                return {
                    msg: "父组件 provide 的变量"
                }
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

## 5. 通过组件之间的引用关系通信
每一个组件实例都有如下属性，可以获取其在组件树中的父组件和子组件:
1. this.$parent: 获取组件的父组件
2. this.$children: 获取组件的直接子组件

## 6. refs 
refs 通过为组件或者标签定义一个唯一 id 引用，以达到可以直接访问的目的。通过 refs 访问一个标签的步骤分为:
1. 为标签定义 ref 属性，并赋予唯一 id
2. 通过组件实例 vue.$refs.id 直接获取对应元素(id 为对应的 ref 属性值)
    - 给标签添加 ref 获取的就是真实的 dom
    - 给组件添加 ref 获取的就是组件的实例

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
        Vue.component("Vheader", {
            template: `
            <div>
                <h3>子组件</h3>
            </div>
            `
        })

        const App = {
            // 1. 为标签添加 ref 属性，赋予其一个唯一 id
            // 给标签添加 ref 获取的就是真实的 dom
            // 给组件添加 ref 获取的就是组件的实例
            template: `
            <div>
                <Vheader ref="header"></Vheader>
                <button ref="btn">按钮</button>
            </div>
            `,
            data() {
                return {
                    'msg': "我是父组件传过来的值"
                }
            },

            // 2. 通过 vue 实例的 $refs 属性可以直接访问添加了 ref 属性的标签
            mounted() {
                console.log(this.$refs.btn)
            },
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