import { FacebookLogo, LinkedinLogo, TwitterLogo } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export default function ShareButtons() {
  const router = useRouter();
  const shareUrl = `https://pokedexplore.vercel.app/${
    router.asPath ? router.asPath : ""
  }`; // Obtém a URL atual

  const handleFacebookShare = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareUrl
      )}`
    );
  };

  const handleTwitterShare = () => {
    window.open(
      `https://twitter.com/share?url=${encodeURIComponent(shareUrl)}`
    );
  };

  const handleLinkedInShare = () => {
    window.open(
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
        shareUrl
      )}`
    );
  };

  return (
    <div className="button-share-box">
      <button
        type="buttom"
        className="button-share"
        onClick={handleFacebookShare}
      >
        <FacebookLogo size={24} weight="duotone" />
      </button>
      <button
        type="buttom"
        className="button-share"
        onClick={handleTwitterShare}
      >
        <TwitterLogo size={24} weight="duotone" />
      </button>
      <button
        type="buttom"
        className="button-share"
        onClick={handleLinkedInShare}
      >
        <LinkedinLogo size={24} weight="duotone" />
      </button>
    </div>
  );
}
