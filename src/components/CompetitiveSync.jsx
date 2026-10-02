"use client";
import { useEffect, useRef, useState } from "react";
import { Crown } from "@phosphor-icons/react";
import { useDispatch } from "react-redux";
import { actCoins } from "@/redux/economy";
import { flushCompetitiveResults } from "@/lib/ranking/sync";
import { formatCoins } from "@/lib/economy";
import { POKEMON_MASTER_TITLE, POKEMON_MASTER_BONUS_COINS } from "@/lib/profile/pokemonMaster";
import { celebratePokemonMaster } from "@/lib/celebration";
import styles from "./CompetitiveSync.module.scss";

export default function CompetitiveSync() {
  const dispatch = useDispatch();
  const [bonus, setBonus] = useState(0);
  const [achievement, setAchievement] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    const flush = () => { void flushCompetitiveResults().catch(error => { if (process.env.NODE_ENV !== "production") console.warn("[Ranking] Sync unavailable", error?.code || error?.message); }); };
    const settled = ({ detail }) => {
      if (!detail?.applied) return;
      dispatch(actCoins(detail.coins));
      setBonus(detail.masterBonus);
      setAchievement(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBonus(0), 2800);
    };
    const events = ["online", "focus", "competitive-outbox", "trainer-profile-updated"];
    const achieved = () => {
      setAchievement(true);setBonus(0);clearTimeout(timer.current);
      celebratePokemonMaster();timer.current=setTimeout(()=>setAchievement(false),5000);
    };
    events.forEach(event => window.addEventListener(event, flush));
    window.addEventListener("competitive-settlement", settled);
    window.addEventListener("pokemon-master-achievement", achieved);
    flush();
    return () => { clearTimeout(timer.current); events.forEach(event => window.removeEventListener(event, flush)); window.removeEventListener("competitive-settlement", settled);window.removeEventListener("pokemon-master-achievement",achieved); };
  }, [dispatch]);
  return achievement || bonus > 0 ? <aside className={styles.toast} role="status"><Crown size={26} weight="fill" aria-hidden="true" /><span>{POKEMON_MASTER_TITLE}{achievement ? <><strong>Você conquistou todas as 18 Insígnias!</strong><span>Enquanto mantiver todas elas, receba +{formatCoins(POKEMON_MASTER_BONUS_COINS)} moedas por partida elegível concluída.</span></> : <strong>+{formatCoins(bonus)} MOEDAS</strong>}</span></aside> : null;
}
