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
  const infiniteCoins = useSelector((state) => state.economy.infiniteCoins);
  useEffect(() => { webStore.getEconomy().then((economy) => dispatch(actCoins({ coins: economy.coins, infiniteCoins: economy.creatorMode?.infiniteCoins }))); }, [dispatch]);
  return <Link href="/loja" className={`coin-balance ${className}`} aria-label={`Ir para a Loja Pokémon. Saldo: ${infiniteCoins ? "moedas ilimitadas" : `${coins} moedas`}`}>
    <img src="/coin.png" alt="" aria-hidden="true" /><strong>{infiniteCoins ? "∞" : formatCoins(coins)}</strong><span>moedas</span>
  </Link>;
}
