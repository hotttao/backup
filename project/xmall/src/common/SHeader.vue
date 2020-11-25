<template>
    <header class="header">
        <router-link to="/" title="Xmall 商城" class="logo">Xmall 商城</router-link>
        <el-input
            placeholder="请输入商品信息"
            suffix-icon="el-icon-search"
            v-model="productInfo"
            minlength="1"
            maxlength="100"
        ></el-input> 
        <router-link to="/goods">全部商品</router-link>
        <router-link to="/thanks">捐赠</router-link>
    </header>
</template>

<script>
    export default {
        data() {
            return {
                productInfo: ''
            }
        },
    }
</script>

<style lang="scss" scoped>
    .header{
        display: grid;
        grid-column: 200px repeat(1f 10) 200px;
    }
    .logo {
        background: url(/static/images/global-logo-red@2x.png) no-repeat 50%;
        background-size: cover;
        display: block;
        width: 50px;
        height: 40px;
        text-indent: -9999px;
        background-position: 0 0;
    }
    .header > a{
        display: block;
    }
</style>