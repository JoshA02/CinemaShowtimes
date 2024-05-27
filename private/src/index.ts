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


// Returns all movies showing at the chosen cinema; showing times are not included.
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
    return movie.theaters.filter((theater: any) => theater.th === process.env.CINEMA_ID).length > 0;
  });

  // Cast the data to the expected format.
  return movieData.map((movie: any) => {
    return { id: movie.id, title: movie.title, certificate: movie.certificate };
  });
}

console.log(await fetchMovies());