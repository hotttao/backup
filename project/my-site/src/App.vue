<template>
  <div id="app">
    <router-link to="/">Home</router-link>|
    <router-link to="/about">About</router-link>
    <router-view></router-view>
    <router-view name="main"></router-view>
    <router-view name="sider"></router-view>
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
