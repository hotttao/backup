// 封装同一的网络请求，并添加各种请求前后的处理钩子函数

import axios from 'axios'
import qs from 'qs'
import { message } from 'antd'

// 请求拦截器
axios.interceptors.request.use(function (config) {
    // Do something before request is sent
    const { method, data } = config
    if (method.toLocaleLowerCase() === 'post' && typeof data === 'object') { 
        config.data = qs.stringify(data)
        
    }
    return config;
  }, function (error) {
    // Do something with request error
    return Promise.reject(error);
  });


// 响应拦截器
axios.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return response.data;
}, function (error) {
        message.error("请求失败:" + error.message)
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    // return Promise.reject(error);
        // 让错误处于 pending 状态，不再往下进行
        return new Promise(() => { })
});
  
export default axios
