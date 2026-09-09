"use client";
import { store } from "@/redux/store";
import { Provider } from "react-redux";
import MobileBottomNavigation from "@/components/MobileBottomNavigation";

export default function ProviderLayout({ children }) {
  return (
    <Provider store={store}>
      <body suppressHydrationWarning={true}>
        <div className="global-battle-content">{children}</div>
        <MobileBottomNavigation />
      </body>
    </Provider>
  );
}
