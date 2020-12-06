<template>
    <div>
        <slot></slot>
    </div>
</template>

<script>
    export default {
        data() {
            return {
                formItems: []
            }
        },
        created () {
            this.$on('formAdd', item=>{
                this.formItems.push(item)
            });
        },
        provide(){
            return {
                'form': this
            }
        },
        props: {
            model: {
                type: Object,
                required: true 
            },
            rules: {
                type: Object
            }
        },
        methods: {
            validate(callback) {
                console.log("form submit check")
                let ret = true
                const checks = this.formItems.map(item=>{
                    console.log(this.model[item.prop])
                    return item.validate(this.model[item.prop])
                })
                Promise.all(checks).then(results=>{
                    
                    results.forEach(validate=>{
                        console.log(validate)
                        if (!validate){
                            ret = false
                        }
                    })
                    callback(ret)
                })
            }
        },
    }
</script>

<style lang="scss" scoped>

</style>