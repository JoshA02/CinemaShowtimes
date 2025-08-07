import assert from 'assert';

export type Movie = {
  id: string;
  title: string;
  certificate: string;
  runtime: number;
};

export type Showing = {
  movie: Movie;
  time: Date;
  runtime: number;
  screen: number;
  seatsOccupied: number;
  seatsTotal: number;
};

let schedule: any = {};
let showings: Showing[] = [];


/**
 * Fetches all movies showing at the cinema, utilising the query API and the movie API.
 * @returns An array of Movie objects, representing all movies listed for the cinema (I believe this also includes movies that are not currently showing).
 *         If an error occurred, an empty array is returned.
 */
async function fetchMovies(): Promise<Movie[]> {
  assert(process.env.MOVIES_API, 'MOVIES_API not set');

  // Fetch all the IDs of movies in the cinema's schedule
  const movieIDs: string[] = [];
  for(const movieID in schedule) {
    if(!schedule[movieID][new Date().toISOString().split('T')[0]]) continue; // Skip this movie if there aren't any showings today
    movieIDs.push(movieID);
  }

  // Fetch movie data from the movies API
  let movie_api_url = `${process.env.MOVIES_API}?`;
  movieIDs.forEach((id, index) => {
    if(index > 0) movie_api_url += '&';
    movie_api_url += `ids=${id}`;
  });
  const response = await fetch(movie_api_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  // Iterate through data and push to movies list
  const movieData = await response.json();
  return movieData.map((movie: any) => {
    return { id: movie.id, title: movie.title, certificate: movie.certificate, runtime: movie.runtime };
  });
}

async function fetchSchedule(): Promise<void> {
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');
  assert(process.env.SCHEDULE_API, 'SCHEDULE_API not set');

  const response = await fetch(process.env.SCHEDULE_API,
    {
      method: 'POST',
      body: JSON.stringify({
        from: new Date(new Date().setHours(0, 0, 0)).toISOString(),
        nin: [], sin: [],
        theaters: [{id: process.env.CINEMA_ID.toUpperCase(), timeZone: "Europe/London"}],
        to: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString()
      })
    },
  );
  const data = await response.json();

  // Don't crash if the API doesn't return the expected data; handle gracefully.
  if(!data || !data[process.env.CINEMA_ID.toUpperCase()]?.schedule) return;

  schedule = data[process.env.CINEMA_ID.toUpperCase()].schedule;
}

/**
 * Fetches all showings for the chosen cinema for the current day, utilising the schedule API and (via populateShowingDetails) the booking API.
 * @param movies An array of Movie objects to fetch showings for (from fetchMovies)
 * @returns An array of Showing objects for the chosen cinema, or an empty array if an error occurred.
 */
async function fetchShowings(movies: Movie[]): Promise<Showing[]> {
  assert(process.env.SCHEDULE_API, 'SCHEDULE_API not set');
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');

  await Promise.all(movies.map((movie: Movie) => processMovie(movie)));

  showings.sort((a, b) => {
    if(a.movie.title > b.movie.title) return 1;
    if(a.movie.title < b.movie.title) return -1;
    return 0;
  });
  showings.sort((a, b) => {
    if(a.time > b.time) return 1;
    if(a.time < b.time) return -1;
    return 0;
  });

  return showings;
}

async function processMovie(movie: Movie) {
  const todaysShowings = schedule[movie.id][new Date().toISOString().split('T')[0]];

  const detailPromises = todaysShowings.map( (showing: string) => populateShowingDetails(showing, movie));
  const updatedShowings: Showing[] = await Promise.all(detailPromises);
  showings.push(...updatedShowings.filter(showing => showing.movie.id === movie.id));
}


/**
 * Populates a Showing object with additional details (seating, etc) by making a temporary booking for the showing via the booking API. Used by fetchShowings.
 * @param showingJson The basic showing data from the API response
 * @param movie The movie object for the showing
 * @returns A populated Showing object, or a default object if an error occurred; the calling function (fetchShowings) will handle this gracefully.
 */
async function populateShowingDetails(showingJson: any, movie: Movie): Promise<Showing> {
  let showing: Showing = {
    movie: { id: '', title: '', certificate: '', runtime: 0 },
    time: new Date(),
    runtime: 0,
    screen: 0,
    seatsOccupied: 0,
    seatsTotal: 0
  };

  const frontendBookingURL = showingJson?.data?.ticketing[0]?.urls[0] || null;
  if(!frontendBookingURL) return showing;

  const backendBookingURL = frontendBookingURL.replace('/startticketing', '/api/StartTicketing');
  const bookingResponse = await fetch(backendBookingURL, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({"selectedLanguageCulture": null})
  });

  const bookingData = await bookingResponse.json();
  if(!bookingData) return showing;

  const cartSummaryModel = bookingData?.cartSummaryModel || null;
  const seatsLayoutModel = bookingData.selectSeatsModel?.seatsLayoutModel || null;
  if(!cartSummaryModel) return showing;
  if(!seatsLayoutModel) return showing;


  // Convert time as HH:DD to a Date object. Assume date is today as we only fetch today's showings.
  const timeParts = cartSummaryModel.startTime.split(':');
  const showingTime = new Date();
  showingTime.setHours(+timeParts[0], +timeParts[1], 0);


  // Get the total number of seats in the screen
  const rows = seatsLayoutModel.rows;
  let totalSeats = 0;
  let occupiedSeats = 0;
  for(const row of rows) {
    for(const seat of row.seats) {
      if(!seat?.id) continue;
      totalSeats++;
      if(seat?.status !== 0) occupiedSeats++;
    }
  }

  showing = {
    movie,
    time: showingTime,
    runtime: movie.runtime,
    screen: Number.parseInt(cartSummaryModel.screen.split(' ')[1]),
    seatsOccupied: occupiedSeats,
    seatsTotal: totalSeats
  }

  return showing;
}



/**
 * Fetches all movies showing at the cinema, and then fetches all showings for those movies.
 * @returns An array of Showings for the cinema, or an empty array if an error occurred.
 */
export async function grabShowings(): Promise<Showing[]> {

  if(!process.env.CINEMA_ID || !process.env.SCHEDULE_API) {
    console.error('One or more required environment variables are not set.\n' +
    'Required variables: CINEMA_ID, SCHEDULE_API' +
    '\nNo data will be returned.');
    return [];
  }

  // clear values
  schedule = {};
  showings = [];

  await fetchSchedule();

  try{
    return await fetchShowings(await fetchMovies());
  } catch (error) {
    console.error("An error occurred when fetching data. No data will be returned. Error: \n" + error);
    return [];
  }
}