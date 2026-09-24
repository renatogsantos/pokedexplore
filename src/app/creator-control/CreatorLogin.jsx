"use client";

import { Eye, EyeSlash, LockKey, ShieldWarning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreatorLogin({ configured }) {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/creator-control/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível autorizar esta sessão.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message || "Não foi possível autorizar esta sessão.");
      setBusy(false);
    }
  }

  return (
    <main className="creator-login">
      <section className="creator-login__panel" aria-labelledby="creator-login-title">
        <div className="creator-login__mark" aria-hidden="true"><LockKey size={30} weight="duotone" /></div>
        <span className="creator-kicker">POKÉDEXPLORE // RESTRICTED</span>
        <h1 id="creator-login-title">Creator Control Center</h1>
        <p>Área privada para operar somente o save local autorizado. A URL oculta não substitui esta verificação.</p>
        {!configured ? (
          <div className="creator-login__notice" role="alert">
            <ShieldWarning size={22} weight="fill" aria-hidden="true" />
            <span>Defina <code>CREATOR_CONTROL_SECRET</code> no ambiente do servidor com pelo menos 16 caracteres.</span>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="creator-passphrase">Chave de acesso</label>
            <div className="creator-password-field">
              <input
                id="creator-passphrase"
                type={visible ? "text" : "password"}
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
                aria-describedby={error ? "creator-login-error" : "creator-login-help"}
              />
              <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ocultar chave" : "Mostrar chave"} aria-pressed={visible}>
                {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <small id="creator-login-help">A chave permanece no servidor e não é incluída no bundle público.</small>
            {error && <p id="creator-login-error" className="creator-login__error" role="alert">{error}</p>}
            <button className="creator-login__submit" type="submit" disabled={busy || !passphrase}>
              {busy ? "AUTORIZANDO..." : "ENTRAR NO CONTROL CENTER"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
