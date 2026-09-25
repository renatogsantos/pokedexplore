"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const debugEnabled = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugBattle") === "1";

export default function BattleRouteError({ error, reset }) {
  const [debug, setDebug] = useState(false);
  useEffect(() => { setDebug(debugEnabled()); console.error("[Battle route error]", error); }, [error]);
  return <main className="battle-page"><section className="battle-panel battle-route-error" role="alert"><span className="eyebrow">ARENA</span><h1>Não foi possível carregar a batalha.</h1><p>Tente novamente. Se o problema continuar, volte à arena e informe o ocorrido.</p><div className="battle-route-error__actions"><button type="button" onClick={reset}>Tentar novamente</button><Link href="/batalha">Voltar</Link></div>{debug && <pre className="battle-debug-panel">{JSON.stringify({ name: error?.name, message: error?.message, stack: error?.stack || "Stack indisponível", route: window.location.pathname }, null, 2)}</pre>}</section></main>;
}
