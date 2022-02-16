---
title: 10 Vuex
date: 2020-10-10
categories:
    - 前端
tags:
	- Vue
---
Vuex 状态管理和数据共享
<!-- more -->

## 1. Vuex 概述
Vuex 是⼀个专为 Vue.js 应⽤程序开发的状态管理模式。它采⽤集中式存储管理应⽤的所有组件的状态，并以相应的规则保证状态以⼀种可预测的⽅式发⽣变化。

![Vuex](/images/JavaScript/vuex.png)

为了修改 Vuex 中保存的数据，需要调用在 Actions 和 Mutations 中定义的方法:
1. Actions 中定义的是异步方法，所有异步操作必须经由 Actions 去调用 Mutations
2. Mutations 中定义的是同步的方法，如果 Mutations 中定义异步方法会造成数据的不一致
3. 修改状态的唯一方法就是提交 Mutations

Vuex 通常用于大型项目中不相关的组件之间的通信。

### 1.1 vuex 安装

```bash
cnpm i vuex -S
vue add vuex
```

## 2. Vuex 使用
### 2.1 Vuex 创建
`vue add vuex` 后，在项目的根目录中我们将看到以下几个文件:
1. `scr/store/index.js`: 初始化 Vuex
2. `src/main.js`: 导入并挂载 Vuex 的实例

```js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {  // 保存着共享的数据
      count: 0
  },
  getters: { // 定义取值器，用于封装一些复杂的计算逻辑
    isOver(state){
        return state.count > 10
    }  
  },
  mutations: { // 声明的同步方法
    add(state, amount=1){
        // 修改状态
        state.count++
    },
    sub(state){
        state.count--
    }
  },
  actions: { // 声明的异步方法
    add(context, amount=1){
        // context 是 Vuex自动传入的，其他参数是组件调用 dispatch 传入的其他参数
        // commit mutations 中声明的方法
        let {commit} = context;
        commit("add", amount);
    }
  },
  modules: {
  }
})

```

```js
// main.js
import Vue from 'vue'
import App from './App.vue'
import router from './router'
// 导入
import store from './store'

Vue.config.productionTip = false

new Vue({
  router,
  // 挂载
  store,
  render: h => h(App)
}).$mount('#app')
```

### 2.2 Vuex 使用
Vuex 实例已经挂载到 Vue的原型上，通过 Vue 实例的 $store 属性，我们就可以访问到共享数据。

```html
<template>
  <div class="home">
    {{count}}
    <button @click="add">+1</button>
    <button @click="sub">-1</button>
  </div>
</template>

<script>
// @ is an alias to /src

export default {
  name: 'Home',
  components: {
  },
  computed: {
    count() {
      // 获取 Vuex getters 中定义的值
      console.log(this.$store.getters.isOver);
      return this.$store.state.count; 
    }
  },
  methods: {
    add() {
      // dispatch 去触发 Actions 中对应的方法
      // 传递给 dispatch/commit 的额外参数会传递给 Vuex 中对应的方法
      this.$store.dispatch('add', 100)
      // dispatch 的另一种书写方式
      this.$store.dispatch({
          type: "add",
          amount: 100
      })
    },
    sub(){
      // 如果不涉及异步操作，也只可以调用 Mutation 中定义的方法
      this.$store.commit("sub")
    }
  },
}
</script>
```

## 2.1 添加插件
Vuex 自带一个日志插件用于一般的调试:

```js
import createLogger from 'vuex/dist/logger'

const store = new Vuex.Store({
  plugins: [createLogger()]
})
```

## 3. Vuex 的辅助函数
从上面的示例中我们可以看到，为了去修改 Vuex 中的函数，我们可能会需要编写多个重复调用的函数。为了方便 Vuex 共享数据的操作， Vuex 提供了一些辅助函数:
1. mapState
2. mapGetters
3. mapMutations,
4. mapActions

上面我们定义的方法也可用辅助函数，重写如下:

