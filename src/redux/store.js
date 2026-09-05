import { configureStore } from "@reduxjs/toolkit";
import pokemons from "./pokemons";
import economy from "./economy";

export const store = configureStore({
  reducer: {
    pokemons: pokemons,
    economy,
  },
});
