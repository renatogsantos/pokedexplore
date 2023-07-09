import { createAction, createReducer } from "@reduxjs/toolkit";
import axios from "axios";
import { Loading } from "notiflix";

//Estado inicial
const initialState = {
  Pokemons: [],
  Pokemon: null,
  Weaknesses: [],
  NextPage: "",
  PreviousPage: "",
  OpenCardPokemon: false,
};

//actions
export const actPokemons = createAction("POKEMONS");
export const actPokemon = createAction("POKEMON");
export const actNextPage = createAction("NEXT_PAGE");
export const actPreviousPage = createAction("PREVIOUS_PAGE");
export const actWeaknesses = createAction("WEAKNESSES");

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
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
      });
  };
};

export const getTypesPokemons = (type) => {
  return async (dispatch) => {
    Loading.pulse({
      svgSize: "120px",
      svgColor: "#fff",
    });
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
      })
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
      });
  };
};

export const getPokemonWeaknesses = (pokemonName) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`)
      .then((pokemonResponse) => {
        const pokemonData = pokemonResponse.data;
        const types = pokemonData.types.map((type) => type.type.name);
        const weaknesses = [];

        const typeRequests = types.map((type) =>
          axios.get(`https://pokeapi.co/api/v2/type/${type}`)
        );

        return axios.all(typeRequests).then(
          axios.spread((...responses) => {
            responses.forEach((response) => {
              const typeData = response.data;
              const typeWeaknesses =
                typeData.damage_relations.double_damage_from.map(
                  (weakness) => weakness.name
                );
              weaknesses.push(...typeWeaknesses);
            });
            const uniqueWeaknesses = [...new Set(weaknesses)];
            dispatch(actWeaknesses(uniqueWeaknesses));
          })
        );
      })
      .catch((error) => {
        console.error(error);
        throw error;
      })
      .finally(() => {
        // Código a ser executado sempre, independentemente do resultado da Promise
      });
  };
};

export const getPokemons = (units) => {
  return async (dispatch) => {
    Loading.pulse({
      svgSize: "120px",
      svgColor: "#fff",
    });
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
      })
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
      });
  };
};

export const nextPage = (url) => {
  return async (dispatch) => {
    Loading.pulse({
      svgSize: "120px",
      svgColor: "#fff",
    });
    axios
      .get(url)
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
      })
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
      });
  };
};

export const previousPage = (url) => {
  return async (dispatch) => {
    Loading.pulse({
      svgSize: "120px",
      svgColor: "#fff",
    });
    axios
      .get(url)
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
      })
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
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
    })
    .addCase(actWeaknesses, (state, action) => {
      return { ...state, Weaknesses: action.payload };
    });
});
