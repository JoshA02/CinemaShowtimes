import express from 'express';
import cors from 'cors';


if(!process.env.FRONTEND_URL) {
  console.error('FRONTEND_URL not set');
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

app.get('/', (_req, res) => {
  res.send('Hello World!');
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log('Server listening on port 3000');
});