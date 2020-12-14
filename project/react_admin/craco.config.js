const CracoLessPlugin = require('craco-less');

module.exports = {
  babel: {   //用来支持装饰器
	   plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]]
  },
  plugins: [
    {
      plugin: CracoLessPlugin,
      options: {
        lessLoaderOptions: {
          lessOptions: {
            modifyVars: { '@primary-color': '#1DA57A' },
            javascriptEnabled: true,
          },
        },
      },
    },
  ],
  devServer: {
    proxy: {
        "/api": {
            target: "http://localhost:5000",  
            //target: 'http://192.168.9.19:8080',
            changeOrigin: true,
            pathRewrite: {
                "^/api": ""
            }
        }
    }
}
};