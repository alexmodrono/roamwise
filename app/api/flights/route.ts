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
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Ryanair returned an invalid ${direction} fare`);
  return {
    id: `${flightNumber.toLowerCase()}-${direction}-${item.departureDate.slice(0, 10)}`,
    airline: 'Ryanair', flight_number: flightNumber,
    from: item.departureAirport.iataCode, to: item.arrivalAirport.iataCode,
    depart: item.departureDate, arrive: item.arrivalDate,
    price_per_person: price, live: true, fare_source: `Ryanair Fare Finder (${currency})`,
    price_updated_at: item.priceUpdated ? new Date(item.priceUpdated).toISOString() : new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const { origin, destination, start, end, currency = 'EUR' } = await request.json() as Record<string, string>;
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return Response.json({ error: 'Airport codes and travel dates are required.' }, { status: 400 });
    const params = new URLSearchParams({ departureAirportIataCode: origin, arrivalAirportIataCode: destination, outboundDepartureDateFrom: start, outboundDepartureDateTo: start, inboundDepartureDateFrom: end, inboundDepartureDateTo: end, currency });
    const response = await fetch(`https://www.ryanair.com/api/farfnd/3/roundTripFares?${params}`, { cache: 'no-store', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Ryanair returned ${response.status}`);
    const data = await response.json() as { fares?: Array<{ outbound: FareLeg; inbound: FareLeg }> };
    const fares = data.fares ?? [];
    const outbound = [...new Map(fares.map((fare) => leg(fare.outbound, 'out', currency)).map((item) => [item.id, item])).values()];
    const returns = [...new Map(fares.map((fare) => leg(fare.inbound, 'return', currency)).map((item) => [item.id, item])).values()];
    if (!outbound.length || !returns.length) return Response.json({ error: 'No direct Ryanair fares were returned for these exact dates.' }, { status: 404 });
    const value = { provider: 'Ryanair', updated_at: new Date().toISOString(), outbound, return: returns };
    return Response.json(value, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Live fares are temporarily unavailable.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 502 });
  }
}
