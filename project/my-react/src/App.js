import Message from './component/P2C';
import Hoc from './component/Hoc';
import { PageA, PageB} from './component/WithVip';
import { HorizontalLoginForm } from './component/AntdTest';
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
    </div>
  );
}

export default App;
