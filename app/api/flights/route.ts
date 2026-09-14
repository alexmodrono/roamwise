type FareLeg = {
  departureAirport: { iataCode: string };
  arrivalAirport: { iataCode: string };
  departureDate: string;
  arrivalDate: string;
  price: { value: number };
  flightNumber?: string;
  priceUpdated?: number;
};

function leg(item: FareLeg, direction: 'out' | 'return', currency: string) {
  const flightNumber = item.flightNumber?.replace(/\s/g, '') || 'flight';
  const price = Number(item.price?.value);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (!item.departureAirport?.iataCode || !item.arrivalAirport?.iataCode) return null;
  return {
    id: `${flightNumber.toLowerCase()}-${direction}-${item.departureDate.slice(0, 10)}`,
    airline: 'Ryanair', flight_number: flightNumber,
    from: item.departureAirport.iataCode, to: item.arrivalAirport.iataCode,
    depart: item.departureDate, arrive: item.arrivalDate,
    price_per_person: price, live: true, fare_source: `Ryanair Fare Finder (${currency})`,
    price_updated_at: item.priceUpdated ? new Date(item.priceUpdated).toISOString() : new Date().toISOString(),
  };
}

type AerodromeElement = { lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: { iata?: string } };
const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const airportCache = new Map<string, string>();
const LOOKUP_HEADERS = { 'user-agent': 'Roamwise/1.0 trip-planner', accept: 'application/json' };

async function wikidataAirport(name: string): Promise<string | null> {
  try {
    const search = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(`${name} airport`)}&language=en&format=json&limit=5&type=item`, { headers: LOOKUP_HEADERS, signal: AbortSignal.timeout(6000) });
    if (!search.ok) return null;
    const results = await search.json() as { search?: Array<{ id?: string }> };
    const ids = (results.search ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).slice(0, 3);
    if (!ids.length) return null;
    const claims = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims&format=json`, { headers: LOOKUP_HEADERS, signal: AbortSignal.timeout(6000) });
    if (!claims.ok) return null;
    type Snak = { mainsnak?: { datavalue?: { value?: unknown } } };
    const entities = await claims.json() as { entities?: Record<string, { claims?: Record<string, Snak[]> }> };
    for (const id of ids) {
      const iata = entities.entities?.[id]?.claims?.P238?.[0]?.mainsnak?.datavalue?.value;
      if (typeof iata === 'string' && /^[A-Z]{3}$/.test(iata)) return iata;
    }
    return null;
  } catch { return null; }
}

async function geocode(value: string, attempt = 0): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(value)}`, {
      headers: LOOKUP_HEADERS, signal: AbortSignal.timeout(6000),
    });
    if ((response.status === 403 || response.status === 429) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return geocode(value, attempt + 1);
    }
    if (!response.ok) return null;
    const matches = await response.json() as Array<{ lat?: string; lon?: string }>;
    const lat = Number(matches[0]?.lat); const lng = Number(matches[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

async function nearestAirportIata(lat: number, lng: number): Promise<string | null> {
  const query = `[out:json][timeout:10];nwr(around:80000,${lat},${lng})[aeroway=aerodrome][iata];out center tags;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Roamwise/1.0 trip-planner' },
        body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const data = await response.json() as { elements?: AerodromeElement[] };
      const airports = (data.elements ?? []).flatMap((element) => {
        const point = element.center ?? { lat: element.lat, lon: element.lon };
        const iata = element.tags?.iata;
        const airportLat = Number(point?.lat); const airportLng = Number(point?.lon);
        if (!iata || !/^[A-Z]{3}$/.test(iata) || !Number.isFinite(airportLat) || !Number.isFinite(airportLng)) return [];
        return [{ iata, distance: Math.hypot(airportLat - lat, airportLng - lng) }];
      }).sort((a, b) => a.distance - b.distance);
      return airports[0]?.iata ?? null;
    } catch { /* Try the next mirror. */ }
  }
  return null;
}

async function resolveAirport(value: string | undefined): Promise<string | null> {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  const cacheKey = trimmed.toLowerCase();
  const cached = airportCache.get(cacheKey);
  if (cached) return cached;
  let code = await wikidataAirport(trimmed);
  if (!code) {
    const point = await geocode(trimmed);
    if (point) code = await nearestAirportIata(point.lat, point.lng);
  }
  if (code) airportCache.set(cacheKey, code);
  return code;
}

export async function POST(request: Request) {
  try {
    const { origin, destination, start, end, currency = 'EUR' } = await request.json() as Record<string, string | undefined>;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? '')) {
      return Response.json({ error: 'Set your travel dates in trip details first.' }, { status: 400 });
    }
    const originCode = await resolveAirport(origin);
    const destinationCode = await resolveAirport(destination);
    if (!originCode) return Response.json({ error: `Could not resolve “${origin ?? ''}” to an airport.`, detail: 'The lookup services may be busy — try again, or open trip details and set the origin IATA code (for example MAD).' }, { status: 400 });
    if (!destinationCode) return Response.json({ error: `Could not resolve “${destination ?? ''}” to an airport.`, detail: 'The lookup services may be busy — try again, or open trip details and set the destination IATA code (for example EDI).' }, { status: 400 });

    const params = new URLSearchParams({ departureAirportIataCode: originCode, arrivalAirportIataCode: destinationCode, outboundDepartureDateFrom: start!, outboundDepartureDateTo: start!, inboundDepartureDateFrom: end!, inboundDepartureDateTo: end!, currency });
    const response = await fetch(`https://www.ryanair.com/api/farfnd/3/roundTripFares?${params}`, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Ryanair returned ${response.status}`);
    const data = await response.json() as { fares?: Array<{ outbound: FareLeg; inbound: FareLeg }> };
    const fares = data.fares ?? [];
    const dedupe = (items: NonNullable<ReturnType<typeof leg>>[]) => [...new Map(items.map((item) => [item.id, item])).values()];
    const outbound = dedupe(fares.map((fare) => leg(fare.outbound, 'out', currency)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
    const returns = dedupe(fares.map((fare) => leg(fare.inbound, 'return', currency)).filter((item): item is NonNullable<typeof item> => Boolean(item)));
    if (!outbound.length || !returns.length) return Response.json({ error: `No Ryanair fares were found for ${originCode} → ${destinationCode} on those exact dates.`, detail: 'This route may not be served by Ryanair — you can still add flights manually.' }, { status: 404 });
    const value = { provider: 'Ryanair', updated_at: new Date().toISOString(), outbound, return: returns };
    return Response.json(value, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Live fares are temporarily unavailable.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 502 });
  }
}
