---
title: 9 Vue Router
date: 2020-10-09
categories:
    - 前端
tags:
	- Vue
---
Vue Router 路由管理
<!-- more -->

## 1. Vue-Router 概述
[Vue-Router](https://router.vuejs.org/zh/) 是 vue 中构建单页面应用的组件，提供了路由功能:
1. 多页面应用: 每一页都是一个 .html 页面，便于做 SEO 优化
2. 单页面应用: 单个 html 页面，通过 a 标签切换不同的视图

典型的单页面应用包括使用 [vue-element-admin](https://panjiachen.github.io/vue-element-admin-site/zh/) 制作的后台管理系统。

### 1.1 安装

```bash
npm i vue-router -S
vue add router
```

## 2. Vue-Router 使用
当我们在项目添加 vue-router 后，vue-cli 会在项目中为我们添加如下几个文件:
1. src/router/index.js: 实例化路由的地方
2. src/views: 路由组件，又称为视图

要想使用路由组件需要如下几个步骤:
1. 在 router/index.js 中实例化路由组件实例
2. 在 main.js 中将路由组件实例挂载到根 Vue 实例中，此时我们在每一个 vue 组件中获取如下两个对象:
    - $router: 路由对象，提供了编程式导航的功能
    - $route: 路由信息对象，提供了获取路由参数的功能
3. 在 App.vue 中使用 `<router-link>` 和  `<router-view>` 显示视图

router/index.js 中路由匹配的优先级按照定义从上往下，优先级越来越低


```js
// 1. router/index.js
import Vue from "vue"
import VueRouter from "vue-router"
import About from '@/views/About.vue';
import Home  from '@/views/Home.vue'

// 挂载 VueRouter 的组件，这样才能使用后面的 <router-link> 和 <router-view>
Vue.use(VueRouter)

const router = new VueRouter({
    mode: "history", // 历史模式，url 中不会出现 # 
    // 路由匹配的优先级按照定义从上往下，优先级越来越低
    routes:[
        {
            path: '/',
            component: Home
        },
        // 3. 路由别名
        {
            path: '/about',
            component: About
            alias: "/aaaa"
        },
        // 1. 路由重定向
        {
            path: '/redirect',
            redirect: '/about'
        },
        // 1. 路由重定向
        {
            path: '/aaa',
            redirect: {name: "about"}
        },
        // 2. 404 页面
        // 通过 * 模糊匹配，我们可以定义 404 页面
        {
            path: '*',
            // ES6 中动态加载模块
            component: () => import('@/views/404.vue')
        }
    ]
})

export default router

// 2. main.js
import Vue from 'vue'
import App from './App.vue'
import router from '@/router';

Vue.config.productionTip = false

new Vue({
  // 挂载到实例中
  router,
  render: h => h(App)
}).$mount('#app')

// 3. app.vue 中定义路由出口
<template>
  <div id="app">
    <div id="nav">
      <!-- router-link 相当于 a 标签，to 属性相当于 href 属性 -->
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </div>
    <!-- 相当于路由组件的出口, router-link 匹配的路由组件就会被渲染到此处 -->
    <router-view/>
  </div>
</template>
```

上面是 vue-router 的基本使用，在这些基础使用上 vue-router 提供了其他"扩展"，包括:
1. 命名路由
2. 动态路由
3. 路由查询参数

接下来我们一一介绍

### 2.1 命令路由
所谓命名路由，就是对路由命名，并基于命名使用路由组件。

定义命名路由:
```js
const router = new VueRouter({
    routes:[
        {
            path: '/',
            name: "home",
            component: Home
        },
        {
            path: '/about',
            name: "about",
            component: About
        }
    ]
})
```

使用命名路由:

```html
<template>
  <div id="app">
    <div id="nav">
      <!-- router-link 相当于 a 标签，to 属性相当于 href 属性 -->
      <router-link :to="{name: 'home'}">Home</router-link> |
      <router-link :to="{name: 'about'}">About</router-link>
    </div>
    <!-- 相当于路由组件的出口 -->
    <router-view/>
  </div>
</template>
```

### 2.2 动态路由和查询参数
动态路由用于动态匹配 url 中的参数，类似 `/user/1`, `/usr/2`,接下来我们将介绍:
1. 如何定义动态路由
2. 如何在 `route-linke` 传递动态路由的参数，以复用路由
3. 如何在组件中获取动态路由的参数

路由查询参数就是 url 中的查询参数，它无须在路由定义时特殊定义，配置和获取的方式与动态路由类似。

#### 定义动态路由
```js
const router = new VueRouter({
    routes:[
        {
            // :id 表示匹配并接收的 url 参数
            path: '/user/:id',
            name: "user",
            component: User
        },
            // * 表示 url 的模糊匹配
        {
            path: '/user-*',
            name: "user",
            component: User
        }
    ]
})
```

#### 传递动态路由的参数
可以像下面这样向路由组件传递参数，来复用路由组件

```html
<template>
  <div id="app">
    <div id="nav">
      <!-- params 就是插入到 url 中的动态路由参数 -->
      <router-link :to="{name: 'user', params:{id: 1}}">User1</router-link>
      <router-link :to="{name: 'user', params:{id: 2}}">User2</router-link>

      <!-- query 就是向 url 传入的查询参数 -->
      <router-link :to="{name: 'user', params:{id: 2}, query:{title:'产品', price: 10}}">User3</router-link>

    </div>
    <router-view/>
  </div>
</template>
```

#### 获取动态路由的参数
1. 通过 vue 实例的 $route.params 属性我们可以获取 url 中定义的路由参数
2. 通过 vue 实例的 $route.pathMatch 属性我们可以获取 url 中模糊匹配的部分
3. 通过 vue 实例的 $route.query 属性我们可以获取 url 的查询参数

```html
<script>
    export default {
        // 当路由的参数变化时，此路由组件会被复用，因为两个路由复用了同样的组件
        // created 函数在被复用时就不会重新调用
        created () {
            // params 接收路由中定义的参数
            console.log(this.$route.params.id);
            // pathMatch 接收 url 中模糊匹配的部分
            console.log(this.$route.params.pathMatch);
            // query 接收路由查询参数
            console.log(this.$route.query);
        },

        // 方法一: 监听 $route 的变化
        watch: {
            $route: (to, from)=>{
                console.log("watch 监听机制")
                console.log(to.params.id);
                console.log(from.params.id);
                // 请求数据接口
            }
        },
        // 方法二: 路由导航守卫
        beforeRouteUpdate(to, from, next){
            console.log("路由导航守卫")
            console.log(to.params.id);
            console.log(from.params.id);
            // 一定要调用 next，不然会阻塞整个路由，后续页面展示的逻辑无法继续进行
            next();
        }
    }
    }
</script>
```

通过动态路由我们就可以达到复用组件的目的，但是需要注意的是复用组件时，此时组件就不会重新加载了，比如 /user/1 切换到 /user/2 时，vue 声明周期中的一些构造函数就不会重新调用。为了在组件切换时执行一些必须执行到的逻辑，比如请求后台接口，我们可以使用如下两个方法:
1. watch 监听 $route 的变化
2. 使用路由当行守卫 beforeRouteUpdate 方法，所谓导航守卫就是路由声明周期提供的钩子函数，后面我们详细介绍。

#### 路由组件传值
上面我们介绍了通过 $route 来接受路由上的各种参数，但是这种直接通过 $route 的方式会让我们的路由和组件之间形成高度的偶尔。我们通过 props 父组件传值的方式，来更好的向路由组件进行传值。

路由定义时传入值:

```js
const router = new VueRouter({
    routes:[
        // props 为 true 只会传递动态路由参数
        {
            path: '/user/:id',
            name: "user",
            component: User,
            props:true
        },
        // props 可以为自定义函数，接受 route(即 $route)，可以自定义返回上述所有参数
        {
            path: '/user/:id',
            name: "user",
            component: User,
            props:(route) => ({
                id: route.params.id,
                title: route.query.title,
            })
        },
    ]
})

```

视图组件去接受值:

```html
<script>
    export default {
        props:['id', 'title']
    }
</script>
```

### 2.3 编程式导航
`<route-link>` 定义的是声明式路由，有时候我们想在页面中实现页面的跳转，比如前进或者后退。这时候我们就可以通过 vue.$router 实现动态跳转，vue 中称为编程式导航。

```js
<script>
    export default {
        methods: {
            goBack(){
                // go 方法中 
                // 0 刷新 
                // 1 前进
                // -1 表示后退
                // -n 表示后退 n 如果没有 n 条历史记录则会失败不跳转
                this.$router.go(-1);
            },
            goHome() {
                // 以下任意一种方法都可以
                this.$router.push('/');
                this.$router.push('home');
                this.$router.push({
                    path: "/"
                });
                this.$router.push({
                    name: "user",
                    params: {
                        id: 1
                    },
                    query: {
                        title: "苹果"
                    }
                });
            }
        }
    }
</script>
```

### 2.4 嵌套路由
嵌套路由在子 URL 中在实现的一层路由，比如在 `/user/1/post`, `/user/1/profile` 我们可以在  '/user/:id' 下在创建一层子路由。这样post和profile 就可以公用 `/user` 页面的逻辑，最终实现的效果就是 user页面下动态的包含了子路由组件的页面。

步骤包括:
1. 定义嵌套路由
2. 在 User.vue 中定义路由出口

```js
const router = new VueRouter({
    mode: 'history',
    routes:[
        {
            path: '/user/:id',
            name: "user",
            component: ()=>import('@/views/User.vue'),
            props:(route) => ({
                id: route.params.id,
                title: route.query.title,
            }),
            // children 用于定义子路由

            children: [{
                path: 'posts',
                component: ()=>import('@/views/Post.vue')
            },{
                path: 'profile',
                component: ()=>import('@/views/Profile.vue')
            }
            ]
        
        },
        {
            path: '*',
            component: () => import('@/views/404.vue')
        }
    ]
})
```

User.vue中定义子路由出口

```html
<template>
    <div>
        <h3>User组件传入的 id： {{ $route.params.id }}</h3>
        <h3>User组件的url匹配： {{ $route.params.pathMatch }}</h3>
        <h3>传入的值： {{ id }}</h3>
        <button @click="goHome">跳转到首页</button>
        <router-view></router-view>
    </div>
</template>
```

嵌套路由和动态路由的区别在于:
1. 动态路由用于复用组件，其展示的页面都是一样
2. 嵌套路由展示的是不同样式和结构的页面

## 3. 命名视图
在前面的内容中，我们通过:
1. VueRouter 中定义路由，一个 url 对应一个组件
2. 通过 `<router-view/>` 定义路由的出口，当我们点击一个 URL 展示时，这个 `<router-view/>` 就回展示路由定义中 url 对应的 component 定义的组件

但是我们进入一个页面时，这个页面可能包含不止一个组件，典型的首页，包括:
1. 内容组件 main
2. 侧边栏组件 sider

这时候我们就需要使用命名视图。使用命名视图需要以下步骤:
1. 定义命名视图
2. 通过 `<router-view/>` 使用命名视图

```js
const router = new VueRouter({
    mode: 'history',
    routes:[
        {
            path: '/',
            name: "home",
            components: {
                default: Home,
                main: ()=>import('@/views/Main.vue'),
                side: ()=>import('@/views/Side.vue')
            }
        }
    ]
})
```

```html
<template>
  <div id="app">
    <div id="nav">
    <!-- 显示上面 default 定义的默认组件 -->
    <router-view/>
    <!-- name= 表示用对应的命名视图 -->
    <router-view name="main" class="main"></router-view>
    <router-view name="side" class="side"></router-view>
  </div>
</template>
```
每一个 `router-view` 标签类似一个 div 标签，可以为为其设置 class 样式，定义布局。

对于命名路由的匹配逻辑是这样的:
1. `<router-view/>` 作为路由出口，会显示匹配到的路由组件，匹配到 /user 就展示 User 组件，匹配到 /home 就展示 Home 组件
2. `<router-view name="main"></router-view>` 的命名路由会在匹配到的路由上，找对应名称的组件，比如匹配到 /user 时，就去 /user 下的 components 中找对应名称的组件，如果有就展示，没有就跳过

## 3. 导航守卫
所谓导航表示路由正在发生变化，守卫就是路由变化声明周期的别称。

完整的导航解析流程包括:
1. 导航被触发。
2. 在失活的组件⾥调⽤离开守卫。
3. 调⽤全局的 beforeEach 守卫。
4. 在重⽤的组件⾥调⽤ beforeRouteUpdate 守卫 (2.2+)。
5. 在路由配置⾥调⽤ beforeEnter 。
6. 解析异步路由组件。
7. 在被激活的组件⾥调⽤ beforeRouteEnter 。
8. 调⽤全局的 beforeResolve 守卫 (2.5+)。
9. 导航被确认。
10. 调⽤全局的 afterEach 钩⼦
11. 触发 DOM 更新。
12. ⽤创建好的实例调⽤ beforeRouteEnter 守卫中传给 next 的回
调函数

导航守卫的钩子函数中，必须调用通过参数传递进来的 next 回调函数。

### 3.1 导航守卫中的钩子函数
导航守卫提供了如下钩子函数:
1. beforeEach: 全局守卫，定义在 VueRouter 实例中，导航切换时都会调用
2. 组件内守卫:
    - beforeRouteEnter(to,from,next4): 守卫执行前调用，此时组件实例还未被创建，此时不能获取组件实例 this，用处不大
    - beforeRouteUpdate(to,from,next4): 路由发生变化，组件被复用后调用，可以访问组件实例 this
    - berforROuteLeave(to,from,next4): 导航离开组件时调用，可以访问组件实例 this 

### 3.2 berforROuteLeave
berforROuteLeave 主要用在用户离开页面的提示，提示用户是否保存当前页面的编辑。

```html
<!-- 组件内 -->
<script>
    export default {
        data() {
            return {
                content: ''
            }
        },
        beforeRouteLeave (to, from, next) {
            if (this.content){
                if (confirm("当前页面未保存是否离开")){
                    console.log(to)
                    next(false)
                }
            }else{
                next();
            }
        },
        beforeRouteEnter (to, from, next) {
            console.log(this); // undefined
            next(vm=>{
                // 通过 next 的回调用，可以接收到组件实例 this
            })
        },
        beforeRouteUpdate(to, from, next){
            // 组件重用时会调用这个方法
        }
    }
</script>
```

### 3.3 路由 meta 元信息
路由 meta 元信息指的是，我们可以通过路由配置中的 meta 属性，为路由添加元信息，元信息和 beforeEach 全局守卫，我们就可以实现类似登录这些功能。实现面向切面编程。我们首先来看如何定义路由元信息:

```js
const router = new VueRouter({
    mode: 'history',
    routes:[
        {
            path: '/edit',
            name: 'edit',
            component: ()=>import('@/views/edit.vue'),
            // meta 属性用于定义元数据信息 
            meta: {
                requireAuth: true
            }
        }
    ]
})
```

组件的元信息，最后都会保存在组件实例的 meta 和 matched 属性上。接下来我们看看如何结合 beforeEach 实现对特定 url 的登录要求:

#### 定义元信息
第一步，我们需要定义路由元信息和全局守卫，设置登录要求

```js
const router = new VueRouter({
    mode: 'history',
    routes:[
        {
            path: '/edit',
            name: 'edit',
            component: ()=>import('@/views/edit.vue'),
            meta: {
                requireAuth: true
            }
        },
        {
            path: '/login',
            name: 'login',
            component: ()=>import('@/views/Login.vue'),
            // 登录后的跳转页面
            props: (route)=>({
                redirect: route.query.redirect
            })
        }
    ]
})

router.beforeEach((to, from, next)=>{
    //1. 获取组件元信息
    if (to.matched.some(item=>item.meta.requireAuth)){
        // 2. 需要的登录
        if (!localStorage.getItem("user")){
            console.log(to.fullPath);
            next({
                path: '/login',
                query: {
                    redirect: to.fullPath
                } // 登录后返回到当前页面
            })
        }
    }
    next();
})
```

#### 定义登录逻辑

```html
<template>
    <div>
        <h3>登录页面</h3>
        <label for="name">姓名: 
            <input type="text" id="name" name="name" v-model="name">
        </label>

        <label for="pwd">
            密码:
            <input type="password" name="password" id="pwd" v-model="password">
        </label>
        <button @click="hLogin">登录</button>
    </div>
</template>

<script>
    export default {
        props: ['redirect'],
        data() {
            return {
                name: '',
                password: ''
            }
        },
        methods: {
            hLogin() {
                setTimeout(()=>{
                    localStorage.setItem("user", this.name);
                    console.log(this.redirect);
                    this.$router.push(this.redirect);
                },1000)
            }
        },
    }
</script>

<style lang="scss" scoped>

</style>

```