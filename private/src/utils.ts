import assert from 'assert';
import pLimit from 'p-limit';
import {Agent} from 'undici';

export type Movie = {
  title: string;
  certificate: string;
  runtime: number;
};

export type Showing = {
  movieId: string;
  startsAt: Date;
  screenNumber: number;
  guests: number;
};

interface ShowingPrivate extends Showing {
  id: string;
  bookingUrl: string;
  occupancyRate: number; // Percentage of seats occupied
};

let schedule: ShowingPrivate[] = [];
let movies: Map<string, Movie> = new Map();
let screenCapacityCache: Map<number, number> = new Map(); // Screen number -> capacity
let showingScreenCache: Map<string, number> = new Map(); // Showing ID -> screen number
let lastScheduleStart: Date | null = null; // The 'from' time of the last schedule fetch

const keepAliveAgent = new Agent({
  keepAliveTimeout: 12000,
  connections: process.env.BOOKING_CONCURRENCY_LIMIT ? parseInt(process.env.BOOKING_CONCURRENCY_LIMIT) || 15 : 15,
});


/**
 * Fetches all movies showing at the cinema, and then fetches all showings for those movies.
 * @returns An array of Showings for the cinema, or undefined if an error occurred.
 */
export async function grabShowings(): Promise<{
  schedule: Showing[],
  movies: {[movieId: string]: Movie}
} | undefined> {

  if(!process.env.CINEMA_ID || !process.env.SCHEDULE_API || !process.env.MOVIES_API) {
    console.error('One or more required environment variables are not set.\n' +
    'Required variables: CINEMA_ID, SCHEDULE_API, MOVIES_API' +
    '\nNo data will be returned.');
    return {schedule: [], movies: {}};
  }

  // clear values
  schedule = [];
  movies.clear();

  await populateSchedule();
  await populateMovies();

  await populateScheduleDetails();
  
  if(schedule.length === 0) {
    console.warn("No showings found in the schedule. Returning no data.");
    return {schedule: [], movies: {}};
  }

  console.log();
  logWithTimestamp('4) Formatting showings...');

  return {
    schedule: schedule.map((showing) => ({
                movieId: showing.movieId,
                startsAt: new Date(showing.startsAt),
                screenNumber: showing.screenNumber,
                guests: showing.guests
    })),
    movies: Object.fromEntries(movies.entries())
  };

}

/**
 * Populates the schedule object with info from the cinema's schedule API
 */
async function populateSchedule() {
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
    const response = await fetch(process.env.SCHEDULE_API, {method: 'POST', body: requestBody});
    const data = await response.json();

    // Don't crash if the API doesn't return the expected data; handle gracefully.
    if(!data || !data[process.env.CINEMA_ID.toUpperCase()]?.schedule) return;

    // Clear caches if this is the first time fetching today's schedule
    if(lastScheduleStart && Math.abs(lastScheduleStart.getTime() - todayMidnight.getTime()) > 1000) {
      logWithTimestamp("Fetching today's schedule for the first time; this may take a while...");
      logWithTimestamp("Invalidating caches for screen capacities and showing screens.");
      screenCapacityCache.clear(); // Clear the screen capacity cache
      showingScreenCache.clear(); // Clear the showing screen cache      
    }
    lastScheduleStart = todayMidnight; // Update the last schedule start time

    const scheduleJson = data[process.env.CINEMA_ID.toUpperCase()].schedule;
    const showings: ShowingPrivate[] = [];

    for (const movieId in scheduleJson) {
      const movieDates = scheduleJson[movieId];
      for (const date in movieDates) {
        for (const showing of movieDates[date]) {
          const frontendBookingURL = showing.data.ticketing[0]?.urls[0];
          if(!frontendBookingURL) {
            logWithTimestamp(`No booking URL found for showing ${showing.id} of movie ${movieId} @ ${showing.startsAt}. Skipping...`);
            continue; // Skip this showing if no booking URL is found
          }

          if(!showing.occupancy || typeof showing.occupancy.rate !== 'number') { // Allow occupancy rate to be 0
            logWithTimestamp(`No occupancy rate found for showing ${showing.id} of movie ${movieId} @ ${showing.startsAt}. Skipping...`);
            continue;
          }
          
          showings.push({
            id: showing.id,
            startsAt: showing.startsAt,
            bookingUrl: frontendBookingURL.replace('/startticketing', '/api/StartTicketing'),
            occupancyRate: showing.occupancy.rate,
            movieId: movieId,
            screenNumber: 0, // Populated later
            guests: 0 // Populated later
          });
        }
      }
    }

    // Sort by start time descending
    schedule = showings.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

    logWithTimestamp(`Fetched schedule for ${process.env.CINEMA_ID.toUpperCase()} (${Object.keys(schedule).length} movies) in ${secsSince(startTime)} seconds.`);
  } catch {
    logWithTimestamp(`Could not parse json from schedule API; returning...`);
    return;
  }
}