```html
<script>
// @ is an alias to /src
import {mapState, mapGetters, mapMutations, mapActions} from 'vuex';

export default {
  name: 'Home',
  components: {
  },
  computed: {
    count() {
      console.log(this.$store.getters.isOver);
      return this.$store.state.count; 
    },
    ...mapState(['username']),
    // 自定义 state 在本组件的变量名，其他辅助函数使用类似
    ...mapState({
      myCount: 'count'
    }),
    
    ...mapGetters(['isOver'])
  },
  methods: {
    ...mapActions(['add']),
    ...mapMutations(['sub'])
  },
}
</script>
```

使用辅助函数的不方便之处在于，没法想 Vuex 中定义的方法传递参数，如果需要传递参数则必须使用之前定义的方式。

## 4. Vuex 的模块化
Vuex 通过 models 可以进行模块化，并定义命名空间，便于大型项目中的数据共享管理。这也是 Vuex 相比于共享事件总线优越的地方。我们可以像下面这样定义 Vuex 模块:
1. 在 `src/store` 下创建目录 modules，并新建 cart.js, product.js 分别表示购物车和产品列表的数据
2. 在 Vuex 实例的 modules 属性中注册 cart.js product.js 共享模块
3. 使用辅助函数或者直接操作 vuex 实例时要加上命名空间


如果希望你的模块具有更高的封装度和复用性，你可以通过添加 namespaced: true 的方式使其成为带命名空间的模块。当模块被注册后，它的所有 getter、action 及 mutation 都会自动根据模块注册的路径调整命名。比如:

```js
const store = new Vuex.Store({
  modules: {
    account: {
      namespaced: true,

      // 模块内容（module assets）
      state: () => ({ ... }), // 模块内的状态已经是嵌套的了，使用 `namespaced` 属性不会对其产生影响
      getters: {
        isAdmin () { ... } // -> getters['account/isAdmin']
      },
      actions: {
        login () { ... } // -> dispatch('account/login')
      },
      mutations: {
        login () { ... } // -> commit('account/login')
      },

      // 嵌套模块
      modules: {
        // 继承父模块的命名空间
        myPage: {
          state: () => ({ ... }),
          getters: {
            profile () { ... } // -> getters['account/profile']
          }
        },

        // 进一步嵌套命名空间
        posts: {
          namespaced: true,

          state: () => ({ ... }),
          getters: {
            popular () { ... } // -> getters['account/posts/popular']
          }
        }
      }
    }
  }
})
```

### 4.1 在带命名空间的模块内访问全局内容

如果你希望使用全局 state 和 getter，rootState 和 rootGetters 会作为第三和第四参数传入 getter，也会通过 context 对象的属性传入 action。

若需要在全局命名空间内分发 action 或提交 mutation，将 { root: true } 作为第三参数传给 dispatch 或 commit 即可。

```js
modules: {
  foo: {
    namespaced: true,

    getters: {
      // 在这个模块的 getter 中，`getters` 被局部化了
      // 你可以使用 getter 的第四个参数来调用 `rootGetters`
      someGetter (state, getters, rootState, rootGetters) {
        getters.someOtherGetter // -> 'foo/someOtherGetter'
        rootGetters.someOtherGetter // -> 'someOtherGetter'
      },
      someOtherGetter: state => { ... }
    },

    actions: {
      // 在这个模块中， dispatch 和 commit 也被局部化了
      // 他们可以接受 `root` 属性以访问根 dispatch 或 commit
      someAction ({ dispatch, commit, getters, rootGetters }) {
        getters.someGetter // -> 'foo/someGetter'
        rootGetters.someGetter // -> 'someGetter'

        dispatch('someOtherAction') // -> 'foo/someOtherAction'
        dispatch('someOtherAction', null, { root: true }) // -> 'someOtherAction'

        commit('someMutation') // -> 'foo/someMutation'
        commit('someMutation', null, { root: true }) // -> 'someMutation'
      },
      someOtherAction (ctx, payload) { ... }
    }
  }
}
```
### 4.2 使用示例

