import Message from './component/P2C';
import Hoc from './component/Hoc';
import { PageA, PageB} from './component/WithVip';
import { HorizontalLoginForm } from './component/AntdTest';
import BlockBack from './component/BlockBack';
import LoginDva from './component/LoginDva';
import Login from './component/Login';
import { Button } from 'antd'
import './App.css'

function App() {
  return (
    <div className="App">
      <Message></Message>
      <Button type='primary'>提交</Button>
      <Hoc></Hoc>
      <PageA></PageA>
      <PageB></PageB>

      <HorizontalLoginForm></HorizontalLoginForm>
      <br />
      <hr/>
      <BlockBack></BlockBack>
      <br />
      <hr />
      
      <Login></Login>
      <br />
      <hr />
      
      {/* <LoginDva></LoginDva> */}
    </div>
  );
}

export default App;
