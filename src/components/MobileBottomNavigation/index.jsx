"use client";

import { BookOpen, House, MapTrifold, Question, Sword } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Início", Icon: House, exact: true },
  { href: "/como-jogar", label: "Como jogar", Icon: Question },
  { href: "/batalha", label: "Batalhar", Icon: Sword, battle: true },
  { href: "/jornada", label: "Jornada", Icon: MapTrifold },
  { href: "/pokedex", label: "Pokédex", Icon: BookOpen },
];

export function shouldShowMobileBottomNavigation(pathname) {
  return Boolean(pathname) && !["/batalha", "/arena", "/campeonato", "/multiplayer"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isActiveRoute(pathname, item) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function MobileBottomNavigation() {
  const pathname = usePathname();

  if (!shouldShowMobileBottomNavigation(pathname)) return null;

  return (
    <nav className="mobile-bottom-navigation" aria-label="Navegação principal">
      {navigationItems.map(({ href, label, Icon, battle, ...item }) => {
        const active = isActiveRoute(pathname, { href, ...item });
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-bottom-navigation__item${battle ? " mobile-bottom-navigation__item--battle" : ""}${active ? " is-active" : ""}`}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
          >
            <Icon size={battle ? 27 : 23} weight={active || battle ? "fill" : "regular"} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
