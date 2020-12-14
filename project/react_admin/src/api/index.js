// 封装后端请求接口

import axios from './ajax'
import ajax from './ajax'

export const reqLogin = (username, password) => {
    return axios({
        method: 'post',
        url: '/api/login',
        data: {
            username,
            password
        }
    })
}
