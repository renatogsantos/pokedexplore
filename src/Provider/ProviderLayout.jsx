"use client";
import { store } from "@/redux/store";
import { Provider } from "react-redux";

export default function ProviderLayout({ children }) {
  return (
    <Provider store={store}>
      <body suppressHydrationWarning={true}>{children}</body>
    </Provider>
  );
}
