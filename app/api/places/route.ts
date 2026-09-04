type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const EDINBURGH_HIGHLIGHTS = [
  { id: 'edinburgh-castle', name: 'Edinburgh Castle', category: 'Castle', coordinates: { lat: 55.9486, lng: -3.1999 } },
  { id: 'royal-mile', name: 'The Royal Mile', category: 'Historic street', coordinates: { lat: 55.9504, lng: -3.1877 } },
  { id: 'arthurs-seat', name: "Arthur’s Seat", category: 'Viewpoint', coordinates: { lat: 55.9441, lng: -3.1618 } },
  { id: 'calton-hill', name: 'Calton Hill', category: 'Viewpoint', coordinates: { lat: 55.9550, lng: -3.1827 } },
  { id: 'national-museum', name: 'National Museum of Scotland', category: 'Museum', coordinates: { lat: 55.9470, lng: -3.1890 } },
  { id: 'holyrood-palace', name: 'Palace of Holyroodhouse', category: 'Palace', coordinates: { lat: 55.9527, lng: -3.1723 } },
  { id: 'dean-village', name: 'Dean Village', category: 'Historic area', coordinates: { lat: 55.9526, lng: -3.2186 } },
  { id: 'victoria-street', name: 'Victoria Street', category: 'Landmark', coordinates: { lat: 55.9488, lng: -3.1939 } },
];
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
  let destinationName = '';
  try {
    const { destination, coordinates } = await request.json() as { destination?: string; coordinates?: { lat?: number; lng?: number } };
    if (!destination) return Response.json({ error: 'Destination is required.' }, { status: 400 });
    destinationName = destination;
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
    const discovered = (data.elements ?? []).map((item) => {
      const tags = item.tags ?? {}; const point = item.center ?? { lat: item.lat, lon: item.lon };
      if (!tags.name || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) return null;
      return { id: `osm-${item.id}`, name: tags.name, category: category(tags), coordinates: { lat: Number(point.lat), lng: Number(point.lon) }, score: score(tags) };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => b.score - a.score).map(({ score: _score, ...place }) => place);
    const pinned = /edinburgh/i.test(destinationName) ? EDINBURGH_HIGHLIGHTS : [];
    const pinnedNames = new Set(pinned.map((item) => item.name.toLowerCase()));
    const places = [...pinned, ...discovered.filter((item) => !pinnedNames.has(item.name.toLowerCase()))].slice(0, 14);
    const value = { places, center: { lat, lng }, source: 'OpenStreetMap' };
    placeCache.set(cacheKey, { expires: Date.now() + PLACE_CACHE_MS, value });
    return Response.json(value, { headers: { 'x-roamwise-cache': 'miss' } });
  } catch {
    if (/edinburgh/i.test(destinationName)) return Response.json({ places: EDINBURGH_HIGHLIGHTS, center: { lat: 55.9533, lng: -3.1883 }, source: 'curated fallback' });
    return Response.json({ places: [], source: 'unavailable' });
  }
}
