<template>
    <header class="header">
        <div class="logo">
            <router-link to="/" title="商城官网">Xmall商城</router-link>
        </div>
        <div class="search">
            <el-input
                placeholder="请输入商品信息"
                suffix-icon="el-icon-search"
                v-model="productInfo"
                minlength="1"
                maxlength="100"
              ></el-input> 
        </div>
        <div class="good">
            <router-link to="/goods">全部商品</router-link>
        </div>
        <div class="thanks">
            <router-link to="/thanks">捐赠</router-link>
        </div>
        <div class="user">user</div>
        <div class="buy">buy</div>
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
        grid-template-columns: 1fr 50px 6fr 300px 0.3fr 80px 0.3fr 80px 1fr 50px 0.2fr 50px 1fr;
        grid-template-areas: 
        ". logo . search . good . thanks . user . buy .";
        height: 100px;
        grid-gap: 2px;
        background-color: black;
    }
    .header > div{
        margin: auto 0;
        height: 40px;
        // background-color: cadetblue;
    }
    .logo{
        grid-area: logo;
        background: url(/static/images/global-logo-red@2x.png) no-repeat 50%;
        background-size: cover;
        display: block;
        width: 50px;
        height: 40px;
        text-indent: -9999px;
        background-position: 0 0;
    }
    .search{
        grid-area: search;
    }
    .good{
        grid-area: good;
        height: 20px;
    }
    .thanks{
        grid-area: thanks;
    }
    .user{
        grid-area: user;
    }
    .buy{
        grid-area: buy;
    }

</style>