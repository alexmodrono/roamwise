import type { Coordinates } from '@/lib/trip-schema';

export const MAP_STYLE_URL = '/maps/orchard.json';

export function openStreetMapUrl(name: string, address?: string, coordinates?: Coordinates) {
  const params = new URLSearchParams();
  if (coordinates) {
    params.set('mlat', String(coordinates.lat));
    params.set('mlon', String(coordinates.lng));
    return `https://www.openstreetmap.org/?${params}#map=16/${coordinates.lat}/${coordinates.lng}`;
  }
  params.set('query', address ? `${name}, ${address}` : name);
  return `https://www.openstreetmap.org/search?${params}`;
}
