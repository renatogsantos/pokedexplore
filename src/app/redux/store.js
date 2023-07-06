import { configureStore } from "@reduxjs/toolkit";
import pokemons from "./pokemons";

export const store = configureStore({
  reducer: {
    pokemons: pokemons
  },
});
