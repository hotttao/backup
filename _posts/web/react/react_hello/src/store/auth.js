const authInfo = {
    isLogin: false,
    userInfo: {

    }
}

export function auth(state=authInfo, action){
    switch (action.type) {
        case 'login':
            return {isLogin: true}
        default:
            return state;
    }
}

export const mapAuthState = state => {
    return {
        auth: state.auth
    }
}

const Login = (dispatch)=>{
        setTimeout(()=>{
            dispatch({type: 'login'})
        }, 1000)
}

export const mapAuthDisPatch = dispatch => {
    return {
        login: ()=>{
            dispatch(Login)
        }
    }
}