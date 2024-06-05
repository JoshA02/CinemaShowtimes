import React, {useEffect, useState} from 'react';
import logo from './logo.svg';
import '../App.css';
import {Showing} from '../types';
import ShowingListItem from '../components/ShowingListItem';

function Schedule() {
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0);
  const [showings, setShowings] = useState([] as Showing[]);
  const [mode, setMode] = useState<'showings' | 'attendance'>('showings');
  const [statusMessage, setStatusMessage] = useState('' as string);

  // Upon loading, keep ticking the time since last update:
  useEffect(() => {
    const interval = setInterval(() => {
      setSecsSinceUpdate(secsSinceUpdate + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secsSinceUpdate]);

  // Fetch the schedule from the server:
  async function updateSchedule() {
    const apiURL = process.env.REACT_APP_API_URL;
    const currentSessionId = new URLSearchParams(window.location.search).get('sessionId') || '';
    const searchParams = new URLSearchParams();
    searchParams.append('sessionId', currentSessionId);

    setStatusMessage('Updating schedule...');
    await fetch(apiURL + `/showtimes?${searchParams.toString()}`).then(res => {
      if(!res.ok){
        if(res.status === 401) return window.location.href = '/'; // Redirect to login page if session is invalid.
        throw new Error(`Failed to fetch showtimes. Status code: ${res.status}`);
      }
      return res.json();
    }).then(data => {
        if(!data.data) throw new Error('No showings returned.');
        let tempShowings: Showing[] = data.data;
        if(!tempShowings) return;
        tempShowings = tempShowings.filter(showing => {
          const showingTime = new Date(showing.time);
          return showingTime > new Date() && showingTime.getDate() === new Date().getDate()
        });
        tempShowings = tempShowings.sort((a, b) => a.time > b.time ? 1 : -1);
        setShowings(tempShowings);
        setSecsSinceUpdate(Math.floor((Date.now() - data.timeFetched) / 1000));
        setStatusMessage('');
      })
      .catch(() => {throw new Error('Failed to fetch showtimes.')});
  }

  function GetRemainingAttendance(): number {
    if(!showings) return 0;
    const currentDate = new Date();
    return(
      showings.filter(showing => {
        const showingTime = new Date(showing.time);
        return showingTime > currentDate && showingTime.getDate() === currentDate.getDate();
      }).reduce(( (acc, showing) => acc + showing.seatsOccupied ), 0)
    );
  }

  useEffect(() => {
    function scheduleUpdateHandler() {
      updateSchedule()
        .then(() => setTimeout(() => scheduleUpdateHandler(), 1000 * 30)) // Update every 30 seconds
        .catch((e) => {
          console.log(e);
          setStatusMessage('Failed to update schedule. Retrying...');
          setTimeout(() => scheduleUpdateHandler(), 1000 * 3); // Retry every 3 seconds
        });
    }

    scheduleUpdateHandler();
  }, []);
  

  return (
    <div className="App">
      <h2>Schedule</h2>
      <span className='flex-hoz'><h3>Last updated&nbsp;</h3><h3 className='bold'>{SecsToHMS(secsSinceUpdate)} ago</h3></span>
      <span className='flex-hoz'><h3>Remaining&nbsp;</h3><h3 className='bold'>{GetRemainingAttendance()} guests</h3></span>
      {statusMessage && <span className='statusMessage bold'>{statusMessage}</span>}

      <div className="viewSelectionContainer">
        <div className={`selection ${mode === 'showings' ? 'active' : ''}`} onClick={() => setMode("showings")}><span>Showings</span></div>
        <div className={`selection ${mode === 'attendance' ? 'active' : ''}`} onClick={() => setMode("attendance")}><span>Attendance</span></div>
      </div>


      {mode === 'showings' && (
        <div>
          {showings.map((showing, index) => (
            <ShowingListItem showing={showing} key={index}/>
          ))}
        </div>
      )}

      {mode === 'attendance' && (
        <h2 className='bold'>Coming Soon</h2>
      )}
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
    (`${seconds}s`)
  );
}

export default Schedule;
