import Link from "next/link";
import { LEGAL_SECTIONS } from "@/lib/legal/content";
import { LAST_UPDATED, LEGAL_CONTACT_EMAIL } from "@/lib/legal/config";
import "./style.scss";

export const metadata = {
  title: "Aviso Legal | PokédExplore",
  description: "Informações sobre o caráter independente, gratuito e não comercial do PokédExplore.",
};

export default function LegalNoticePage() {
  return (
    <main className="legal-page" id="main-content">
      <div className="legal-shell">
        <Link className="legal-back" href="/">Voltar ao início</Link>
        <header className="legal-header">
          <span className="legal-eyebrow">POKÉDEXPLORE</span>
          <h1>AVISO LEGAL</h1>
          <p>Informações sobre o PokédExplore e o uso de propriedades intelectuais de terceiros.</p>
          <div className="legal-indicators" aria-label="Sobre o projeto">
            <span>GRATUITO</span><span>SEM ANÚNCIOS</span><span>NÃO COMERCIAL</span>
          </div>
          <p className="legal-date">Última atualização: <time dateTime={LAST_UPDATED}>{LAST_UPDATED.split("-").reverse().join("/")}</time></p>
        </header>
        <aside className="legal-intro" aria-label="Projeto independente">
          <strong>PROJETO NÃO OFICIAL</strong>
          <p>PokédExplore é um projeto independente criado por fã para fins recreativos e não comerciais.</p>
          <p>PokédExplore não possui afiliação, patrocínio ou endosso da Nintendo, The Pokémon Company, Game Freak ou Creatures.</p>
        </aside>
        <article aria-label="Aviso Legal — PokédExplore">
          {LEGAL_SECTIONS.map((section, index) => (
            <section className="legal-section" key={section.title} aria-labelledby={`legal-section-${index}`}>
              <h2 id={`legal-section-${index}`}>{section.title}</h2>
              {section.blocks.map((block, blockIndex) => block.list ? (
                <ul key={blockIndex}>{block.list.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <p key={blockIndex}>{block.text}</p>)}
              {index === 6 && LEGAL_CONTACT_EMAIL && (
                <p className="legal-contact">Contato: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></p>
              )}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
