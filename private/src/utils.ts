import assert from 'assert';
import pLimit from 'p-limit';

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

/**
 * Fetches all movies showing at the cinema, utilising the movie API.
 * @returns An array of Movie objects, representing all movies listed for the cinema (I believe this also includes movies that are not currently showing).
 *         If an error occurred, an empty array is returned.
 */
async function fetchMovies(): Promise<Map<string, Movie>> {
  assert(process.env.MOVIES_API, 'MOVIES_API not set');

  const startTime = new Date();
  
  console.log();
  logWithTimestamp("2) Fetching movies...");

  // Fetch all the IDs of movies in the cinema's schedule
  const movieIDs: string[] = [];
  for(const movieID in schedule) {
    // if(!schedule[movieID][new Date().toISOString().split('T')[0]]) continue; // Skip this movie if there aren't any showings today
    movieIDs.push(movieID);
  }

  // Fetch movie data from the movies API
  const params = new URLSearchParams();
  movieIDs.forEach(id => params.append('ids', id));
  const movie_api_url = `${process.env.MOVIES_API}?${params.toString()}`;

  try {
    const response = await fetch(movie_api_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    // Iterate through data and create movies map (keyed by movie ID)
    const movieData = await response.json();
    const moviesMap = new Map<string, Movie>();
    movieData.forEach((movie: any) => {
      moviesMap.set(movie.id, {
        id: movie.id,
        title: movie.title,
        certificate: movie.certificate,
        runtime: movie.runtime
      });
    });
    logWithTimestamp(`Fetched ${moviesMap.size} movies in ${secsSince(startTime)} seconds.`);
    return moviesMap;
  } catch {
    return new Map();
  }
}

/**
 * Populates the schedule object with info from the cinema's schedule API
 */
async function fetchSchedule() {
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');
  assert(process.env.SCHEDULE_API, 'SCHEDULE_API not set');

  const startTime = new Date();
  console.log();
  logWithTimestamp("1) Fetching schedule...");

  const todayMidnight = new Date(new Date().setUTCHours(0, 0, 0, 0));
  const endDateMidnight = new Date(new Date(todayMidnight).setDate(todayMidnight.getDate() + 2));

  const requestBody = JSON.stringify({
    from: todayMidnight.toISOString(),
    nin: [], sin: [],
    theaters: [{id: process.env.CINEMA_ID.toUpperCase(), timeZone: "Europe/London"}],
    to: endDateMidnight.toISOString()
  });

  try {
    const response = await fetch(process.env.SCHEDULE_API,
      {
        method: 'POST',
        body: requestBody
      },
    );
    const data = await response.json();

    // Don't crash if the API doesn't return the expected data; handle gracefully.
    if(!data || !data[process.env.CINEMA_ID.toUpperCase()]?.schedule) return;

    schedule = data[process.env.CINEMA_ID.toUpperCase()].schedule;

    logWithTimestamp(`Fetched schedule for ${process.env.CINEMA_ID.toUpperCase()} (${Object.keys(schedule).length} movies) in ${secsSince(startTime)} seconds.`);

  } catch {
    logWithTimestamp(`Could not parse json from schedule API; returning...`);
    return;
  }
}

/**
 * Fetches all showings for the chosen cinema for the current day
 * @param movies An array of Movie objects to fetch showings for (from fetchMovies)
 * @returns An array of Showing objects for the chosen cinema, or an empty array if an error occurred.
 */
async function fetchShowings(movies: Map<string, Movie>): Promise<Showing[]> {
  assert(process.env.SCHEDULE_API, 'SCHEDULE_API not set');
  assert(process.env.CINEMA_ID, 'CINEMA_ID not set');

  let startTime = new Date();

  console.log();
  logWithTimestamp("3) Fetching showings...");

  const concurrency = process.env.BOOKING_CONCURRENCY_LIMIT
    ? parseInt(process.env.BOOKING_CONCURRENCY_LIMIT) || 15
    : 15;

  const limit = pLimit(concurrency);
  const tasks: Promise<Showing | null>[] = [];

  for (const movieID in schedule) {
    const movie = movies.get(movieID);
    if (!movie) {
      logWithTimestamp(`Movie of ID ${movieID} could not be found in movie list; skipping.`);
      continue;
    }

    for (const date in schedule[movieID]) {
      for (const showing of schedule[movieID][date]) {
        tasks.push(
          limit(() =>
            populateShowingDetails(showing, movie).catch((e) => {
              console.error(e);
              return null;
            })
          )
        );
      }
    }
  }

  const results = await Promise.all(tasks);
  const showings = results.filter(Boolean) as Showing[]; // Filter out null results
  logWithTimestamp(`Fetched ${showings.length} showings in ${secsSince(startTime)} seconds.`);

  startTime = new Date();
  console.log();
  logWithTimestamp("4) Sorting showings by movie title and time...");
  showings.sort((a, b) => {
    const t = a.movie.title.localeCompare(b.movie.title);
    if (t !== 0) return t;
    return a.time.getTime() - b.time.getTime();
  });
  logWithTimestamp(`Sorted showings in ${secsSince(startTime)} seconds.\n`);

  return showings;
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

  // logWithTimestamp("Starting booking...");
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

  // Get the total number of seats in the screen
  const seats = seatsLayoutModel.rows.flatMap((r: {seats: any}) => r.seats);
  const totalSeats = seats.length;
  const occupiedSeats = seats.filter((s: {status: any}) => s.status !== 0).length;

  showing = {
    movie,
    time: new Date(showingJson.startsAt),
    runtime: movie.runtime,
    screen: Number.parseInt(cartSummaryModel.screen.split(' ')[1]),
    seatsOccupied: occupiedSeats,
    seatsTotal: totalSeats
  }

  return showing;
}

export function secsSince(start: Date): number {
  return ((new Date().getTime() - start.getTime()) / 1000);
}

export function logWithTimestamp(message: string, omitNewline: boolean = false) {
  process.stdout.write(`${new Date().toLocaleTimeString()}: ${message}${omitNewline ? '' : '\n'}`);
}

/**
 * Fetches all movies showing at the cinema, and then fetches all showings for those movies.
 * @returns An array of Showings for the cinema, or undefined if an error occurred.
 */
export async function grabShowings(): Promise<Showing[] | undefined> {

  if(!process.env.CINEMA_ID || !process.env.SCHEDULE_API) {
    console.error('One or more required environment variables are not set.\n' +
    'Required variables: CINEMA_ID, SCHEDULE_API' +
    '\nNo data will be returned.');
    return [];
  }

  // clear values
  schedule = {};

  await fetchSchedule();

  try{
    return await fetchShowings(await fetchMovies());
  } catch (error) {
    console.error("An error occurred when fetching data. No data will be returned. Error: \n" + error);
    return undefined;
  }
}