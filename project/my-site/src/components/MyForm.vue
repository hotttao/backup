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