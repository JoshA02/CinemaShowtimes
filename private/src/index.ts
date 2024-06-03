import express from 'express';
import cors from 'cors';
import { grabShowings } from './utils.js';


if(!process.env.FRONTEND_URL || !process.env.EXPRESS_PORT) {
  console.error('One or more required environment variables are not set.\n' +
  'Required variables: FRONTEND_URL, EXPRESS_PORT\nExiting...');
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

app.get('/showtimes', async (_req, res) => {

  // Keep waiting until the last fetch is done
  while(isFetching) await new Promise(r => setTimeout(r, 100));
  isFetching = true;

  grabShowings().then(showings => {
    res.json(showings);
  }).catch(error => {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching showtimes.' });
  }).finally(() => {
    isFetching = false;
  });
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log('Server listening on port ' + process.env.EXPRESS_PORT);
});