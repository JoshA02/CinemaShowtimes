import React, {useEffect, useRef, useState} from 'react';
import logo from './logo.svg';
import '../App.css';
import {Showing} from '../types';
import ShowingListItem from '../components/ShowingListItem';
import AttendanceListItem from '../components/AttendanceListItem';

function Schedule() {
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0);
  const [showings, setShowings] = useState([] as Showing[]);
  const [unfilteredShowings, setUnfilteredShowings] = useState([] as Showing[]);

  const [mode, setMode] = useState<'showings' | 'attendance'>('showings');
  const [statusMessage, setStatusMessage] = useState('' as string);
  
  // Refs to keep track of time calculations without causing re-renders //
  const startTime = useRef(new Date(Date.now() - 1000 * 60 * 10)); // 10 minutes ago to be aware of any potential late guests  
  const hourRoundDown = useRef(new Date().setMinutes(0, 0, 0));
  const nextHour = useRef(new Date(hourRoundDown.current + 1000 * 60 * 60)); // The next whole hour
  const hoursTillMidnight = useRef(24 - new Date().getHours());
  const latestTime = useRef(new Date(new Date(Date.now() + 1000 * 60 * 60 * 24).setHours(1,0,0))); // 1am the next day

  // Upon loading, keep ticking the time since last update:
  useEffect(() => {
    const interval = setInterval(() => {
      setSecsSinceUpdate(secsSinceUpdate + 1);

      // Update the time calculations:
      const now = new Date();
      startTime.current = new Date(Date.now() - 1000 * 60 * 10);
      hourRoundDown.current = new Date(now.setMinutes(0, 0, 0)).getTime();
      nextHour.current = new Date(hourRoundDown.current + 1000 * 60 * 60);
      hoursTillMidnight.current = 24 - now.getHours();

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
          return showingTime > startTime.current && showingTime < latestTime.current;
        });
        tempShowings = tempShowings.sort((a, b) => a.time > b.time ? 1 : -1);
        setShowings(tempShowings);
        setUnfilteredShowings(data.data as Showing[]);
        setSecsSinceUpdate(Math.floor((Date.now() - data.timeFetched) / 1000));
        setStatusMessage('');
      })
      .catch(() => {throw new Error('Failed to fetch showtimes.')});
  }

  function GetRemainingAttendance(): number {
    if(!showings) return 0;
    return(showings.reduce(( (acc, showing) => acc + showing.seatsOccupied ), 0));
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

  /**
   * Get the total attendance between two dates
   * @param start The start date
   * @param end The end date
   * @returns The total attendance between the two dates
   */
  function GetAttendanceBetween(start: Date, end: Date): number {
    return unfilteredShowings.filter(showing => {
      const showingTime = new Date(showing.time);
      return showingTime >= start && showingTime <= end;
    }).reduce((acc, showing) => acc + showing.seatsOccupied, 0);
  }  

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
        <div>

          {/* One hour from this exact time, rounding end to closest hour */}
          <AttendanceListItem 
            start={startTime.current}
            end={nextHour.current}
            attendance={GetAttendanceBetween(new Date(), new Date(Date.now() + 1000 * 60 * 60))}
          />

          {/* The remaining hours of today */}
          {
            // Create an attendance list item for each hour in the future, excluding the current hour
            Array.from({length: hoursTillMidnight.current}, (_, i) => {
              const start = new Date(hourRoundDown.current + (i + 1) * 1000 * 60 * 60);
              const end = new Date(start.getTime() + 1000 * 60 * 60);
              return (
                <AttendanceListItem 
                  key={i} 
                  start={start} 
                  end={end} 
                  attendance={GetAttendanceBetween(start, end)} />
              );
            })
          }

        </div>
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
