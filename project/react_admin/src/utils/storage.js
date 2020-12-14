const KEY_USER = 'USER_INFO'

export default {
    saveUser(user) { 
        localStorage.setItem(KEY_USER, JSON.stringify(user))
    },
    getUser() { 
        return JSON.parse(localStorage.getItem(KEY_USER)) || {}
    },
    removeUser() { 
        localStorage.removeItem(KEY_USER)
    }
}
