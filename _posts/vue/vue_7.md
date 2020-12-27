---
title: 7 设计与实现 Element UI 的 form 表单
date: 2020-10-07
categories:
    - 前端
tags:
	- Vue
---
Element UI 表单设计组件
<!-- more -->

## 1. Element UI 组件安装

```bash
# https://element.eleme.cn/#/zh-CN/component/quickstart
# 1. 安装
cnpm i element-ui
# 借助 babel-plugin-component 可以实现按需导入 element-ui 组件 
cnpm i babel-plugin-component -D

# 2. 修改 .babelrc
{
  "presets": [["es2015", { "modules": false }]],
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}

# 3. 方式二: 使用 vue add element 在交互页面选择按需导入
vue add element
```

## 2. Element 表单组件分析
下面是从 ElementUI 官网摘取的一个 Form 表单示例:

```vue
<template>
  <div>
    <el-form
      :model="ruleForm"  // 表单绑定的数据
      status-icon
      :rules="rules"     // 验证的规则
      ref="ruleForm"
      label-width="100px"
      class="demo-ruleForm"
    >
      <el-form-item label="密码" prop="pass">
        <el-input
          type="password"
          v-model="ruleForm.pass"
          autocomplete="off"
        ></el-input>
      </el-form-item>
      <el-form-item label="确认密码" prop="checkPass">
        <el-input
          type="password"
          v-model="ruleForm.checkPass"
          autocomplete="off"
        ></el-input>
      </el-form-item>
      <el-form-item label="年龄" prop="age">
        <el-input v-model.number="ruleForm.age"></el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm('ruleForm')"
          >提交</el-button
        >
        <el-button @click="resetForm('ruleForm')">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      ruleForm: {
        pass: "",
        checkPass: "",
        age: "",
      },
      rules: {
        pass: [{ validator: validatePass, trigger: "blur" }],
        checkPass: [{ validator: validatePass2, trigger: "blur" }],
        age: [{ validator: checkAge, trigger: "blur" }],
      },
    };
  }
};
</script>


<style lang="scss" scoped>
</style>
```

可以看到  ElementUI 的 Form 表单分成了如下三个部分:
1. el-form: 
  - 作用: 定义数据和校验规则
2. el-form-item:
  - 作用: 
    - 有 prop 属性的 el-input: 通过 prop 关联 el-form 中的数据和校验规则，并进行校验和显示错误信息
    - 无 prop 属性的 el-input: 显示信息
3. el-input:
  - 作用: 
    - 负责双向数据绑定，将数据同步到 el-form 上
    - 通知 el-form-item 做数据校验

接下来我们就仿照 ElementUI 来实现一个我们自己的 Form 表单

## 3. 自定义 Form 表单
### 3.1 实现双向数据绑定的 Input 
双向数据绑定 v-mode == v-bind:value + v-on:input，下面是我们自定义 MyInput 的实现:

```vue
<template>
  <div>
    <input :type="type" :value="inputVal" @input="handleInput" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputVal: this.value,
    };
  },
  props: {
    type: {
      type: String,
      default: "text",
    },
    // A. MyInput 的 value 属性值
    value: {
      type: String,
      default: "",
    },
  },
  methods: {
    handleInput(e) {
      // 1. 通过 input 事件更新输入框的值
      this.inputVal = e.target.value;
      // 2. 触发绑定在当前的 MyInput 组件上的 input 事件实现双向数据绑定
      // 要实现双向数据绑定的是 MyInput 组件，v-model 绑定的  MyInput value 属性和 input 事件
      // B. MyInput 的 input 事件
      this.$emit("input", this.inputVal);
      // 3. 触发 form-item 中的数据校验
      this.$parent.$emit("validate", this.inputVal);
    },
  },
};
</script>

<style lang="scss" scoped>
</style>
```

### 3.2 Form 组件结构表单数据和校验规则
Form 组件需要做如下几个事情:
1. 作为最外层的父组件，需要接收数据和校验规则，并通过 provide 将其传给子组件 FormItem
2. 保存所有 FormItem，用以在 submit 时调用所有 FormItem 进行提交前的验证

