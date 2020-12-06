<template>
    <div>
        {{ruleForm}}
        <MForm :model="ruleForm" :rules="rules" ref="ruleForm">
            <MFormItem label="用户名" prop="name">
                <MInput v-model="ruleForm.name"></MInput>
            </MFormItem>

            <MFormItem label="密码" prop="password">
                <MInput type="password" v-model="ruleForm.password"></MInput>
            </MFormItem>
            <button @click="submitForm('ruleForm')">提交</button>
        </MForm>
        
        
    </div>
</template>

<script>
    import MInput from "./Input"
    import MFormItem from "./FormItem"
    import MForm from './Form'
    export default {
        components: {
            MInput,
            MFormItem,
            MForm
        },
        methods: {
            submitForm(name) {
                this.$refs[name].validate((validate)=>{
                    if (validate){
                        alert("验证成功，可以提交")
                    }else{
                        alert("验证失败，不能提交")
                    }
                })
            }
        },
        data() {
            return {
                ruleForm: {
                    name: '',
                    password:''
                },
                rules: {
                    name:[
                            {required:true,message:'请输⼊名称'},
                            {min:6,max:10,message:'请输⼊6~10位⽤户名'}
                        ],
                    password:[
                            {required:true,message:'请输⼊密码'}
                        ]
                }
            }
        },
    }
</script>
