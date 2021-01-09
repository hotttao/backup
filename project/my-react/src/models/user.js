// 异步请求的接口，将被 call 方法调用
function login(name) { 
    return () => {
        return new Promise((resolve) => {
            return setTimeout(() => {
                resolve({ id: 1, name })
            }, 1000)
        })
    }
}

export default {
    namespace: 'user', // dva model 的命名空间，用于区分其他 model
    state: {           // 共享的数据
        isLogin: false,
        userInfo: {

        }
    },
    reducers: {       // reducer 同步方法
        // 直接修改 state 中的数据
        initLogin(state, action) { 
            // state 是当前的状态，action 是组件触发的动作，包括传入的载荷
            return {'userInfo': action.userInfo}
        }

    },
    effects: {        // effects 异步方法
        *login(action, { call, put }) { 
            console.log(action)
            const ret = yield call(login(action.name))
            // put 将操作提交至 reducer 进行同步修改
            yield put({
                type: 'initLogin',
                userInfo: ret
            })
        }

    }
}