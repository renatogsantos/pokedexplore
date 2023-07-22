import "./globals.scss";
import ProviderLayout from "@/Provider/ProviderLayout";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="keywords"
          content="PokedExplore, Pokémon, exploration, game, creatures"
        />

        <meta
          name="description"
          content="Explore e descubra informações sobre os Pokémon com a PokedExplore, uma Pokedex online baseada na API PokeAPI."
        />
        <meta name="author" content="Renato Gomes dos Santos" />

        <meta property="og:title" content="PokedExplore - Sua Pokedex Online" />
        <meta
          property="og:description"
          content="Explore e descubra informações sobre os Pokémon com a PokedExplore, uma Pokedex online baseada na API PokeAPI."
        />
        <meta property="og:image" content="/share-img.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://pokedexplore.vercel.app" />
        <meta property="og:site_name" content="PokedExplore" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="/share-img.png" />
        <meta
          name="twitter:title"
          content="PokedExplore - Sua Pokedex Online"
        />
        <meta
          name="twitter:description"
          content="Explore e descubra informações sobre os Pokémon com a PokedExplore, uma Pokedex online baseada na API PokeAPI."
        />
        <meta name="twitter:image" content="/share-img.png" />

        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-XVZ0MJV2J3"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-XVZ0MJV2J3');
            `,
          }}
        />
        <title>PokédExplore</title>
      </head>
      <ProviderLayout>{children}</ProviderLayout>
    </html>
  );
}
