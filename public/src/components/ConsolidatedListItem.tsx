import {useState} from 'react';
import {BUSY_THRESHOLD, FAR_AHEAD_THRESHOLD} from '../App'
import {ConsolidatedShowing} from '../types';
import {useMovies} from '../context/MovieContext';

export default function ConsolidatedListItem({start, showings}: {start: Date, showings: ConsolidatedShowing}) {
  const isBusy = showings.totalGuests >= BUSY_THRESHOLD;
  const isFarAhead = Math.abs(start.getTime() - Date.now()) > FAR_AHEAD_THRESHOLD;
  const isCurrent = !isFarAhead && Date.now() >= start.getTime(); // Are we expecting guests to arrive about now?
  const movies = useMovies();

  const [showMovieNames, toggleMovieNames] = useState(false);

  return (
    <div className={`listItem ${!isCurrent ? 'faded' : isBusy ? 'busy' : ''}`} onClick={() => {toggleMovieNames(!showMovieNames)}}>
      <div className="left">
        <span className='title'>{start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} <span className='sml'>+/- 5 mins</span></span>
        
        {showMovieNames ? 
          <span className='text-left'>
            { 
            showings.showings.map((s, index) => (
              <span key={index} className='sml text-left'>
                {movies[s.movieId].title} {index < showings.showings.length - 1 ? '· ' : ''}
              </span>
            ))
          }
          </span>
        :

        <span className='sml'>
          {showings.showings.length > 1 ? `${showings.showings.length} showings` : '1 showing'}
          <span className='sml'> · tap to view </span>
        </span>
        
        }
      </div>
      <div className="right">
        <span className={`attendance ${isBusy ? 'bold' : ''}`}>{showings.totalGuests}</span>
      </div>
    </div>
  )
}
