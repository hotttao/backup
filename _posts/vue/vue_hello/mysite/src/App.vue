<template>
  <div id="app">
    <h3>购物车</h3>
    <ul v-for="(item, index) in cartList" :key="item.id">
      <li>
        <h4>{{item.name}}</h4>
        <p>{{item.price}}</p>
        <button @click='addCart(index)'>添加购物车</button>
      </li>
    </ul>
    <!-- <Cart :cartList="cartList"></Cart> -->
    <Cart></Cart>
  </div>
</template>

<script>
import Cart from "./components/Cart.vue"


export default {
  name: 'App',
  data() {
    return {
      cartList: []
    }
  },
  async created() {
    try {
      const res = await this.$http.get("/api/cartList");
      this.cartList = res.data.result;
    } catch (error) {
      console.log(error)
    }
  },
  components: {
    Cart
  },
  methods: {
    addCart(i) {
      let good = this.cartList[i];
      this.$bus.$emit("addCart", good);
    }
  },
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* text-align: center; */
  color: #2c3e50;
  margin-top: 60px;
}
</style>
