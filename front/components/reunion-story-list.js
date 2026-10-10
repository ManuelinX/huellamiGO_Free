"use client";

import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";

const displayMs = 15 * 1000;
const defaultStoryMessage = "Una familia compartio su final feliz con la comunidad.";

function getStoryMessage(story) {
  return story?.reunionStory?.message || defaultStoryMessage;
}

function StoryTextPlaceholder({ story, compact = false }) {
  return (
    <div className={compact ? "storyTextThumb" : "storyTextHero"}>
      <Heart size={compact ? 15 : 26} />
      <p>{getStoryMessage(story)}</p>
    </div>
  );
}

export function ReunionStoryList({ stories }) {
  const [selectedStory, setSelectedStory] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const selectedPhotos = selectedStory
    ? [selectedStory.reunionStory.photoUrl, selectedStory.reunionStory.photoUrl2].filter(Boolean)
    : [];
  const activePhoto = selectedPhotos[photoIndex];
  const nextPhoto = selectedPhotos[(photoIndex + 1) % selectedPhotos.length];

  useEffect(() => {
    if (!selectedStory) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (photoIndex + 1 < selectedPhotos.length) {
        setPhotoIndex((currentIndex) => currentIndex + 1);
        return;
      }

      setSelectedStory(null);
    }, displayMs);

    return () => window.clearTimeout(timer);
  }, [photoIndex, selectedPhotos.length, selectedStory]);

  if (stories.length === 0) {
    return null;
  }

  return (
    <>
      <div className="reunionStoryList">
        <div className="sectionHead compact">
          <h3>Finales felices</h3>
          <a href="#reportar">Reportar</a>
        </div>
        {stories.map((pet) => (
          <button
            className="communityStory"
            key={pet.id}
            onClick={() => {
              setSelectedStory(pet);
              setPhotoIndex(0);
            }}
            type="button"
          >
            {pet.reunionStory.photoUrl ? (
              <img src={pet.reunionStory.photoUrl} alt="" />
            ) : (
              <StoryTextPlaceholder story={pet} compact />
            )}
            <div>
              <strong>{pet.name} volvio a casa</strong>
              <p>{getStoryMessage(pet)}</p>
              <span className="storySightingCount">
                {pet.sightingsCount} avistamiento{pet.sightingsCount === 1 ? "" : "s"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedStory ? (
        <div className="storyOverlay" role="dialog" aria-modal="true">
          <article className="storyModal">
            <button
              className="storyClose"
              onClick={() => setSelectedStory(null)}
              type="button"
              aria-label="Cerrar historia"
            >
              <X size={20} />
            </button>
            {activePhoto ? (
              <div>
                <div className={`storyPhotoStack ${selectedPhotos.length > 1 ? "hasNext" : ""}`}>
                  {selectedPhotos.length > 1 ? (
                    <img className="storyPhotoBack" src={nextPhoto} alt="" />
                  ) : null}
                  <div className="storyPhotoFrame">
                    <img className="storyPhotoFront" src={activePhoto} alt="" />
                  </div>
                </div>
                {selectedPhotos.length > 1 ? (
                  <span className="storyPhotoCount">
                    {photoIndex + 1} / {selectedPhotos.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <StoryTextPlaceholder story={selectedStory} />
            )}
            <div>
              <p className="eyebrow">Historia de reencuentro</p>
              <h2>{selectedStory.name} volvio a casa</h2>
              <span className="storySightingCount modalCount">
                {selectedStory.sightingsCount} avistamiento{selectedStory.sightingsCount === 1 ? "" : "s"} ayudaron
              </span>
              <p>
                {getStoryMessage(selectedStory)}
              </p>
              <div className="storyTimer" aria-hidden="true" key={`${selectedStory.id}-${photoIndex}`}>
                <span />
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
