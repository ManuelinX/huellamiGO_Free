const confidenceRank = {
  high: 3,
  medium: 2,
  low: 1,
};

export function getSightingTime(sighting) {
  return new Date(sighting.seenAt ?? sighting.createdAt ?? 0).getTime();
}

export function hasValidSightingPosition(sighting) {
  return Number.isFinite(sighting.lat) && Number.isFinite(sighting.lng);
}

export function sortSightingsByTime(sightings, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;

  return [...sightings].sort((left, right) => {
    return (getSightingTime(left) - getSightingTime(right)) * factor;
  });
}

export function sortTrailPanelSightings(sightings) {
  return [...sightings].sort((left, right) => {
    if (left.isHidden !== right.isHidden) {
      return left.isHidden ? 1 : -1;
    }

    if (left.isTrailKey !== right.isTrailKey) {
      return left.isTrailKey ? -1 : 1;
    }

    if (left.isUseful !== right.isUseful) {
      return left.isUseful ? -1 : 1;
    }

    const confidenceDifference =
      (confidenceRank[right.confidence] ?? 0) - (confidenceRank[left.confidence] ?? 0);

    if (confidenceDifference !== 0) {
      return confidenceDifference;
    }

    return getSightingTime(right) - getSightingTime(left);
  });
}

export function getLeadTrailSighting(sightings) {
  return sightings.find((sighting) => sighting.isTrailKey && !sighting.isHidden)
    ?? sightings.find((sighting) => sighting.isUseful && !sighting.isHidden)
    ?? sightings.find((sighting) => !sighting.isHidden)
    ?? sightings[0]
    ?? null;
}

export function getMapTrailSightings(sightings) {
  const positionedSightings = sightings.filter(hasValidSightingPosition);
  const keySightings = sortSightingsByTime(
    positionedSightings.filter((sighting) => sighting.isTrailKey && !sighting.isHidden),
  );

  if (keySightings.length > 0) {
    return keySightings;
  }

  return [];
}

export function getStableSightingNumberById(sightings) {
  const orderedSightings = sortSightingsByTime(sightings.filter(hasValidSightingPosition));

  return new Map(orderedSightings.map((sighting, index) => [sighting.id, index + 1]));
}
