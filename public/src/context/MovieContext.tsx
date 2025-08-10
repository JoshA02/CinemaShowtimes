import React, { createContext, useContext } from "react";
import {Movie} from '../types';

const MovieContext = createContext<{[movieId: string]: Movie}>({});

export const useMovies = () => {
  const ctx = useContext(MovieContext);
  if (!ctx) throw new Error("useMovies must be used within MovieProvider");
  return ctx;
};

export const MovieProvider: React.FC<{ value: {[movieId: string]: Movie}; children: React.ReactNode }> = ({ value, children }) => (
  <MovieContext.Provider value={value}>{children}</MovieContext.Provider>
);