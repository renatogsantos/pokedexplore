import { webStore } from "@/helpers/webStore";
import { createAction, createReducer } from "@reduxjs/toolkit";
import axios from "axios";
import { Block, Loading, Notify } from "notiflix";

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
      .catch((error) => {
        console.error(error);
        Notify.failure("Pokémon não encontrado!", {
          position: "center-top",
        });
      })
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
            return uniqueWeaknesses;
          })
        );
      })
      .catch((error) => {
        console.error(error);
      });
  };
};

export const compararPokemons = (pokemon1, pokemon2) => {
  return async (dispatch) => {
    const getPokemon1Data = axios
      .get(`https://pokeapi.co/api/v2/pokemon/${pokemon1}`)
      .then((response) => response.data);

    const getPokemon2Data = axios
      .get(`https://pokeapi.co/api/v2/pokemon/${pokemon2}`)
      .then((response) => response.data);

    Promise.all([getPokemon1Data, getPokemon2Data])
      .then(([pokemon1Data, pokemon2Data]) => {
        const pokemon1Attack = pokemon1Data.stats.find(
          (stat) => stat.stat.name === "attack"
        ).base_stat;
        const pokemon1Defense = pokemon1Data.stats.find(
          (stat) => stat.stat.name === "defense"
        ).base_stat;
        const pokemon1Abilities = pokemon1Data.abilities.map(
          (ability) => ability.ability.name
        );

        const pokemon2Attack = pokemon2Data.stats.find(
          (stat) => stat.stat.name === "attack"
        ).base_stat;
        const pokemon2Defense = pokemon2Data.stats.find(
          (stat) => stat.stat.name === "defense"
        ).base_stat;
        const pokemon2Abilities = pokemon2Data.abilities.map(
          (ability) => ability.ability.name
        );

        console.log(
          `Atributos de ${pokemon1}: Ataque = ${pokemon1Attack}, Defesa = ${pokemon1Defense}`
        );
        console.log(
          `Atributos de ${pokemon2}: Ataque = ${pokemon2Attack}, Defesa = ${pokemon2Defense}`
        );
        console.log(`Habilidades de ${pokemon1}:`, pokemon1Abilities);
        console.log(`Habilidades de ${pokemon2}:`, pokemon2Abilities);

        const weaknesses1 = getPokemonWeaknesses(pokemon1);
        const weaknesses2 = getPokemonWeaknesses(pokemon2);

        Promise.all([weaknesses1, weaknesses2])
          .then(([weaknesses1, weaknesses2]) => {
            console.log(`Fraquezas de ${pokemon1}:`, weaknesses1);
            console.log(`Fraquezas de ${pokemon2}:`, weaknesses2);

            const total1 =
              pokemon1Attack + pokemon1Defense + weaknesses1.length;
            const total2 =
              pokemon2Attack + pokemon2Defense + weaknesses2.length;

            const vencedor = total1 > total2 ? pokemon1 : pokemon2;
            console.log(`O vencedor é ${vencedor}!`);
            return vencedor;
          })
          .catch((error) => {
            console.error(error);
            // Em caso de erro, você pode lidar com ele adequadamente
          });
      })
      .catch((error) => {
        console.error(error);
        // Em caso de erro, você pode lidar com ele adequadamente
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

export const addPokemonCard = (pokemon) => {
  return async (dispatch) => {
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
      .then((resp) => {
        dispatch(actPokemon(resp.data));
        dispatch(actOpenCardPokemon(true));
        webStore.saveData("Pokedex", resp.data);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        Loading.remove();
      });
  };
};

export const nextPage = (url) => {
  return async (dispatch) => {
    Block.pulse(".loading-block", "Capturando pokémon...", {
      backgroundColor: "rgba(0,0,0,0.8)",
      className: "notiflix-block",
      borderRadius: "42px",
      svgSize: "120px",
      svgColor: "#fff",
      messageColor: "#fff",
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
        Block.remove('.loading-block', 500);
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
