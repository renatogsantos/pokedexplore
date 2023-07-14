"use client";
import "./globals.scss";
import { Provider } from "react-redux";
import { store } from "../redux/store";

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="keywords"
          content="PokedExplorer, Pokémon, exploration, game, creatures"
        />
        <meta
          property="og:image"
          content="/share-img.png"
        ></meta>
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
        <title>PokédExplorer</title>
      </head>
      <Provider store={store}>
        <body suppressHydrationWarning={true}>{children}</body>
      </Provider>
    </html>
  );
}
