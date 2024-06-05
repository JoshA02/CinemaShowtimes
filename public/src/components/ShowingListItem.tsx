import React from 'react'
import {Showing} from '../types'
import '../App.css'
import './ShowingListItem.css'

export default function ShowingListItem({showing}: {showing: Showing}) {
  const showTime = new Date(showing.time);
  return (
    <div className='showing'>
      <div className="left">
        <span className='title'>{showing.movie.title} · <span className='rating'>{showing.movie.certificate}</span></span>
        <span>{showTime.toLocaleTimeString(
          'en-GB', {hour: '2-digit', minute: '2-digit'}
        )}</span>
      </div>
      <div className="right">
        <span className='attendance'>{showing.seatsOccupied}</span>
      </div>
      
      {/* <h4>{showing.movie.title}</h4>
      <p>{new Date(showing.time).toLocaleTimeString()}</p>
      <p>Screen {showing.screen}</p>
      <p>{showing.seatsOccupied} / {showing.seatsTotal} seats occupied</p> */}
    </div>
  )
}