下面是使用 vuex 模块构建购物车的一个完整案例:

```js
// cart.js
export default {
    namespaced: true, // 将模块注册为单独的命名空间，命名空间的名称同 Vuex modules 挂载的名称
    state: {
        cartList: []
    },
    getters:{
        cartCount(state){
            return state.cartList.length;
        }
    },
    actions: {

    },
    mutations: {

    }
}

// store/index.js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)
import cart from './modules/cart'
import product from './modules/product'

export default new Vuex.Store({
  state: {  // 保存着共享的数据
  },
  getters: {
  },
  mutations: { // 声明的同步方法
  },
  actions: { // 声明的异步方法
  },
  modules: { // 挂载 Vuex 模块
    cart,    // cart 名称也将作为命名空间使用
    product
  }
})

```

使用带命名空间的 Vuex
```html
<template>
  <div>
    {{cartCount}}
    {{myCount}}
  </div>
</template>

<script>
  import {mapGetters} from 'vuex'
  
  export default {
    computed: {
      // 第一参数为命名空间
      ...mapGetters('cart', ['cartCount']),
      myCount(){
        console.log(this.$store)
        return this.$store.getters['cart/cartCount'];
      }
    },
  }
</script>

<style lang="scss" scoped>

</style>
```

## 5. Vuex 实战
实战项目是做一个从购物页面，添加商品到购物车中，我们按照如下方式组织模块:
1. 定义两个 vuex 模块 cart.js, product.js 分别管理商品列表页和购物车里的商品
2. 定义两个组件，购物车和商品列表组件，用于展示所有商品和购物车
3. 两个组件通过 vuex 共享和互操作数据。

vuex 的存在，将数据和数据的操作集中到了一起，组件只是简单的使用了 vuex 中定义的数据和方法。

### 5.1 product.js

```js
import axios from 'axios'

export default {
    namespaced: true,
    state: {
        products: []
    },
    actions: {
        // 获取所有商品
        async getProducts({commit}) {
            try {
                let res = await axios.get("api/products")
                let result = res.data.result
                // console.log(result)
                commit('getProducts', result)
            } catch (error) {
                console.log(error)
            }
            
        }
    },
    mutations: {
        getProducts(state, products){
            state.products = products
        },
        // 减少商品库存
        subProduct(state, {id}){
            let product = state.products.find(item=>item.id===id);
            console.log(product)
            product.inventory--
        }
    }
}
```

### 5.2 cart.js

```js
export default {
    namespaced: true, // 将模块注册为单独的命名空间，命名空间的名称同 Vuex modules 挂载的名称
    state: {
        cartList: []
    },
    getters:{
        cartCount(state){
            return state.cartList.length;
        },
        // rootState 表示根 vuex 实例
        cartList(state, getters, rootState){
            // console.log(rootState.product.products);
            return state.cartList.map(({id, num})=>{
                let product = rootState.product.products.find(item=>item.id === id)
                return {
                    price: product.price,
                    title: product.title,
                    num: num
                }
            })
        },
        /// getters 表示当前 getters 
        cartMoney(state, getters){
            return getters.cartList.reduce((sum, item)=>{
                return sum + item.price * item.num
            }, 0)
        }
    },
    actions: {
        // 1. 添加购物车
        addCart({commit, state}, product){
            let i = state.cartList.find(item=>item.id === product.id)
            if (!i){
                // 商品不存在
                commit('addCart', {id: product.id, num: 1})
            } else{
                commit('increCart', {id: product.id})
            }
            // 如果想提交另一个 vuex 模块的 Mutations 方法，需要第三个参数 {root: true}
            commit('product/subProduct', {id: product.id}, {root: true})
        }
    },
    mutations: {
        // 1. 添加购物车
        addCart(state, {id, num}){
            state.cartList.push({
                id,
                num
            })
        },
        // 2. 增加购车的计数
        increCart(state, {id}){
            let product = state.cartList.find(item=>item.id === id);
            product.num++
        }
    }
}
```