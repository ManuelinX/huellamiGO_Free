import { ArrowLeft, CircleDollarSign, Clock, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SightingForm } from "@/components/sighting-form";
import { SightingActivityMap } from "@/components/sighting-activity-map";
import { pets } from "@/lib/mock-data";
import { getLostPetReportById } from "@/lib/reports";
import { getSightingConfidenceLabel, getSightings } from "@/lib/sightings";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return pets.map((pet) => ({ slug: pet.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const pet = pets.find((item) => item.slug === slug);

  return {
    title: pet ? `${pet.name} - HuellamiGO` : "Mascota - HuellamiGO",
  };
}

export default async function PetDetailPage({ params }) {
  const { slug } = await params;
  let pet = pets.find((item) => item.slug === slug);
  let sightings = [];

  if (!pet) {
    try {
      pet = await getLostPetReportById(slug);
    } catch (error) {
      if (error.status && error.status !== 404) {
        throw error;
      }

      pet = null;
    }
  }

  if (pet && !pets.some((item) => item.slug === slug)) {
    try {
      sightings = await getSightings(slug);
    } catch (error) {
      sightings = [];
    }
  }

  if (!pet) {
    notFound();
  }

  return (
    <main className="detailPage">
      <nav className="detailNav">
        <Link href="/">
          <ArrowLeft size={18} />
          Volver al mapa
        </Link>
      </nav>

      <section className="detailHero">
        <div className={`detailPhoto ${pet.avatarClass}`} aria-hidden="true">
          {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : null}
        </div>
        <div className="detailCopy">
          <p className="eyebrow">Mascota perdida</p>
          <h1>{pet.name}</h1>
          <p>{pet.description}</p>
          <div className="detailFacts">
            <span><MapPin size={17} /> {pet.zone}</span>
            <span><Clock size={17} /> {pet.lastSeenWhen}</span>
            {pet.reward?.enabled ? (
              <span>
                <CircleDollarSign size={17} />
                {pet.reward.showAmount
                  ? `$${Number(pet.reward.amount).toLocaleString("es-MX")} ${pet.reward.currency}`
                  : "Recompensa disponible"}
              </span>
            ) : null}
          </div>
          <div className="detailActions">
            <a className="primaryButton" href="#avistamiento">
              <MessageCircle size={18} />
              La vi
            </a>
          </div>
        </div>
      </section>

      <section className="detailGrid">
        <article className="infoPanel">
          <h2>Cómo ayudar</h2>
          <p>
            Si viste a {pet.name}, envía una zona aproximada, hora y una foto si
            puedes hacerlo sin acercarte demasiado.
          </p>
        </article>
        <article className="infoPanel">
          <h2>Privacidad</h2>
          <p>
            HuellamiGO no muestra domicilios exactos. Los Lo vi se agrupan por
            zona para proteger a vecinos y dueños.
          </p>
        </article>
        <article className="infoPanel">
          <h2>Contacto</h2>
          <p>
            Contacto de {pet.contact.name}: {pet.contact.masked}. Método
            preferido: {pet.contact.preferredMethod}.
          </p>
          {pet.contact.whatsappUrl ? (
            <a
              className="contactAction"
              href={pet.contact.whatsappUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle size={17} />
              Contactar por WhatsApp
            </a>
          ) : (
            <a className="contactAction secondary" href="#avistamiento">
              <MessageCircle size={17} />
              Enviar Lo vi
            </a>
          )}
        </article>
        <article className="infoPanel">
          <ShieldCheck size={22} />
          <h2>Estado</h2>
          <p>Reporte activo y visible para la comunidad cercana.</p>
        </article>
      </section>

      <section className="sightingSection" id="avistamiento">
        <article className="activityPanel">
          <div>
            <p className="eyebrow">Actividad reciente</p>
            <h2>Mapa de Lo vi</h2>
            <p>
              Los círculos crecen donde hay más reportes. El color cambia según
              qué tan reciente fue la actividad y el marcador coral señala la
              última vez vista.
            </p>
          </div>
          <SightingActivityMap pet={pet} sightings={sightings} />
        </article>

        <SightingForm reportId={pet.id} petName={pet.name} />

        <aside className="sightingList">
          <div>
            <p className="eyebrow">Lo vi</p>
            <h2>{sightings.length} aviso{sightings.length === 1 ? "" : "s"} recibido{sightings.length === 1 ? "" : "s"}</h2>
          </div>
          {sightings.length > 0 ? (
            sightings.map((sighting) => (
              <article className="sightingItem" key={sighting.id}>
                {sighting.photoUrl ? <img src={sighting.photoUrl} alt="" /> : null}
                <div>
                  <strong>{sighting.contactName ?? "Vecino de la comunidad"}</strong>
                  <p>{sighting.comment || "Sin comentario adicional."}</p>
                  <span>{sighting.lat.toFixed(5)}, {sighting.lng.toFixed(5)}</span>
                  <small>Confianza {getSightingConfidenceLabel(sighting)} ({sighting.confidenceScore}/100)</small>
                </div>
              </article>
            ))
          ) : (
            <p>Aún no hay Lo vi registrados para este reporte.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
