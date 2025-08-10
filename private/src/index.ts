import express from 'express';
import cors from 'cors';
import { Movie, Showing, grabShowings, logWithTimestamp, secsSince } from './utils.js';
import {generateSessionId, validSession} from './sessions.js';
import assert from 'assert';


const MAX_FETCH_AGE = (60000 * 1); // 1 minute; any data older than this will be re-fetched.
// const MAX_FETCH_AGE = (5000); // 5 seconds in milliseconds

if(!process.env.FRONTEND_URL || !process.env.EXPRESS_PORT || !process.env.FRONTEND_PASSWORD) {
  console.error('One or more required environment variables are not set.\n' +
  'Required variables: FRONTEND_URL, EXPRESS_PORT, FRONTEND_PASSWORD\nExiting...');
  process.exit(1);
}

const app = express();
app.use(cors());

// Configure headers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


let isFetching = false; // Prevents multiple fetches at once.
let lastFetch: {schedule: Showing[], movies: {[movieId: string]: Movie}} = {schedule: [], movies: {} }; // Cache the last fetch to prevent multiple fetches in a short time.
let lastFetchTime = 0; // Time of the last fetch in milliseconds.

app.get('/showtimes', async (req, res) => {

  // Validate the session
  if(!validSession(req.query.sessionId as string)) {
    await new Promise(r => setTimeout(r, 1000)); // Slow the response down to make it harder to spam the endpoint
    res.status(401).send({message: 'Invalid session'});
    return;
  }

  // Keep waiting until the last fetch is done
  while(isFetching) await new Promise(r => setTimeout(r, 100));

  // If the cached fetch is younger than the max fetch age, return it.
  if(lastFetchTime + MAX_FETCH_AGE > Date.now()) {
    // console.log();
    // logWithTimestamp('Returning cached data.');
    return res.json({data: lastFetch, timeFetched: lastFetchTime});
  }

  // If the cached fetch is older than the max fetch age, fetch new data.
  isFetching = true;
  console.log();
  logWithTimestamp('Fetching new data.');
  const startFetchTime = new Date();

  grabShowings().then(schedule => {

    if(schedule == undefined) {
      logWithTimestamp('Trying again soon.');
      return res.status(500).json({ error: 'An error occurred while fetching showtimes.' });
    }

    lastFetch = schedule;
    lastFetchTime = Date.now();
    logWithTimestamp(`Updated showtimes cache in ${secsSince(startFetchTime)} seconds`);
    logWithTimestamp('Returning new data.');
    return res.json({data: schedule, timeFetched: lastFetchTime});
  }).finally(() => {
    isFetching = false;
  });
});

app.get('/authenticate', async (req, res) => {
  assert(process.env.FRONTEND_PASSWORD, 'FRONTEND_PASSWORD is not set in the environment variables.');

  const token = req.query.token as string;
  if(token != process.env.FRONTEND_PASSWORD) {
    await new Promise(r => setTimeout(r, 1000)); // Slow the response down to make it harder to guess the token
    return res.status(401).send({message: 'Invalid token'});
  }

  const sessionId = generateSessionId();
  res.send({sessionId}); // Send the generated session id back to the client; they'll use this to make requests.
});

app.listen(process.env.EXPRESS_PORT, () => {
  logWithTimestamp('Server listening on port ' + process.env.EXPRESS_PORT);
});