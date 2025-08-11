import {useEffect, useRef, useState} from 'react';
import '../App.css';
import {ConsolidatedShowing, Movie, Showing} from '../types';
import ShowingListItem from '../components/ShowingListItem';
import AttendanceListItem from '../components/AttendanceListItem';
import {MovieProvider} from '../context/MovieContext';
import ConsolidatedListItem from '../components/ConsolidatedListItem';

function Schedule() {
  const [secsSinceUpdate, setSecsSinceUpdate] = useState(0);
  const [filteredSchedule, setFilteredSchedule] = useState([] as Showing[]);
  const [filteredShowings, setUnfilteredSchedule] = useState([] as Showing[]);
  const [consolidatedSchedule, setConsolidatedSchedule] = useState({} as {[key: string]: ConsolidatedShowing});
  const [movies, setMovies] = useState({} as {[movieId: string]: Movie});

  const [mode, setMode] = useState<'showings' | 'attendance' | 'consolidated'>('showings');
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
        const {schedule, movies} = data.data as {schedule: Showing[], movies: {[movieId: string]: Movie}};
        if(!schedule) throw new Error('No showings returned.');
        let tempSchedule: Showing[] = schedule;
        if(!tempSchedule) return;
        tempSchedule = tempSchedule.filter(showing => {
          const showingTime = new Date(showing.startsAt);
          return showingTime > startTime.current && showingTime < latestTime.current;
        });
        tempSchedule = tempSchedule.sort((a, b) => a.startsAt > b.startsAt ? 1 : -1);
        setFilteredSchedule(tempSchedule);
        setUnfilteredSchedule(schedule);
        setMovies(movies as {[movieId: string]: Movie});
        setSecsSinceUpdate(Math.floor((Date.now() - data.timeFetched) / 1000));
        setStatusMessage('');
      })
      .catch(() => {throw new Error('Failed to fetch showtimes.')});
  }

  function GetRemainingAttendance(): number {
    if(!filteredSchedule) return 0;
    return(filteredSchedule.reduce(( (acc, showing) => acc + showing.guests ), 0));
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

  useEffect(() => {
    const showingMap: {[key: string]: ConsolidatedShowing} = {};

    // Consolidate showings into 10-minute intervals, rounding any non-rounded times down to the nearest 10 minutes
    filteredSchedule.forEach(showing => {
      const showingTime = new Date(showing.startsAt);
      const roundedTime = new Date(Math.floor(showingTime.getTime() / (10 * 60 * 1000)) * (10 * 60 * 1000)); // Round down to the nearest 10 minutes
      if(roundedTime < startTime.current) return; // Ignore showings way in the past
      const roundedTimeKey = roundedTime.toISOString();

      if (!showingMap[roundedTimeKey]) {
        showingMap[roundedTimeKey] = {
          showings: [],
          startsAt: roundedTime,
          totalGuests: 0
        };
      }
      showingMap[roundedTimeKey].showings.push(showing);
      showingMap[roundedTimeKey].totalGuests += showing.guests;
    });

    setConsolidatedSchedule(showingMap);


  }, [filteredSchedule])
  

  /**
   * Get the total attendance between two dates
   * @param start The start date
   * @param end The end date
   * @returns The total attendance between the two dates
   */
  function GetAttendanceBetween(start: Date, end: Date): number {
    return filteredShowings.filter(showing => {
      const showingTime = new Date(showing.startsAt);
      return showingTime >= start && showingTime <= end;
    }).reduce((acc, showing) => acc + showing.guests, 0);
  }  

  return (
    <MovieProvider value={movies}>
      <div className="App">
        <h2>Schedule</h2>
        <span className='flex-hoz'><h3>Last updated&nbsp;</h3><h3 className='bold'>{SecsToHMS(secsSinceUpdate)} ago</h3></span>
        <span className='flex-hoz'><h3>Remaining&nbsp;</h3><h3 className='bold'>{GetRemainingAttendance()} guests</h3></span>
        {statusMessage && <span className='statusMessage bold'>{statusMessage}</span>}

        <div className="viewSelectionContainer">
          <div className={`selection ${mode === 'showings' ? 'active' : ''}`} onClick={() => setMode("showings")}><span>Showings</span></div>
          <div className={`selection ${mode === 'attendance' ? 'active' : ''}`} onClick={() => setMode("attendance")}><span>Attendance</span></div>
          <div className={`selection ${mode === 'consolidated' ? 'active' : ''}`} onClick={() => setMode("consolidated")}><span>Consolidated</span></div>
        </div>


        {mode === 'showings' && (
          <div>
            {filteredSchedule.map((showing, index) => (
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
              attendance={GetAttendanceBetween(startTime.current, nextHour.current)}
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

        {mode === 'consolidated' && (
          <div>
            {Object.entries(consolidatedSchedule).map(([startTime, consolidated]) => (
              <ConsolidatedListItem
                key={startTime}
                start={new Date(consolidated.startsAt)}
                showings={consolidated}
              />
            ))}
          </div>
        )}
      </div>
    </MovieProvider>
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
