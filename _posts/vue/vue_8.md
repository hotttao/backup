---
title: 8 深入 Vue 响应式更新原理
date: 2020-10-08
categories:
    - 前端
tags:
	- Vue
---
响应式更新原理
<!-- more -->

## 1. 异步更新队列
### 1.1 异步更新队列概述
Vue 在更新 DOM 时是异步执行的。只要侦听到数据变化，Vue 将开启一个队列，并缓冲在同一事件循环中发生的所有数据变更。如果同一个 watcher 被多次触发，只会被推入到队列中一次。这种在缓冲时去除重复数据对于避免不必要的计算和 DOM 操作是非常重要的。然后，在下一个的事件循环“tick”中，Vue 刷新队列并执行实际 (已去重的) 工作。

例如，当你设置 vm.someData = 'new value'，该组件不会立即重新渲染。当刷新队列时，组件会在下一个事件循环“tick”中更新。多数情况我们不需要关心这个过程，但是如果你想基于更新后的 DOM 状态来做点什么，这就可能会有些棘手。虽然 Vue.js 通常鼓励开发人员使用“数据驱动”的方式思考，避免直接接触 DOM，但是有时我们必须要这么做。为了在数据变化之后等待 Vue 完成更新 DOM，可以在数据变化之后立即使用 Vue.nextTick(callback)。这样回调函数将在 DOM 更新完成后被调用。例如：

```js
var vm = new Vue({
  el: '#example',
  data: {
    message: '123'
  }
})
vm.message = 'new message' // 更改数据
vm.$el.textContent === 'new message' // false
Vue.nextTick(function () {
  vm.$el.textContent === 'new message' // true
})
```

在组件内使用 vm.$nextTick() 实例方法特别方便，因为它不需要全局 Vue，并且回调函数中的 this 将自动绑定到当前的 Vue 实例上：

```js
Vue.component('example', {
  template: '<span>{{ message }}</span>',
  data: function () {
    return {
      message: '未更新'
    }
  },
  methods: {
    updateMessage: function () {
      this.message = '已更新'
      console.log(this.$el.textContent) // => '未更新'
      this.$nextTick(function () {
        console.log(this.$el.textContent) // => '已更新'
      })
    }
  }
})
```

因为 $nextTick() 返回一个 Promise 对象，所以你可以使用新的 ES2017 async/await 语法完成相同的事情：

```js
methods: {
    // 1. 定义 async 函数
  updateMessage: async function () {
    this.message = '已更新'
    console.log(this.$el.textContent) // => '未更新'
    // 2. 在 await 后获取更新的值
    await this.$nextTick()
    console.log(this.$el.textContent) // => '已更新'
  }
}
```
### 1.2 nextTick 的应用
当我们更新 Vue 实例属性之后，由于更新队列的存在，我们是无法立刻获取更新的 DOM，通常我们也无须像上面一样直接从 DOM 中获取数据。但是如果跨组件的使用数据时，仍然会存在类似的现象，我们看下面这个示例:
1. 同前面一样，我们通过父子传值的方式，像子组件传入 msg 属性值
2. 子组件在 show 方法中通过 this.msg 正常获取父组件传入的值
3. 我们模拟后台异步获取数据，并在父组件中更新 msg，更新的同时通过 ref 调用子组件中的方法
4. 此时由于更新队列的存在，msg 的值还没更新至子组件，子组件是无法获取 msg 更新后的值的
6. 注意跟是否是异步加载无关，只要是更新 vue 属性并立刻调用子组件的方法，子组件都无法立刻获取最新的值

这个例子告诉我们，Vue 中尽量使用数据驱动的方式去更新 DOM 获取数据，而要避免直接通过操作 DOM 的方式，通过 ref 引用的方式就是直接操作 DOM。这里解决的方法就是使用 nextTick，在下一个事件循环中执行子组件的方法。

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
        {{msg}}
        <button ref="btn" @click="updateMsg">按钮</button>
        <!-- 1. 父组件向子组件传入了 msg 属性 -->
        <my-header ref="header" :msg="msg"></my-header>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>

    <script>
        const MyHeader = {
            template: `
                <div>
                    
                </div>
            `,
            props: ['msg'],
            methods: {
                // 2. 子组件中我们想获取，父组件传入的 msg 属性
                show(){
                    console.log(this.msg)
                }
            },
        }

        new Vue({
            el: "#app",
            data() {
                return {
                    msg: "v1",
                }
            },
            components:{
                MyHeader: MyHeader
            },
            methods: {
                // 5. 只要是更新 vue 属性并立刻调用子组件的方法，子组件都无法立刻获取最新的值
                updateMsg(){
                    this.msg = "V3"
                    this.$refs.header.show()
                }
            },
            created() {
                // 3. 模拟异步加载，我们从后端获取 msg 值后立马通过 ref 调用子组件中的方法
                // 4. 此时我们是无法立刻在子组件中获取更新后的 msg 值的
                setTimeout(() => {
                    this.msg = "v2"
                    this.$refs.header.show()
                }, 1000);
                // 5. 解决方法是，使用 nextTick 在下一个事件循环中取调用子组件方法
                setTimeout(() => {
                    this.msg = "v2"
                    this.$nextTick(function(){
                        this.$refs.header.show()
                    })
                    
                }, 1000);
            },
        })
    </script>
</body>
</html>
```
