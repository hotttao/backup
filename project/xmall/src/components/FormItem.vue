<template>
    <div>
        <label v-if="label">{{label}}</label>
        <slot></slot>
        <p v-if="validateStatus ==='error'">{{errMsg}}</p>
    </div>
</template>

<script>
    import Schema from 'async-validator';
    export default {
        inject: ['form'],
        data() {
            return {
                errMsg: '',
                validateStatus: ''
            }
        },
        created () {
            this.$on('validate', this.validate);
        },
        mounted () {
            this.form.$emit("formAdd", this);
        },

        methods: {
            validate(value) {
                return new Promise(resolve=>{
                    console.log(value)
                    const descriptor = {
                        [this.props]: this.form.rules[this.prop]
                    }
                    const obj = {[this.name]: value}
                    const validator = new Schema(descriptor);

                    validator.validate(obj, errors=>{
                        if (errors){
                            this.validateStatus = 'error'
                            this.errMsg = errors[0].message
                            resolve(false)
                        }else{
                            this.validateStatus = ''
                            this.errMsg = ''
                            resolve(true)
                        }
                    })
                })
                
            }
        },
        props: {
            label: {
                type: String,
                default: ''
            },
            prop: {
                type: String,
                default: ''
            }
        },
    }
</script>

<style lang="scss" scoped>

</style>