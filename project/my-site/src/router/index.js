import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '../views/Home.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    components: {
      default: Home,
      main: ()=>import('../views/Main'),
      sider: ()=>import('../views/Sider')
    }
  },
  {
    path: '/about',
    name: 'About',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    components: {
      default: () => import(/* webpackChunkName: "about" */ '../views/About.vue'),
      main: ()=>import('../views/Main')
      
    }
  }
]

const router = new VueRouter({
  routes
})

export default router
