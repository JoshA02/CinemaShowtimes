import React, {useEffect, useState} from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0);
  const apiURL = process.env.REACT_APP_API_URL;

  // Upon loading, keep ticking the time since last update:
  useEffect(() => {
    const interval = setInterval(() => {
      setSecsSinceUpdate(secsSinceUpdate + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secsSinceUpdate]);

  // Fetch the schedule from the server:
  useEffect(() => {
    fetch(apiURL + '/showtimes')
      .then(res => res.json())
      .then(data => {
        console.log(data);
      });
  }, [apiURL]);
  
  return (
    <div className="App">
      <h2>Schedule</h2>
      <span className='flex-hoz'><h3>Last updated&nbsp;</h3><h3 className='bold'>{SecsToHMS(secsSinceUpdate)}</h3></span>
      <span className='flex-hoz'><h3>Remaining&nbsp;</h3><h3 className='bold'>67</h3></span>

      <div className='showing-list'>

      </div>
    </div>
  );
}

function SecsToHMS(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  return (
    (hours > 0 ? `${hours}h ` : '') +
    (minutes > 0 ? `${minutes}m ` : '') +
    (seconds > 0 ? `${seconds}s` : '')
  );
}

export default App;
