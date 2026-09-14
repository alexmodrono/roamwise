type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const placeCache = new Map<string, { expires: number; value: { places: unknown[]; center?: { lat: number; lng: number }; source: string } }>();
const PLACE_CACHE_MS = 24 * 60 * 60 * 1000;

function category(tags: Record<string, string>) {
  if (tags.historic === 'castle') return 'Castle';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.tourism === 'viewpoint') return 'Viewpoint';
  if (tags.historic) return 'Historic place';
  return 'Attraction';
}

function score(tags: Record<string, string>) {
  return (tags.wikipedia ? 5 : 0) + (tags.wikidata ? 4 : 0) + (tags.website ? 1 : 0)
    + (tags.historic === 'castle' ? 4 : 0) + (tags.tourism === 'attraction' ? 2 : 0);
}

export async function POST(request: Request) {
  try {
    const { destination, coordinates } = await request.json() as { destination?: string; coordinates?: { lat?: number; lng?: number } };
    if (!destination?.trim()) return Response.json({ error: 'Destination is required.' }, { status: 400 });
    const cacheKey = destination.trim().toLowerCase();
    const cached = placeCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return Response.json(cached.value, { headers: { 'x-roamwise-cache': 'hit' } });

    let lat = Number(coordinates?.lat);
    let lng = Number(coordinates?.lng);
    try {
      const geocode = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&featuretype=city&q=${encodeURIComponent(destination)}`, {
        headers: { 'user-agent': 'Roamwise/1.0 trip-planner', accept: 'application/json' }, signal: AbortSignal.timeout(6000),
      });
      if (geocode.ok) {
        const matches = await geocode.json() as Array<{ lat: string; lon: string }>;
        if (matches[0]) { lat = Number(matches[0].lat); lng = Number(matches[0].lon); }
      }
    } catch { /* Use the trip destination coordinate when geocoding is unavailable. */ }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Destination coordinates are unavailable');
    const query = `[out:json][timeout:12];(nwr(around:6500,${lat},${lng})[tourism~"attraction|museum|gallery|viewpoint"][name];nwr(around:6500,${lat},${lng})[historic~"castle|monument|archaeological_site|memorial"][name];);out center tags;`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Roamwise/1.0 trip-planner' },
      body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Places service returned ${response.status}`);
    const data = await response.json() as { elements?: OverpassElement[] };
    const places = (data.elements ?? []).map((item) => {
      const tags = item.tags ?? {}; const point = item.center ?? { lat: item.lat, lon: item.lon };
      if (!tags.name || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) return null;
      return { id: `osm-${item.id}`, name: tags.name, category: category(tags), coordinates: { lat: Number(point.lat), lng: Number(point.lon) }, score: score(tags) };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.score - a.score).map(({ score: _score, ...place }) => place).slice(0, 14);
    const value = { places, center: { lat, lng }, source: 'OpenStreetMap' };
    placeCache.set(cacheKey, { expires: Date.now() + PLACE_CACHE_MS, value });
    return Response.json(value, { headers: { 'x-roamwise-cache': 'miss' } });
  } catch {
    return Response.json({ places: [], source: 'unavailable' });
  }
}
