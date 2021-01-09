import { call, put, takeEvery } from 'redux-saga/effects'

const api = {
    login: async () => { 
        return new Promise((resolve, reject) => { 
            setTimeout(() => { 
                resolve({id:1, name: "小马哥"})
            }, 1000)
        })
    }
}

// 1. 创建的 Work Sage
function* login(action) { 
    try {
        const result = yield call(api.login)
        console.log(result)
        // 1. dispatch 触发 reducer 里面的同步操作
        yield put({'type': 'login', result})
    } catch (error) {
        yield put({'tyoe': 'loginErr', message: error.message})
    }
    
}

// 2. 将 login 与 Saga 关联起来，类似监听
function* loginSaga() { 
    // login_saga 相当于 saga 的 action
    yield takeEvery("login_request", login)
}

export default loginSaga