```vue
<template>
  <div>
    <slot></slot>
  </div>
</template>

<script>
export default {
  // 1. props 接收表单数据和校验规则
  data() {
    return {
      formItems: [],
    };
  },
  props: {
    model: {
      type: Object,
      require: true,
    },
    rules: {
      type: Object,
    },
  },
  methods: {
    // 2. 表单提交时的校验规则
    validate(callback) {
      // 获取所有的验证结果，并同一处理
      console.log(this.formItems);
      const tasks = this.formItems.map((item) =>
        // 记住需要传入对应表单的值
        item.validate(this.model[item.prop])
      );
      let ret = true;
      Promise.all(tasks).then((results) => {
        results.forEach((valid) => {
          if (!valid) {
            ret = false;
          }
        });
        // callback 必须放在 Promise 内，因为 Promise 是在下一个事件循环才执行的
        callback(ret);
      });
    },
  },
  created() {
    // 3. 注册事件，FormItem 通过触发相应事件注册自身到 Form 组件中
    this.$on("addItem", (item) => {
      this.formItems.push(item);
    });
  },
  provide() {
    return {
      model: this.model,
      rules: this.rules,
    };
  },
};
</script>

<style lang="scss" scoped>
</style>
```

### 3.3 FormItem
FormItem 中需要做如下几个事情:
1. 通过 prop 属性获取绑定的表单字段以及值
2. 通过 inject 接收 Form 组件注入的验证规则
3. 使用 async-validator 进行规则校验，并显示错误信息
4. 将自身注册到父组件 Form 中

在编写 FormItem 的代码前，我们需要先安装 `cnpm i async-validator -S `

```vue
<template>
  <div>
    <label v-if="label">{{ label }}</label>
    <slot></slot>
    <!-- 显示校验的错误信息 -->
    <p v-if="status === 'error'" class="error">{{ errorMsg }}</p>
  </div>
</template>

<script>
import Schema from "async-validator";
export default {
  data() {
    return {
      status: "", // 校验的状态
      errorMsg: "", // 错误信息
    };
  },
  props: {
    label: {
      type: String,
      default: "",
    },
    prop: {
      type: String,
      default: "",
    },
  },
  mounted() {
    // 4. 将自身注册到 Form 组件中，所以更好的方式
    if (this.prop) {
      // 5. 因为 FormItem 可能是不带 prop 的 FormItem，所以必须判断
      this.$parent.$emit("addItem", this);
    }
  },
  // 1. inject 接收父组件传过来的表单数据和校验规则
  inject: ["model", "rules"],
  methods: {
    validate(value) {
      // 因为 aysnc-validator 是通过回调函数获取校验结果的，所以要想拿到校验结果，必须通过 Promise
      return new Promise((resolve) => {
        console.log(value); // 1. 输入框输入的值
        // 2. 获取父辈 Form 组件中的校验规则
        const descriptor = { [this.prop]: this.rules[this.prop] };
        console.log(descriptor);
        const validator = new Schema(descriptor);
        // 3. 执行校验
        validator.validate({ [this.prop]: value }, (errors) => {
          if (errors) {
            console.log(errors);
            this.status = "error";
            this.errorMsg = errors[0].message;
            resolve(false);
          } else {
            this.status = "";
            this.errorMsg = "";
            resolve(true);
          }
        });
      });
    },
  },
  created() {
    this.$on("validate", this.validate);
  },
};
</script>

<style scoped>
.error {
  color: red;
}
</style>
```

### 3.4 自定义表单组件的使用

```vue
<template>
  <div id="app">
    <ElForm></ElForm>
    {{ ruleForm }}
    <!-- MyForm  绑定表单数据和校验规则 -->
    <MyForm :model="ruleForm" :rules="rules" ref="my-form">
      <!-- FormItem 执行具体校验规则并显示错误信息 -->
      <MyFormItem label="用户" prop="name">
        <!-- Input 实现双向数据绑定 -->
        <MyInput v-model="ruleForm.name"></MyInput>
      </MyFormItem>
      <MyFormItem label="密码" prop="passwd">
        <MyInput type="password" v-model="ruleForm.passwd"></MyInput>
      </MyFormItem>
      <!-- 表单提交的校验事件，通过 ref 引用 Form 表单 -->
      <button @click="submit('my-form')">提交</button>
    </MyForm>
  </div>
</template>

<script>
import ElForm from "./components/ElForm";
import MyInput from "./components/MyInput";
import MyFormItem from "./components/MyFormItem";
import MyForm from "./components/MyForm";

export default {
  name: "app",
  components: {
    ElForm,
    MyInput,
    MyFormItem,
    MyForm,
  },
  methods: {
    // 表单提交的校验事件，通过 ref 引用表单
    submit(name) {
      console.log(this.$refs[name]);
      this.$refs[name].validate((valid) => {
        if (valid) {
          console.log("校验成功");
        } else {
          console.log("校验失败");
        }
      });
    },
  },
  data() {
    return {
      ruleForm: {
        name: "",
        passwd: "",
      },
      rules: {
        name: [{ type: "string", required: true, message: "Name is required" }],
        passwd: [
          { type: "string", required: true, message: "Password is required" },
        ],
      },
    };
  },
};
</script>

<style>
</style>

```