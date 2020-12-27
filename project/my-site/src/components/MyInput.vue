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
      this.$emit("input", this.inputVal);
      // 3. 触发 form-item 中的数据校验
      this.$parent.$emit("validate", this.inputVal);
    },
  },
};
</script>

<style lang="scss" scoped>
</style>