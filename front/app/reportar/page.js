import { PawPrint } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { BetaVersionBadge } from "@/components/beta-version-badge";
import { BottomNav } from "@/components/bottom-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { ReportForm } from "@/components/report-form";
import betaVersionIcon from "../beta_icon2.png";

export const dynamic = "force-dynamic";

export default function ReportPage() {
  return (
    <main className="mobileApp">
      <AppHeader />
      <BetaVersionBadge iconSrc={betaVersionIcon.src} />
      <EmailVerificationBanner />

      <section className="profileHero">
        <div>
          <p className="eyebrow">Reportar</p>
          <h1>Crear alerta</h1>
          <p>Completa lo esencial primero. Los detalles opcionales ayudan a mejorar la respuesta.</p>
        </div>
        <div className="profileAvatar" aria-hidden="true">
          <PawPrint size={34} />
        </div>
      </section>

      <section className="reportSection appSection" aria-labelledby="report-page-title">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Formulario</p>
            <h2 id="report-page-title">Datos del reporte</h2>
          </div>
        </div>

        <ReportForm />
      </section>

      <BottomNav />
    </main>
  );
}
