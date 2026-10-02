"use client";
import { store } from "@/redux/store";
import { Provider } from "react-redux";
import MobileBottomNavigation from "@/components/MobileBottomNavigation";
import GlobalUiClickSound from "@/components/GlobalUiClickSound";
import Footer from "@/components/Footer";

export default function ProviderLayout({ children }) {
  return (
    <Provider store={store}>
      <body suppressHydrationWarning={true}>
        <GlobalUiClickSound />
        <div className="global-battle-content">{children}<Footer /></div>
        <MobileBottomNavigation />
      </body>
    </Provider>
  );
}
