import { getNewPage } from "@/redux/pokemons";
import { MinusCircle, PlusCircle } from "@phosphor-icons/react";
import axios from "axios";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

export default function Paginate({ page, onClick }) {
  const dispatch = useDispatch();
  const [value, setValue] = useState(page);

  const incremento = () => {
    setValue(value + 1);
  };
  const decremento = () => {
    setValue(value - 1);
  };

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (value !== "") {
        dispatch(getNewPage(value));
      }
    }, 500); // Tempo de atraso em milissegundos

    return () => {
      clearTimeout(timerId);
    };
  }, [value, dispatch]);

  return (
    <div className="paginate">
      <button
        tabIndex={0}
        type="button"
        className={`button-paginate ${value <= 0 && "disabled"}`}
        onClick={() => {
          onClick;
          decremento();
        }}
      >
        <MinusCircle size={24} weight="duotone" />
      </button>
      <input
        type="tel"
        value={value}
        onChange={(e) => {
          setValue(
            e.target.value.trim() !== "" ? parseInt(e.target.value) : ""
          );
        }}
      />
      <button
        tabIndex={0}
        type="button"
        className={`button-paginate ${value >= 142 && "disabled"}`}
        onClick={() => {
          onClick;
          incremento();
        }}
      >
        <PlusCircle size={24} weight="duotone" />
      </button>
    </div>
  );
}
