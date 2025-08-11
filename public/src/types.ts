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

export type ConsolidatedShowing = {
  showings: Showing[];
  startsAt: Date;
  totalGuests: number;
}