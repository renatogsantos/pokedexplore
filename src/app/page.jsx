"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { getPokemons } from "./redux/pokemons";

export default function Home() {
  const [units, setUnits] = useState(0);
  const dispatch = useDispatch();
  const { Pokemons } = useSelector((state) => state.pokemons);

  useEffect(() => {
    dispatch(getPokemons(units));
  }, [units]);

  return (
    <main>
      <Container>
        <Row>
          {Pokemons.map((pokemon) => {
            return (
              <Col key={pokemon.name}>
                <div>
                  <img
                    width="300"
                    src={pokemon.sprites.other.home.front_default}
                  />
                </div>
              </Col>
            );
          })}
        </Row>
        <div className="d-flex">
          <button
            type="button"
            onClick={() => {
              setUnits(units - 20);
            }}
          >
            Previews
          </button>
          <button
            type="button"
            onClick={() => {
              setUnits(units + 20);
            }}
          >
            Next
          </button>
        </div>
      </Container>
    </main>
  );
}
