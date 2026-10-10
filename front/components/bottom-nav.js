"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MapPin, Users } from "lucide-react";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/reportar", label: "Reportar", icon: MapPin },
  { href: "/#comunidad", label: "Comunidad", icon: Users },
];

function isActivePath(pathname, href) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href;
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottomNav" aria-label="Navegacion principal">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            className={isActivePath(pathname, item.href) ? "isActive" : ""}
            href={item.href}
            key={item.href}
          >
            <Icon size={21} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
