"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GithubLogo, LinkedinLogo, LockKey, WhatsappLogo } from "@phosphor-icons/react";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/config";
import "./style.scss";

export default function Footer() {
  const pathname = usePathname();
  // Keep navigation outside full-screen gameplay and creator controls.
  if (["/batalha", "/arena", "/campeonato", "/multiplayer", "/creator-control"].some((route) => pathname === route || pathname?.startsWith(`${route}/`))) return null;
  return (
    <footer className="project-footer">
      <div className="project-footer__inner">
        <div>
          <strong>PokédExplore</strong>
          <p>Projeto de fã gratuito e não oficial.</p>
          <span>Renato G Santos</span>
          {LEGAL_CONTACT_EMAIL && <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>}
        </div>
        <nav aria-label="Links do rodapé">
          <Link href="/aviso-legal" className="project-footer__legal">Aviso Legal</Link>
          <a href="https://github.com/renatogsantos/pokedexplore" target="_blank" rel="noopener noreferrer" aria-label="GitHub do projeto (abre em nova aba)"><GithubLogo size={26} aria-hidden="true" /></a>
          <a href="https://www.linkedin.com/in/renato-g-santos/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Renato (abre em nova aba)"><LinkedinLogo size={26} aria-hidden="true" /></a>
          <a href="https://api.whatsapp.com/send?phone=5511911882402&text=Ol%C3%A1%20Renato,%20pode%20me%20ajudar?" target="_blank" rel="noopener noreferrer" aria-label="Contato pelo WhatsApp (abre em nova aba)"><WhatsappLogo size={26} aria-hidden="true" /></a>
          <Link href="/creator-control" aria-label="Controle do criador"><LockKey size={26} aria-hidden="true" /></Link>
        </nav>
      </div>
    </footer>
  );
}
