"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export function ProfileButton() {
  const { user, isAuthLoading } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <Link
      className={`authButton compactAuthButton ${isAuthLoading ? "isDisabled" : ""}`}
      href="/perfil"
      aria-label="Abrir perfil"
    >
      <UserRound size={17} />
      <span>Perfil</span>
    </Link>
  );
}
