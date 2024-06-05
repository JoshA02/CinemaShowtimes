import React from 'react'
import {Showing} from '../types'
import '../App.css'
import './ShowingListItem.css'

export default function ShowingListItem({showing}: {showing: Showing}) {
  return (
    <div className='showing'>
      <h4>{showing.movie.title}</h4>
      <p>{new Date(showing.time).toLocaleTimeString()}</p>
      <p>Screen {showing.screen}</p>
      <p>{showing.seatsOccupied} / {showing.seatsTotal} seats occupied</p>
    </div>
  )
}
