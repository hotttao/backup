
const initState = {
    isLogin: false,
    userInfo: {

    }
    
}

export const mapUserState = (state) => { 
    return {
        user: state.user
    }
}

export const mapUserOp = (dispatch) => ({ 
    login: () => { 
        // login_request 就是 redux-saga 定义的 action
        dispatch({type: "login_request"})
    }
})

function user(state = initState, action) { 
    switch (action.type) {
        case 'login':
            return {userInfo: action.result, isLogin: true}
            break;
        default:
            return state
    }
}

export default user