const ALLOWED_HOST = /(^|\.)(airbnb\.[a-z.]+|booking\.com)$/i;

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  return patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);
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

export async function POST(request: Request) {
  try {
    const { url: rawUrl } = await request.json() as { url?: string };
    if (!rawUrl) return Response.json({ error: 'Add a Booking.com or Airbnb URL.' }, { status: 400 });
    const url = new URL(rawUrl);
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
    const imageValue = lodging?.image;
    const image = typeof imageValue === 'string' ? imageValue : Array.isArray(imageValue) ? String(imageValue[0] ?? '') : meta(html, 'og:image');
    const geo = lodging?.geo as Record<string, unknown> | undefined;
    const offer = lodging?.offers as Record<string, unknown> | undefined;
    const title = String(lodging?.name ?? decode(meta(html, 'og:title')) ?? url.hostname);
    const description = String(lodging?.description ?? decode(meta(html, 'og:description')) ?? 'Imported listing');
    const address = textAddress(lodging?.address);
    const coordinates = geo && Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude))
      ? { lat: Number(geo.latitude), lng: Number(geo.longitude) } : undefined;
    const price = Number(offer?.price);

    if (!lodging && !meta(html, 'og:title') && !meta(html, 'og:image')) throw new Error('Provider returned a bot-check page');

    return Response.json({
      title: decode(title), description: decode(description), address,
      image: image ? new URL(image, url).toString() : undefined,
      coordinates, price: Number.isFinite(price) ? price : undefined,
      url: url.toString(), provider: url.hostname.includes('airbnb') ? 'Airbnb' : 'Booking.com',
    });
  } catch (error) {
    return Response.json({ error: 'The listing blocked automatic loading. It has been added as an editable link instead.', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 422 });
  }
}