async function populateMovies() {
  assert(process.env.MOVIES_API, 'MOVIES_API not set');

  const startTime = new Date();
  console.log();
  logWithTimestamp("2) Fetching movies...");

  // Fetch movie data from the movies API
  const params = new URLSearchParams();
  schedule.forEach(showing => params.append('ids', showing.movieId));
  const movie_api_url = `${process.env.MOVIES_API}?${params.toString()}`;

  try {
    const response = await fetchWithRetry(movie_api_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    // Iterate through data and create movies map (keyed by movie ID)
    const movieData = await response.json();
    movieData.forEach((movie: any) => {
      if(!movie.id || !movie.title) {
        console.warn(`Skipping movie with missing essential data: ${JSON.stringify(movie)}`);
        return;
      }
      movies.set(movie.id, {
        title: movie.title,
        certificate: movie.certificate || '',
        runtime: movie.runtime ? parseInt(movie.runtime) : 0 // Ensure runtime is a number, default to 0 if not available
      });
    });
    logWithTimestamp(`Fetched ${movies.size} movies in ${secsSince(startTime)} seconds.`);
  } catch {
    logWithTimestamp(`Could not fetch movies from API; returning...`);
  }
  
}

/**
 * Populates screen number and guests from the cache, or fetches them from the API if not cached.
 */
async function populateScheduleDetails() {
  assert(process.env.BOOKING_CONCURRENCY_LIMIT, 'BOOKING_CONCURRENCY_LIMIT not set');

  const startTime = new Date();
  console.log();
  logWithTimestamp("3) Populating schedule details...");
  let needsUpdating = 0;
  const failedShowings: string[] = []; // Keep track of showings that failed to update

  const concurrency = process.env.BOOKING_CONCURRENCY_LIMIT
  ? parseInt(process.env.BOOKING_CONCURRENCY_LIMIT) || 15
  : 15;

  const limit = pLimit(concurrency);
  const tasks: Promise<void>[] = [];

  for(const showing of schedule) {
    
    // Check if both the screen and capacity are cached
    const screenNum = showingScreenCache.get(showing.id);
    const screenCapacity = screenCapacityCache.get(screenNum!);
    if(screenNum !== undefined && screenCapacity !== undefined) {
      showing.screenNumber = screenNum;
      showing.guests = Math.round((screenCapacity * showing.occupancyRate) / 100);
      continue;
    }

    // Either screen number or capacity is not cached, so fetch them (both via the booking API)

    if(needsUpdating == 0) logWithTimestamp('At least one showing needs updating, this may take a while...');
    needsUpdating ++;

    tasks.push(
      limit(() =>
        updateScreenCaches(showing).catch((e) => {
          console.error(`Error updating screen data for showing ${showing.id} (${showing.startsAt}) - it will be ignored:`, e);
          failedShowings.push(showing.id);
        })
      )
    );
  }

  // Wait for all tasks to complete
  await Promise.all(tasks);

  logWithTimestamp(`Populated details of ${schedule.length-failedShowings.length}/${schedule.length} showings in ${secsSince(startTime)} seconds (${needsUpdating} updated from API) (${schedule.length-needsUpdating} from cache) (${failedShowings.length} failed).`);

  // Filter out showings that failed to update; could consider re-retrying them first but that shouldn't change the outcome (showings are processed in reverse chronological order)
  schedule = schedule.filter(s => !failedShowings.includes(s.id));

}

/**
 * Updates the caches for showing screens and screen capacities from the booking API.
 * Also updates the provided showing object with the screen number and guests (calculated from the screen capacity).
 * @param showing The showing object to make a booking API request for, and to update with screen number and guests.
 */
async function updateScreenCaches(showing: ShowingPrivate): Promise<void> {
  const bookingResponse = await fetchWithRetry(showing.bookingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({"selectedLanguageCulture": null})
  });

  ////                                                   Screen Number Update                                                         ////
  ////  Attempts to update the screen number from the booking API, falling back to existing cache. Throws an error if neither exist   ////

  const bookingData = await bookingResponse.json();
  if(!bookingData) throw Error("No booking data returned from booking API");
  

  let screenNumber = showingScreenCache.get(showing.id);

  // Extract the screen number from the cart summary model
  const cartSummaryModel = bookingData?.cartSummaryModel || null;
  if(cartSummaryModel) {
    const screenMatch = cartSummaryModel.screen.match(/Screen (\d+)/);

    if(screenMatch && screenMatch.length >= 2) {
      screenNumber = parseInt(screenMatch[1]);
      if(isNaN(screenNumber)) throw Error("Screen number is not a valid number");

      showing.screenNumber = screenNumber;
      showingScreenCache.set(showing.id, screenNumber); // Cache the screen number for future use
    } else {
      // If no screen number is found in the cart summary model, check if the screen number is already cached before throwing an error
      if(screenNumber === undefined) {
        throw Error(`No screen number found in cart summary model for showing ${showing.id}.`);
      }
    }
  } else {
    // If no cart summary model is found, check if the screen number is already cached before throwing an error
    if(screenNumber === undefined) {
      throw Error(`No screen number found in booking data for showing ${showing.id}.`);
    }
  }


  ////                                  Screen Capacity & Guest Calculation                                   ////
  //// Attempts to update the cache and showing from the API, falling back to existing cache if not available ////

  // Fetch the total number of seats in the screen from the booking data
  const seatsLayoutModel = bookingData.selectSeatsModel?.seatsLayoutModel;

  // Update the screen capacity cache; it may already be cached but might as well update it
  if(seatsLayoutModel) {
    // Get the total number of seats in the screen
    const totalSeats = seatsLayoutModel.rows.reduce((acc: number, row: {seats: any[]}) => {
      return acc + row.seats.reduce((rowAcc: number, seat: {isASeat: boolean}) => {
        return rowAcc + (seat.isASeat ? 1 : 0);
      }, 0);
    }, 0);

    if(totalSeats > 0) {
      screenCapacityCache.set(screenNumber, totalSeats); // Cache the screen capacity for future use
      logWithTimestamp(`Screen ${screenNumber} has a total of ${totalSeats} seats.`);
      showing.guests = Math.ceil((totalSeats * showing.occupancyRate) / 100); // Calculate guests based on occupancy rate, rounding up
    }
    return;
  }

  // When seats layout model is empty (happens with past showings), see if the screen's capacity is already cached before throwing an error
  if(screenCapacityCache.has(screenNumber)) {
    const cachedCapacity = screenCapacityCache.get(screenNumber);
    if(cachedCapacity) {
      showing.guests = Math.round((cachedCapacity * showing.occupancyRate) / 100); // Calculate guests based on occupancy rate
    } else { // If the cached capacity is 0, there's something wrong with the cache
      screenCapacityCache.delete(screenNumber); // Remove the invalid cache entry
      throw Error(`Invalid cached capacity found for screen ${screenNumber}; set to 0. Removing cache entry.`);
    }
  } else {
    throw Error(`No seats layout model or cached capacity found for screen ${screenNumber} in showing ${showing.id}.`);
  }
}

/**
 * Fetches a URL with retry logic, using the keep-alive agent.
 * @param url The URL to fetch
 * @param options The options to pass to the fetch function
 * @param retries The number of times to retry the fetch if it fails (default: 3)
 * @returns A Promise that resolves to the Response object from the fetch call
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, { ...(options as any), dispatcher: keepAliveAgent });
    } catch (e) {
      if (attempt === retries) throw e;
      console.warn(`Attempt ${attempt} failed for ${url}. Retrying...`);
      await new Promise(res => setTimeout(res, 200 * attempt));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Calculates the number of seconds since a given start date.
 * @param start The start date to calculate the seconds since
 * @returns The number of seconds since the start date (decimal)
 */
export function secsSince(start: Date): number {
  return ((new Date().getTime() - start.getTime()) / 1000);
}

export function logWithTimestamp(message: string, omitNewline: boolean = false) {
  process.stdout.write(`${new Date().toLocaleTimeString()}: ${message}${omitNewline ? '' : '\n'}`);
}