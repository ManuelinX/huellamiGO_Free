import Link from "next/link";

import { AuthButton } from "@/components/auth-button";
import { MyReportsButton } from "@/components/my-reports-button";
import { NotificationsButton } from "@/components/notifications-button";
import { ProfileButton } from "@/components/profile-button";
import menuLogo from "../assets/branding/menu-logo.png";

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Reportar", href: "/reportar" },
  { label: "Alertas", href: "/alertas" },
  { label: "Comunidad", href: "/#comunidad" },
];

export function AppHeader() {
  return (
    <header className="appHeader">
      <Link className="brandWordmark" href="/" aria-label="HuellamiGO">
        <img className="brandLogoImage" src={menuLogo.src} alt="" />
      </Link>
      <nav className="topNav" aria-label="Navegacion principal">
        {navItems.map((item) => (
          <Link href={item.href} key={item.label}>{item.label}</Link>
        ))}
      </nav>
      <div className="headerActions">
        <MyReportsButton />
        <ProfileButton />
        <AuthButton />
        <NotificationsButton />
      </div>
    </header>
  );
}
