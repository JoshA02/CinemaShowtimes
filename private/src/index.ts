import assert from 'assert';

export type Movie = {
  id: string;
  title: string;
  certificate: string;
};

export type Showing = {
  movie: Movie;
  time: Date;
  runtime: number;
  screen: number;
  seatsOccupied: number;
  seatsTotal: number;
};

let websiteID: string;
let circuitID: string;


/**
 * Fetches all movies showing at the cinema, utilising the query API and the movie API.
 * @returns An array of Movie objects, representing all movies listed for the cinema (I believe this also includes movies that are not currently showing).
 *         If an error occurred, an empty array is returned.
 */
async function fetchMovies(): Promise<Movie[]> {
  assert(process.env.QUERY_API_URL_PREFIX, 'QUERY_API_URL_PREFIX not set');
  assert(process.env.QUERY_API_URL_SUFFIX, 'QUERY_API_URL_SUFFIX not set');
  assert(process.env.MOVIE_API_URL_PREFIX, 'MOVIE_API_URL_PREFIX not set');
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');
  
  const response = await fetch(process.env.QUERY_API_URL_PREFIX + process.env.CINEMA_ID.toLowerCase() + process.env.QUERY_API_URL_SUFFIX);
  const data = await response.json();
  
  // Don't crash if the API doesn't return the expected data; handle gracefully.
  if(!data?.result) return [];
  if(!data.result?.pageContext?.websiteId) return [];
  if(!data.result?.pageContext?.circuitId) return [];
  if(!data?.staticQueryHashes[28]) return [];

  websiteID = data.result.pageContext.websiteId;
  circuitID = data.result.pageContext.circuitId;
  const queryHash = data.staticQueryHashes[28];

  const movieResponse = await fetch(process.env.MOVIE_API_URL_PREFIX + `${queryHash}.json`);
  let movieData = await movieResponse.json().then((data) => data?.data?.allMovie?.nodes || []);

  // Exclude movies not showing at the chosen cinema.
  movieData = movieData.filter((movie: any) => {
    return movie.theaters.filter((theater: any) => theater.th === process.env.CINEMA_ID?.toUpperCase()).length > 0;
  });

  // Cast the data to the expected format.
  return movieData.map((movie: any) => {
    return { id: movie.id, title: movie.title, certificate: movie.certificate };
  });
}


/**
 * Fetches all showings for the chosen cinema for the current day, utilising the schedule API and (via populateShowingDetails) the booking API.
 * @param movies An array of Movie objects to fetch showings for (from fetchMovies)
 * @returns An array of Showing objects for the chosen cinema, or an empty array if an error occurred.
 */
async function fetchShowings(movies: Movie[]): Promise<Showing[]> {
  assert(process.env.SCHEDULE_API, 'SCHEDULE_API not set');
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');
  assert(circuitID, 'Circuit ID not set. Did you forget to call fetchMovies()?');
  assert(websiteID, 'Website ID not set. Did you forget to call fetchMovies()?');

  const showings: Showing[] = [];

  const response = await fetch(process.env.SCHEDULE_API,
    {
      method: 'POST',
      body: JSON.stringify({
        circuit: circuitID,
        from: new Date(new Date().setHours(0, 0, 0)).toISOString(),
        movieIds: movies.map(movie => movie.id),
        nin: [], sin: [],
        theaters: [{id: process.env.CINEMA_ID.toUpperCase(), timeZone: "Europe/London"}],
        to: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
        websiteId: websiteID
      })
    },
  );
  const data = await response.json();

  // Don't crash if the API doesn't return the expected data; handle gracefully.
  if(!data) return [];
  if(!data[process.env.CINEMA_ID.toUpperCase()]?.schedule) return [];

  const schedule = data[process.env.CINEMA_ID.toUpperCase()].schedule;
  
  // Currently, this works movie by movie. This could be improved by fetching all showings for all movies in parallel.
  for(const movieID in schedule) {
    const movie = movies.find(movie => movie.id === movieID) || null;
    if(!movie) continue; // Only include movies that are in the list of movies.
    if(!schedule[movieID][new Date().toISOString().split('T')[0]]) continue; // Only include showings for today.
    const todaysShowings = schedule[movieID][new Date().toISOString().split('T')[0]];

    const detailPromises = todaysShowings.map( (showing: string) => populateShowingDetails(showing, movie));
    const updatedShowings: Showing[] = await Promise.all(detailPromises);
    showings.push(...updatedShowings.filter(showing => showing.movie.id === movieID));
    // console.log("Populated all showings for movie: " + movies.find(movie => movie.id === movieID)?.title);
  }

  return [];
}


/**
 * Populates a Showing object with additional details (seating, etc) by making a temporary booking for the showing via the booking API. Used by fetchShowings.
 * @param showingJson The basic showing data from the API response
 * @param movie The movie object for the showing
 * @returns A populated Showing object, or a default object if an error occurred; the calling function (fetchShowings) will handle this gracefully.
 */
async function populateShowingDetails(showingJson: any, movie: Movie): Promise<Showing> {
  let showing: Showing = {
    movie: { id: '', title: '', certificate: '' },
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
    runtime: 0,
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
  try{
    return await fetchShowings(await fetchMovies());
  } catch (error) {
    console.error("An error occurred when fetching data. No data will be returned. Error: \n" + error);
    return [];
  }
}