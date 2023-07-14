import { FacebookLogo, LinkedinLogo, TwitterLogo } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export default function ShareButtons() {
  const router = useRouter();
  const shareUrl = `https://pokedexplore.vercel.app/${
    router.asPath ? router.asPath : ""
  }`; // Obtém a URL atual

  function compartilharNoLinkedIn(titulo, descricao, url) {
    // Construir a URL de compartilhamento do LinkedIn
    const linkedInURL = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
      url
    )}&title=${encodeURIComponent(titulo)}&summary=${encodeURIComponent(
      descricao
    )}`;

    // Abrir a janela de compartilhamento do LinkedIn
    window.open(linkedInURL, "_blank");
  }
  function compartilharNoTwitter(titulo, url) {
    // Construir a URL de compartilhamento do Twitter
    const twitterURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      titulo
    )}&url=${encodeURIComponent(url)}`;

    // Abrir a janela de compartilhamento do Twitter
    window.open(twitterURL, "_blank");
  }
  function compartilharNoFacebook(url) {
    // Construir a URL de compartilhamento do Facebook
    const facebookURL = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}`;

    // Abrir a janela de compartilhamento do Facebook
    window.open(facebookURL, "_blank");
  }

  return (
    <div className="button-share-box">
      <button
        type="buttom"
        className="button-share"
        onClick={() => {
          compartilharNoFacebook("https://pokedexplore.vercel.app/");
        }}
      >
        <FacebookLogo size={24} weight="duotone" />
      </button>
      <button
        type="buttom"
        className="button-share"
        onClick={() => {
          compartilharNoTwitter(
            "PokédExplore",
            "https://pokedexplore.vercel.app/"
          );
        }}
      >
        <TwitterLogo size={24} weight="duotone" />
      </button>
      <button
        type="buttom"
        className="button-share"
        onClick={() => {
          compartilharNoLinkedIn(
            "PokédExplore",
            "🎉 Apresentando: PokédExplore! 🚀 Estou animado em compartilhar meu novo projeto pessoal: PokédExplore! 🌟 É um site interativo que permite explorar uma vasta coleção de pokémons da API pokeapi.co. Com tecnologia Next.js, Redux e armazenamento local, você poderá mergulhar no mundo dos pokémons e salvar seu progresso. Vamos explorar juntos! 🔎💫 #PokedExplore #NextJS #Redux #Pokémon #reactjs #javascript",
            "https://pokedexplore.vercel.app/"
          );
        }}
      >
        <LinkedinLogo size={24} weight="duotone" />
      </button>
    </div>
  );
}
