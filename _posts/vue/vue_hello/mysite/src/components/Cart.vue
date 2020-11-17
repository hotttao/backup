<template>
    <div>
        <table border="1">
            <tr>
                <th>#</th>
                <th>课程</th>
                <th>单价</th>
                <th>数量</th>
                <th>总价</th>
            </tr>
            <tr v-for="(item, index) in cartList" :key="index">
                <td>
                    <input type="checkbox" v-model="item.active">
                </td>
                <td>{{item.name}}</td>
                <td>{{item.price}}</td>
                <td>
                    <button @click="subCart(index)">-</button>
                    {{item.count}}
                    <button @click="addCart(index)">+</button>
                </td>
                <td>{{item.price * item.count}}</td>
            </tr>
            <tr>
                <td></td>
                <td colspan="2">{{cartTotal}}</td>
                <td colspan="2">{{money}}</td>
            </tr>
        </table>
    </div>
</template>

<script>
    export default {
       name: "cart",
       props: [],
       data() {
           return {
                cartList: JSON.parse(localStorage.getItem('cartList')) || []
           }
       },
       watch: {
           cartList: {
               handler(n){
                   this.setLocalData(n)
               },
               deep: true
           }
       },
       created () {
           this.$bus.$on("addCart", good=>{
               let ret = this.cartList.find(item=> item.id ==  good.id);
            //    console.log(ret);
               if (ret){
                   ret.count ++;
               } else{
                   this.cartList.push(good);
               }
               
           });
       },
       computed: {
           money(){
               return this.cartList.reduce((sum, pwd)=>{
                   sum += pwd.price * pwd.count;
                   return sum;
               }, 0)
           },
           cartTotal(){
               return this.cartList.filter(item=>item.active).length;
           }
       },
       methods: {
           setLocalData(data){
               localStorage.setItem("cartList", JSON.stringify(data));
           },
           removeCart(i){
               if (window.confirm("确定要删除么？")){
                    this.cartList.splice(i, 1);
               }
           },
           subCart(i){
               if (this.cartList[i].count > 1){
                   this.cartList[i].count --;
               } else{
                   this.removeCart(i)    
               }
               
           },
           addCart(i){
               this.cartList[i].count ++;
           }
       },
    }
</script>

<style scoped>

</style>