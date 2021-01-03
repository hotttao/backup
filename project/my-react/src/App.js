import Message from './component/P2C';
import { Button } from 'antd'
import './App.css'

function App() {
  return (
    <div className="App">
      <Message></Message>
      <Button type='primary'>提交</Button>
    </div>
  );
}

export default App;
