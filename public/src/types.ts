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
  unreliable?: boolean; // Indicates if the showing data is unreliable
};