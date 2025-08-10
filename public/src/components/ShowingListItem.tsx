import {Showing} from '../types'
import '../App.css'
import './ShowingListItem.css'
import {BUSY_THRESHOLD, FAR_AHEAD_THRESHOLD} from '../App';
import {useMovies} from '../context/MovieContext';

export default function ShowingListItem({showing}: {showing: Showing}) {
  const showTime = new Date(showing.startsAt);
  const movies = useMovies();
  const movie = movies[showing.movieId];

  const isFarAhead = showTime.getTime() - Date.now() > FAR_AHEAD_THRESHOLD;
  const isBusy = showing.guests >= BUSY_THRESHOLD;
  // const isBusy = Math.random() > 0.9;
  // const isFarAhead = false;

  return (
    <div className={`listItem ${isFarAhead ? 'faded' : isBusy ? 'busy' : ''}`}>
      <div className="left">
        <span className='title'>{movie.title} · <span className='rating'>{movie.certificate}</span></span>
        <span>
          {showTime.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}  ·  Screen {showing.screenNumber}
        </span>
      </div>
      <div className="right">
        <span className={`attendance ${isBusy ? 'bold' : ''}`}>{showing.guests}</span>
      </div>
    </div>
  )
}
