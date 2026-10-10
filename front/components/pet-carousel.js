"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleDollarSign, Eye } from "lucide-react";

function RewardChip({ reward }) {
  if (!reward?.enabled) {
    return null;
  }

  const label = reward.showAmount
    ? `$${Number(reward.amount).toLocaleString("es-MX")} ${reward.currency}`
    : "Recompensa";

  return (
    <span className="petRewardChip">
      <CircleDollarSign size={15} />
      {label}
    </span>
  );
}

export function PetCarousel({ pets }) {
  const listRef = useRef(null);
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const maxScrollLeft = list.scrollWidth - list.clientWidth;
    setCanScrollPrevious(list.scrollLeft > 4);
    setCanScrollNext(list.scrollLeft < maxScrollLeft - 4);
  }, []);

  const scrollCarousel = useCallback((direction) => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const distance = Math.max(list.clientWidth * 0.72, 280);
    list.scrollBy({
      left: direction * distance,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return undefined;
    }

    updateScrollState();
    list.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      list.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  return (
    <div className="petCarouselShell">
      <button
        className="petCarouselNav previous"
        disabled={!canScrollPrevious}
        onClick={() => scrollCarousel(-1)}
        type="button"
        aria-label="Ver mascotas anteriores"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="petList" ref={listRef} tabIndex={0} aria-label="Mascotas recientes">
        {pets.map((pet) => (
          <article className="petAlert" key={pet.id}>
            <Link className={`petAvatar ${pet.avatarClass}`} href={`/mascotas/${pet.slug}`} aria-label={`Ver reporte de ${pet.name}`}>
              {pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : null}
            </Link>
            <div className="petAlertCopy">
              <Link href={`/mascotas/${pet.slug}`}>
                <h3>{pet.name}</h3>
              </Link>
              <p>{pet.species}</p>
              <p>{pet.zone}</p>
              <span>{pet.lastSeenWhen}</span>
            </div>
            <RewardChip reward={pet.reward} />
            <Link className="seenButton" href={`/mascotas/${pet.slug}#avistamiento`}>
              <Eye size={15} />
              La vi
            </Link>
          </article>
        ))}
      </div>

      <button
        className="petCarouselNav next"
        disabled={!canScrollNext}
        onClick={() => scrollCarousel(1)}
        type="button"
        aria-label="Ver más mascotas"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
