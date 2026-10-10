function toRadians(value) {
  return value * Math.PI / 180;
}

export function getDistanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(Number(b.lat) - Number(a.lat));
  const dLng = toRadians(Number(b.lng) - Number(a.lng));
  const lat1 = toRadians(Number(a.lat));
  const lat2 = toRadians(Number(b.lat));
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

export function getCentroid(points) {
  const total = points.reduce((sum, point) => ({
    lat: sum.lat + Number(point.lat),
    lng: sum.lng + Number(point.lng),
  }), { lat: 0, lng: 0 });

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}
