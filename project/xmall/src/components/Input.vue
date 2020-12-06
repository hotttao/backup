<template>
    <div>
        <input :type="type" :value="inputValue" @input="handleInput">
    </div>
</template>

<script>
    export default {
        props: {
            value: {
                type: String,
                default: ''
            },
            type: {
                type: String,
                default: 'text'
            }
        },
        data() {
            return {
                inputValue: this.value
            }
        },
        methods: {
            handleInput(e) {
                this.inputValue = e.target.value
                this.$emit("input", this.inputValue)
                this.$parent.$emit('validate', this.inputValue)
            }
        },
        
    }
</script>
