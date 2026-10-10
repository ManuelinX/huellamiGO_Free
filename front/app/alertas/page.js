import { Bell, MapPin } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { BetaVersionBadge } from "@/components/beta-version-badge";
import { BottomNav } from "@/components/bottom-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { LostPetMap } from "@/components/lost-pet-map";
import { PetCarousel } from "@/components/pet-carousel";
import { getHomePageData } from "@/lib/home-page-data";
import betaVersionIcon from "../beta_icon2.png";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { homePets } = await getHomePageData();
  const recentPets = homePets.slice(0, 8);

  return (
    <main className="mobileApp">
      <AppHeader />
      <BetaVersionBadge iconSrc={betaVersionIcon.src} />
      <EmailVerificationBanner />

      <section className="profileHero">
        <div>
          <p className="eyebrow">Alertas</p>
          <h1>Actividad cerca de ti</h1>
          <p>Consulta reportes activos, avistamientos y mascotas recientes en el mapa.</p>
        </div>
        <div className="profileAvatar" aria-hidden="true">
          <Bell size={34} />
        </div>
      </section>

      <section className="mapSection" aria-labelledby="alerts-map-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Mapa</p>
            <h2 id="alerts-map-title">Mascotas reportadas</h2>
          </div>
          <MapPin size={22} />
        </div>
        <LostPetMap pets={homePets} />
      </section>

      <section className="alertSection appSection" aria-labelledby="alerts-list-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Recientes</p>
            <h2 id="alerts-list-title">Ultimas alertas</h2>
          </div>
        </div>

        <PetCarousel pets={recentPets} />
      </section>

      <BottomNav />
    </main>
  );
}
