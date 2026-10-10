import { Bell, Heart, MapPin, PawPrint, QrCode, Share2, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { BetaVersionBadge } from "@/components/beta-version-badge";
import { BottomNav } from "@/components/bottom-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { LostPetMap } from "@/components/lost-pet-map";
import { PetCarousel } from "@/components/pet-carousel";
import { ReunionStoryList } from "@/components/reunion-story-list";
import { getHomePageData } from "@/lib/home-page-data";
import howBellIcon from "../assets/icons/light/bell.png";
import howHeartIcon from "../assets/icons/light/heart.png";
import howPawIcon from "../assets/icons/light/paw.png";
import howLocationIcon from "../assets/icons/light/location.png";
import heroDogImage from "../assets/home/hero-pets.png";
import betaVersionIcon from "./beta_icon2.png";

const quickActions = [
  { label: "Reportar", href: "/reportar", icon: PawPrint },
  { label: "Alertas", href: "/alertas", icon: Bell },
  { label: "QR", href: "/#comunidad", icon: QrCode },
  { label: "Compartir", href: "#inicio", icon: Share2 },
];

const howItWorks = [
  { title: "Reporta", text: "Registra tu mascota perdida o vista en pocos pasos.", icon: howPawIcon },
  { title: "Comparte", text: "Tu reporte se comparte en la comunidad y redes sociales.", icon: howLocationIcon },
  { title: "Activa alertas", text: "Recibe notificaciones de avistamientos cercanos.", icon: howBellIcon },
  { title: "Reencuentro", text: "La familia y su mascota vuelven a casa.", icon: howHeartIcon },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { homePets, reunionStories } = await getHomePageData();
  const mapPets = homePets;
  const recentPets = homePets.slice(0, 5);
  return (
    <main className="mobileApp">
      <AppHeader />
      <BetaVersionBadge iconSrc={betaVersionIcon.src} />
      <EmailVerificationBanner />

      <section className="welcomePanel appSection" id="inicio" style={{ "--hero-image": `url(${heroDogImage.src})` }}>
        <div className="welcomeCopy">
          <p className="eyebrow">Plataforma comunitaria</p>
          <h1>Juntos los traemos a casa</h1>
          <p>Reporta, busca y encuentra mascotas perdidas o vistas en tu comunidad. Cada accion suma para reunirlas con su familia.</p>
          <div className="heroActions">
            <a className="primaryButton" href="/reportar">
              <PawPrint size={18} />
              Reportar mascota perdida
            </a>
            <a className="secondaryButton heroSecondary" href="/alertas">
              <MapPin size={18} />
              Ver alertas cercanas
            </a>
          </div>
        </div>
      </section>

      <section className="howSection appSection" id="como-funciona" aria-labelledby="how-title">
        <div className="sectionHead centered">
          <div>
            <h2 id="how-title">
              Cómo funciona
              <Heart size={19} />
            </h2>
          </div>
        </div>
        <div className="howGrid">
          {howItWorks.map((step, index) => (
            <article className="howStep" key={step.title}>
              <div className="stepIcon">
                <span className="stepNumber">{index + 1}</span>
                <img className="stepIconImage" src={step.icon.src} alt="" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="quickGrid" aria-label="Acciones rapidas">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <a className="quickAction" href={action.href} key={action.label}>
              <Icon size={21} />
              <span>{action.label}</span>
            </a>
          );
        })}
      </section>

      <section className="mapSection" aria-labelledby="map-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Avistamientos cercanos</p>
            <h2 id="map-title">Actividad cerca de ti</h2>
          </div>
          <a href="/alertas">Ver todas</a>
        </div>
        <LostPetMap pets={mapPets} />
      </section>

      <section className="alertSection appSection" id="alertas" aria-labelledby="alerts-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Alertas</p>
            <h2 id="alerts-title">Mascotas recientes</h2>
          </div>
          <a className="sectionLinkButton" href="/alertas">Ver todas</a>
        </div>

        <PetCarousel pets={recentPets} />
      </section>

      <section className="reportSection appSection" id="reportar" aria-labelledby="report-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Reportar</p>
            <h2 id="report-title">Crear alerta</h2>
            <p>Completa el reporte en una pantalla dedicada, mas clara para celular.</p>
          </div>
        </div>

        <a className="primaryButton fullWidth" href="/reportar">
          <PawPrint size={18} />
          Abrir formulario de reporte
        </a>
      </section>

      <section className="communitySection appSection" id="comunidad" aria-labelledby="community-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Comunidad</p>
            <h2 id="community-title">Historias de la comunidad</h2>
          </div>
          <Heart size={22} />
        </div>

        <ReunionStoryList stories={reunionStories} />
      </section>

      <section className="safetyBanner">
        <ShieldCheck size={22} />
        <p>HuellamiGO muestra zonas aproximadas para proteger a familias y vecinos.</p>
      </section>

      <BottomNav />
    </main>
  );
}
