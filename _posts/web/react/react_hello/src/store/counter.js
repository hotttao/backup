export function counter(state = 0, action){
    // action.type 是 Action dispatch 触发的动作类型
     switch (action.type) {
        case "+":
             return state + 1
             break;
        case "-":
            return state - 1
        default:
            return state
     }
}
