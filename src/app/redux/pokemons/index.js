import { createAction, createReducer } from "@reduxjs/toolkit";
import axios from "axios";

//Estado inicial
const initialState = {
  Pokemons: [],
};

//actions
export const actPokemons = createAction("POKEMONS");

//apis
export const getPokemons = (units) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/?offset=${units}limit=${units}`)
      .then(async (response) => {
        let endpoints = response.data.results.map((pokemon) => pokemon.url);

        let pokemonData = await axios.all(
          endpoints.map((url) => axios.get(url).then((resp) => resp.data))
        );

        let pokemons = pokemonData.map((data) => {
          return { ...data };
        });

        dispatch(actPokemons(pokemons));
      });
  };
};

// //reducers
export default createReducer(initialState, (builder) => {
  builder.addCase(actPokemons, (state, action) => {
    return { ...state, Pokemons: action.payload };
  });
});
