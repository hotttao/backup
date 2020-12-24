---
title: 3 Vue 组件与组件通信
date: 2020-10-03
categories:
    - 前端
tags:
	- Vue
---

<!-- more -->

## 1. 组件概述
上一节我们介绍了 Vue 的基本用法，Vue 的核心逻辑就是数据驱动视图，个人觉得所谓数据驱动视图就是将**声明式的语法**在前端更进一步。我们都知道 HTML 和 CSS 都是声明式的语言，Vue 则通过将 DOM 操作抽象成"可以在 HTML 中使用的插值表达式和指令"以及执行业务逻辑的各种方法，将Web 页面中的声明式语法更进一步，而连接这两个部分的正是数据。

接下来我们就来学习前端发展中了另一个重要概念: "组件化"。所谓组件就是  html + css + js。本节我们将介绍:
1. Vue 中组件的定义和使用
2. Vue 组件间的通信
3. 插槽


## 2. 组件定义和使用
Vue 中组件可以认为组合 html+css+js 的单元，有点类似于 CSS 网格布局中的一个 Container 容器。通过组件，Vue 可以在更高的层次上复用代码。 通常一个应用会以一棵嵌套的组件树的形式来组织：

![组件树](/images/JavaScript/vue_container.png)

Vue 中组件分为:
1. 全局组件: 无论组件是否被使用都会被加载
2. 局部组件: 只有被使用时，才会被加载

### 2.1 局部组件的创建和使用
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

### 2.2 全局组件的创建和使用
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

## 3. 组件间通信
Vue 将页面实现为组件树，不同组件之间如果想共享数据就需要进行通信，Vue 中的组件通信都是单向的，分为如下四种通信方式:
- 父传子: 通过 props 以及绑定子组件自定义属性
- 子传父: 通过子组件事件
- 平行组件: 通过中央事件总线
- 其他方式: provide 和 inject 以及组件之间的引用关系
- refs: 通过引用直接访问

### 3.1 父组件向子组件传值
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


### 3.2 子组件向父组件传值
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

### 3.3 平行组件通信
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


### 3.4 父孙组件通信
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

### 3.5 通过组件之间的引用关系通信
每一个组件实例都有如下属性，可以获取其在组件树中的父组件和子组件:
1. this.$parent: 获取组件的父组件
2. this.$children: 获取组件的直接子组件

### 3.6 refs 
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

## 4. 插槽
所谓插槽就是定义了如何向组件中插入内容，从而提高组件的复用性。Vue 的插槽分为:
1. 匿名插槽
2. 具名插槽
3. 作用域插槽

接下来我们一一介绍

### 4.1 匿名插槽

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

### 4.2 具名插槽
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

### 4.3 作用域插槽
作用域插槽的提供了在不影响原有组间设计的情况下，扩展组件的能力，其能访问到插入组件内的数据。如其名扩展了组件的作用域。

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
            // item 变量值，可以在组件外部通过 itemValue 访问到
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
            // data.itemValue 就是作用域插槽中返回的值
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