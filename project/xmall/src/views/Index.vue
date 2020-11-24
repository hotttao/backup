<template>
    <div>
        <m-header></m-header>
        <router-view></router-view>
    </div>
</template>

<script>
    import MHeader from '@/common/MHeader.vue';
    export default {
        components:{
            MHeader
        }
        
    }
</script>

<style lang="scss" scoped>

</style>