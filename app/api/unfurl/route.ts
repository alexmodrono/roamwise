const ALLOWED_HOST = /(^|\.)(airbnb\.[a-z.]+|booking\.com)$/i;

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);
}

function metas(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'gi'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'gi'),
  ];
  return patterns.flatMap((pattern) => [...html.matchAll(pattern)].map((match) => match[1])).filter(Boolean);
}

function decode(value?: string) {
  return value?.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

function findLodging(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findLodging(item); if (found) return found; }
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => ['LodgingBusiness', 'Hotel', 'Apartment', 'Product', 'VacationRental'].includes(String(item)))) return record;
  for (const child of Object.values(record)) { const found = findLodging(child); if (found) return found; }
  return null;
}

function textAddress(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const address = value as Record<string, unknown>;
  return [address.streetAddress, address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(', ');
}

function collectImages(value: unknown, target: string[]) {
  if (typeof value === 'string') { target.push(value); return; }
  if (Array.isArray(value)) { value.forEach((item) => collectImages(item, target)); return; }
  if (!value || typeof value !== 'object') return;
  const image = value as Record<string, unknown>;
  ['url', 'contentUrl', 'thumbnailUrl'].forEach((key) => collectImages(image[key], target));
}

function findOffer(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findOffer(item); if (found) return found; }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const type = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  if (type.some((item) => ['Offer', 'AggregateOffer'].includes(String(item))) && (record.price ?? record.lowPrice)) return record;
  for (const child of Object.values(record)) { const found = findOffer(child); if (found) return found; }
  return undefined;
}

function listingUrl(url: URL, context: { start?: string; end?: string; travellers?: number; currency?: string }) {
  const result = new URL(url);
  const booking = result.hostname.includes('booking.com');
  const values = booking
    ? { checkin: context.start, checkout: context.end, group_adults: context.travellers, no_rooms: 1, selected_currency: context.currency }
    : { check_in: context.start, check_out: context.end, adults: context.travellers };
  Object.entries(values).forEach(([key, value]) => { if (value && !result.searchParams.has(key)) result.searchParams.set(key, String(value)); });
  return result;
}

export async function POST(request: Request) {
  try {
    const { url: rawUrl, start, end, travellers, currency } = await request.json() as { url?: string; start?: string; end?: string; travellers?: number; currency?: string };
    if (!rawUrl) return Response.json({ error: 'Add a Booking.com or Airbnb URL.' }, { status: 400 });
    const url = listingUrl(new URL(rawUrl), { start, end, travellers, currency });
    if (url.protocol !== 'https:' || !ALLOWED_HOST.test(url.hostname)) return Response.json({ error: 'Only Airbnb and Booking.com links are supported.' }, { status: 400 });

    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; RoamwisePreview/1.0)', 'accept-language': 'en-GB,en;q=0.8' },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`Listing returned ${response.status}`);
    const html = await response.text();
    if (html.length > 5_000_000) throw new Error('Listing page was too large');

    const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => { try { return JSON.parse(match[1]); } catch { return null; } });
    const lodging = findLodging(jsonLd);
    const imageCandidates: string[] = [];
    collectImages(lodging?.image, imageCandidates);
    metas(html, 'og:image').forEach((item) => imageCandidates.push(item));
    metas(html, 'twitter:image').forEach((item) => imageCandidates.push(item));
    for (const match of html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|data-highres)=["']([^"']+)["']/gi)) imageCandidates.push(match[1]);
    const images = [...new Set(imageCandidates.map(decode).filter((item): item is string => Boolean(item)).map((item) => {
      try { return new URL(item, url).toString(); } catch { return ''; }
    }).filter((item) => /^https:\/\//i.test(item) && !/(logo|sprite|avatar|icon|badge)/i.test(item)))].slice(0, 12);
    const geo = lodging?.geo as Record<string, unknown> | undefined;
    const offer = findOffer(lodging?.offers) ?? findOffer(jsonLd);
    const title = String(lodging?.name ?? decode(meta(html, 'og:title')) ?? url.hostname);
    const description = String(lodging?.description ?? decode(meta(html, 'og:description')) ?? 'Imported listing');
    const address = textAddress(lodging?.address);
    const coordinates = geo && Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude))
      ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : undefined;
    const price = Number(offer?.price ?? offer?.lowPrice ?? meta(html, 'product:price:amount'));
    const priceCurrency = String(offer?.priceCurrency ?? meta(html, 'product:price:currency') ?? currency ?? '').toUpperCase();

    if (!lodging && !meta(html, 'og:title') && !meta(html, 'og:image')) throw new Error('Provider returned a bot-check page');

    return Response.json({
      title: decode(title), description: decode(description), address,
      image: images[0], images,
      coordinates, price: Number.isFinite(price) && (!currency || !priceCurrency || priceCurrency === currency.toUpperCase()) ? price : undefined,
      price_currency: priceCurrency || undefined,
      url: url.toString(), provider: url.hostname.includes('airbnb') ? 'Airbnb' : 'Booking.com',
    });
  } catch (error) {
    return Response.json({ error: 'The listing blocked automatic loading. It has been added as an editable link instead.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 422 });
  }
}
