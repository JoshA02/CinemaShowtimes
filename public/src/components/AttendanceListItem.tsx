import {BUSY_THRESHOLD, FAR_AHEAD_THRESHOLD} from '../App'

export default function AttendanceListItem({start, end, attendance}: {start: Date, end: Date, attendance: number}) {
  const isBusy = attendance >= BUSY_THRESHOLD;
  const isFarAhead = Math.abs(start.getTime() - Date.now()) > FAR_AHEAD_THRESHOLD;
  const isCurrent = Date.now() >= start.getTime() && Date.now() < end.getTime();

  return (
    <div className={`listItem vert-center ${isFarAhead && !isCurrent ? 'faded' : isBusy ? 'busy' : ''}`}>
      <span>{start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} - {end.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</span>
      <span className={`attendance ${isBusy ? 'bold' : ''}`}>{attendance}</span>
    </div>
  )
}
