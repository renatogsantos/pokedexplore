"use client";
import { store } from "@/redux/store";
import { Provider } from "react-redux";
import GlobalBattleButton from "@/components/GlobalBattleButton";

export default function ProviderLayout({ children }) {
  return (
    <Provider store={store}>
      <body suppressHydrationWarning={true}>
        <div className="global-battle-content">{children}</div>
        <GlobalBattleButton />
      </body>
    </Provider>
  );
}
