"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { webStore } from "@/helpers/webStore";
import { actCoins } from "@/redux/economy";
import { formatCoins } from "@/lib/economy";

export default function CoinBalance({ className = "" }) {
  const dispatch = useDispatch();
  const coins = useSelector((state) => state.economy.coins);
  useEffect(() => { webStore.getEconomy().then((economy) => dispatch(actCoins(economy.coins))); }, [dispatch]);
  return <Link href="/loja" className={`coin-balance ${className}`} aria-label={`Ir para a Loja Pokémon. Saldo: ${coins} moedas`}>
    <img src="/coin.png" alt="" aria-hidden="true" /><strong>{formatCoins(coins)}</strong><span>moedas</span>
  </Link>;
}
