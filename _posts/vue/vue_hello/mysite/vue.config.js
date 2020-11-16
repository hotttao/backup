module.exports = {
    devServer: {
        before(app, server){
            app.get('/api/cartList', (req, res)=>{
                res.json(
                    {
                        result: [
                            {id: 1, name: "Vue实战", price: 188, active: true, count: 0},
                            {id: 2, name: "React实战", price: 288, active: true, count: 0}
                        ]
                    }
                )
            })
        }
    }
  }
  