type FareLeg = {
  departureAirport: { iataCode: string };
  arrivalAirport: { iataCode: string };
  departureDate: string;
  arrivalDate: string;
  price: { value: number };
  flightNumber?: string;
};

function leg(item: FareLeg, direction: 'out' | 'return') {
  const flightNumber = item.flightNumber?.replace(/\s/g, '') || 'flight';
  return {
    id: `${flightNumber.toLowerCase()}-${direction}-${item.departureDate.slice(0, 10)}`,
    airline: 'Ryanair', flight_number: flightNumber,
    from: item.departureAirport.iataCode, to: item.arrivalAirport.iataCode,
    depart: item.departureDate, arrive: item.arrivalDate,
    price_per_person: Number(item.price.value), live: true,
  };
}

export async function POST(request: Request) {
  try {
    const { origin, destination, start, end, currency = 'EUR' } = await request.json() as Record<string, string>;
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return Response.json({ error: 'Airport codes and travel dates are required.' }, { status: 400 });
    const params = new URLSearchParams({ departureAirportIataCode: origin, arrivalAirportIataCode: destination, outboundDepartureDateFrom: start, outboundDepartureDateTo: start, inboundDepartureDateFrom: end, inboundDepartureDateTo: end, currency });
    const response = await fetch(`https://www.ryanair.com/api/farfnd/3/roundTripFares?${params}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Ryanair returned ${response.status}`);
    const data = await response.json() as { fares?: Array<{ outbound: FareLeg; inbound: FareLeg }> };
    const fares = data.fares ?? [];
    const outbound = [...new Map(fares.map((fare) => leg(fare.outbound, 'out')).map((item) => [item.id, item])).values()];
    const returns = [...new Map(fares.map((fare) => leg(fare.inbound, 'return')).map((item) => [item.id, item])).values()];
    if (!outbound.length || !returns.length) return Response.json({ error: 'No direct Ryanair fares were returned for these exact dates.' }, { status: 404 });
    return Response.json({ provider: 'Ryanair', updated_at: new Date().toISOString(), outbound, return: returns });
  } catch (error) {
    return Response.json({ error: 'Live fares are temporarily unavailable.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 502 });
  }
}
