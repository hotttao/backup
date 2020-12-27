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