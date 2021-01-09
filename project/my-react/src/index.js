import React from 'react';
import './index.css';
import App from './App';
import user from './models/user'

import dva from 'dva'
const app = dva();

app.model(user);
app.router(() => <App />);
app.start('#root');
// ReactDOM.render(
//   <React.StrictMode>
//     <Provider store={ store }>
//       <App />
//     </Provider>    
//   </React.StrictMode>,
//   document.getElementById('root')
// );

// // If you want to start measuring performance in your app, pass a function
// // to log results (for example: reportWebVitals(console.log))
// // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
