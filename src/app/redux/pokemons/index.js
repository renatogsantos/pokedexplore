import { createAction, createReducer } from "@reduxjs/toolkit";
import axios from "axios";

//Estado inicial
const initialState = {
  Pokemons: [],
  Pokemon: null,
  NextPage: "",
  PreviousPage: "",
  OpenCardPokemon: false,
};

//actions
export const actPokemons = createAction("POKEMONS");
export const actPokemon = createAction("POKEMON");
export const actNextPage = createAction("NEXT_PAGE");
export const actPreviousPage = createAction("PREVIOUS_PAGE");

export const actOpenCardPokemon = createAction("OPEN_CARD_POKEMON");

//apis
export const getPokemon = (pokemon) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
      .then((resp) => {
        dispatch(actPokemon(resp.data));
        dispatch(actOpenCardPokemon(true));
      })
      .catch((error) => error)
      .finally(() => {});
  };
};

export const getTypesPokemons = (type) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/type/${type}/`)
      .then(async (response) => {
        let endpoints = response.data.pokemon.map(
          (pokemon) => pokemon.pokemon.url
        );
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

export const getPokemons = (units) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/?offset=0&limit=${units}`)
      .then(async (response) => {
        let endpoints = response.data.results.map((pokemon) => pokemon.url);
        let pokemonData = await axios.all(
          endpoints.map((url) => axios.get(url).then((resp) => resp.data))
        );
        let pokemons = pokemonData.map((data) => {
          return { ...data };
        });

        dispatch(actPokemons(pokemons));
        dispatch(actNextPage(response.data.next));
        dispatch(actPreviousPage(response.data.previous));
      });
  };
};

export const nextPage = (url) => {
  return async (dispatch) => {
    axios.get(url).then(async (response) => {
      let endpoints = response.data.results.map((pokemon) => pokemon.url);
      let pokemonData = await axios.all(
        endpoints.map((url) => axios.get(url).then((resp) => resp.data))
      );
      let pokemons = pokemonData.map((data) => {
        return { ...data };
      });

      dispatch(actPokemons(pokemons));
      dispatch(actNextPage(response.data.next));
      dispatch(actPreviousPage(response.data.previous));
    });
  };
};

export const previousPage = (url) => {
  return async (dispatch) => {
    axios.get(url).then(async (response) => {
      let endpoints = response.data.results.map((pokemon) => pokemon.url);
      let pokemonData = await axios.all(
        endpoints.map((url) => axios.get(url).then((resp) => resp.data))
      );
      let pokemons = pokemonData.map((data) => {
        return { ...data };
      });

      dispatch(actPokemons(pokemons));
      dispatch(actNextPage(response.data.next));
      dispatch(actPreviousPage(response.data.previous));
    });
  };
};

//reducers
export default createReducer(initialState, (builder) => {
  builder
    .addCase(actPokemons, (state, action) => {
      return { ...state, Pokemons: action.payload };
    })
    .addCase(actPokemon, (state, action) => {
      return { ...state, Pokemon: action.payload };
    })
    .addCase(actNextPage, (state, action) => {
      return { ...state, NextPage: action.payload };
    })
    .addCase(actPreviousPage, (state, action) => {
      return { ...state, PreviousPage: action.payload };
    })
    .addCase(actOpenCardPokemon, (state, action) => {
      return { ...state, OpenCardPokemon: action.payload };
    });
});
