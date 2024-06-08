import React from 'react'
import {BUSY_THRESHOLD} from '../App'

export default function AttendanceListItem({start, end, attendance}: {start: Date, end: Date, attendance: number}) {
  const isBusy = attendance >= BUSY_THRESHOLD;
  return (
    <div className={`listItem vert-center ${start.getHours() !== new Date().getHours() ? 'faded' : isBusy ? 'busy' : ''}`}>
      <span>{start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} - {end.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</span>
      <span className={`attendance ${isBusy ? 'bold' : ''}`}>{attendance}</span>
    </div>
  )
}
