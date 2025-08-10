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