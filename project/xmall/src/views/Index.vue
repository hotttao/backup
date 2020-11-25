<template>
    <div>
        <m-header></m-header>
        <router-view></router-view>

        <s-header></s-header>
    </div>
</template>

<script>
    import MHeader from '@/common/MHeader.vue';
    import SHeader from '@/common/SHeader.vue';
    export default {
        components:{
            MHeader,
            SHeader
        }
        
    }
</script>

<style lang="scss" scoped>

</style>