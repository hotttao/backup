import VueRouter from "vue-router";
import Vue  from "vue";
import About from '@/views/About';
import Home from '@/views/Home'

Vue.use(VueRouter)

export default new VueRouter({
    routes: [
        {
            path: '/',
            component: Home
        },
        {
            path: '/about',
            component: About
        }
    ]
})
