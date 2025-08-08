import {useEffect, useState} from 'react';
import Schedule from './pages/Schedule';
import Login from './pages/Login';

export const BUSY_THRESHOLD = 25; // Number of occupied seats to consider a showing busy
export const FAR_AHEAD_THRESHOLD = 1000 * 60 * 15; // Time in milliseconds to consider a showing not imminent (15 minutes)

export default function App() {
  
  const [sessionId, setSessionId] = useState('' as string);

  useEffect(() => {
    // If URL starts with http, redirect to https; Backend only allows requests from the https URL.
    if(process.env.NODE_ENV === 'production' && window.location.href.startsWith('http://')) window.location.href = window.location.href.replace('http://', 'https://');

    // If a sessionId is provided in the URL, set it.
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    if(sessionId != null) setSessionId(sessionId);
  }, []);
  
  
  return (
    <div>
      {sessionId === '' ? <Login/> : <Schedule/>}
    </div>
  )
}
