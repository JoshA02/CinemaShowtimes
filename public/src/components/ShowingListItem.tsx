import React from 'react'
import {Showing} from '../types'
import '../App.css'
import './ShowingListItem.css'
import {BUSY_THRESHOLD} from '../App';

const FAR_AHEAD_THRESHOLD = 1000 * 60 * 30; // 30 minutes in milliseconds

export default function ShowingListItem({showing}: {showing: Showing}) {
  const showTime = new Date(showing.time);

  const isFarAhead = showTime.getTime() - Date.now() > FAR_AHEAD_THRESHOLD;
  const isBusy = showing.seatsOccupied >= BUSY_THRESHOLD;
  // const isBusy = Math.random() > 0.9;
  // const isFarAhead = false;

  return (
    <div className={`listItem ${isFarAhead ? 'faded' : isBusy ? 'busy' : ''}`}>
      <div className="left">
        <span className='title'>{showing.movie.title} · <span className='rating'>{showing.movie.certificate}</span></span>
        <span>{showTime.toLocaleTimeString(
          'en-GB', {hour: '2-digit', minute: '2-digit'}
        )}</span>
      </div>
      <div className="right">
        <span className={`attendance ${!isFarAhead && isBusy ? 'bold' : ''}`}>{showing.seatsOccupied}</span>
      </div>
    </div>
  )
}
