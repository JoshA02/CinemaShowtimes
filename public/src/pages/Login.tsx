import React, {useRef, useState} from 'react'
import '../App.css';
import './Login.css'

export default function Login() {
  
  const password = useRef("");
  const [statusMessage, setStatusMessage] = useState('');
  
  function login() {
    const apiURL = process.env.REACT_APP_API_URL;
    fetch(apiURL + `/authenticate?token=${password.current.toString()}`).then(res => {
      if(res.status === 200){
        return res.json().then(data => {
          window.location.href = `/?sessionId=${data.sessionId}`;
        });
      }
      console.log(res.status);
      setStatusMessage('Invalid password');
    });
  }

  return (
    <div>
      <h1>Login</h1>
      <p>A password is required to access this page.</p>

      <form className="loginContainer" onSubmit={(e) => {e.preventDefault(); login()}}>
        <input type="password" placeholder="Password" onChange={(e) => password.current = e.target.value} />
        <button>Login</button>
      </form>
      <span className='statusMessage noFlash'>{statusMessage}</span>
    </div>
  )
}
