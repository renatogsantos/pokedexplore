"use client";
import "./globals.scss";
import { Provider } from "react-redux";
import { store } from "./redux/store";

export const metadata = {
  title: "PokedExplore",
  description: "Eu escolho você!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <Provider store={store}>
        <body suppressHydrationWarning={true}>{children}</body>
      </Provider>
    </html>
  );
}
