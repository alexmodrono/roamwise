'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BedDouble, Landmark, Map as MapIcon, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Coordinates, TripDocument } from '@/lib/trip-schema';

type MapPoint = { id: string; label: string; detail?: string; kind: 'stay' | 'activity' | 'highlight'; coordinates: Coordinates; selected?: boolean };
type Highlight = { id: string; name: string; category: string; coordinates: Coordinates };
type Layers = { stays: boolean; activities: boolean; highlights: boolean };

export function TripMap({ trip, compact = false }: { trip: TripDocument; compact?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<'open' | 'apple'>('open');
  const [appleToken, setAppleToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [mapError, setMapError] = useState('');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [placeCenter, setPlaceCenter] = useState<Coordinates | undefined>(trip.trip.destination.coordinates);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [layers, setLayers] = useState<Layers>({ stays: true, activities: true, highlights: true });

  useEffect(() => { setAppleToken(localStorage.getItem('roamwise-mapkit-token') ?? ''); }, []);

  useEffect(() => {
    let disposed = false;
    setPlacesLoading(true);
    fetch('/api/places', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ destination: trip.trip.destination.name, coordinates: trip.trip.destination.coordinates }) })
      .then(async (response) => response.ok ? response.json() as Promise<{ places?: Highlight[]; center?: Coordinates }> : { places: [] as Highlight[] })
      .then((data) => { if (!disposed) { setHighlights(data.places ?? []); setPlaceCenter(data.center ?? trip.trip.destination.coordinates); } })
      .catch(() => { if (!disposed) setHighlights([]); })
      .finally(() => { if (!disposed) setPlacesLoading(false); });
    return () => { disposed = true; };
  }, [trip.trip.destination.name, trip.trip.destination.coordinates]);

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = [];
    if (layers.stays) trip.stays.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, detail: item.type, kind: 'stay', coordinates: item.coordinates, selected: trip.selected.stay === item.id }));
    if (layers.activities) trip.activities.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, detail: item.address, kind: 'activity', coordinates: item.coordinates, selected: trip.selected.activities.includes(item.id) }));
    if (layers.highlights) highlights.forEach((item) => result.push({ id: item.id, label: item.name, detail: item.category, kind: 'highlight', coordinates: item.coordinates }));
    return result;
  }, [trip, highlights, layers]);

  useEffect(() => {
    if (!mapRef.current || provider !== 'open') return;
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;
      map = L.map(mapRef.current, { zoomControl: !compact, attributionControl: !compact });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      points.forEach((point) => {
        const color = point.kind === 'stay' ? '#2563eb' : point.kind === 'activity' ? '#d97706' : '#171717';
        const tooltip = document.createElement('div');
        const name = document.createElement('strong'); name.textContent = point.label; tooltip.appendChild(name);
        if (point.detail) { const detail = document.createElement('div'); detail.textContent = point.detail; tooltip.appendChild(detail); }
        L.circleMarker([point.coordinates.lat, point.coordinates.lng], { radius: point.selected ? 9 : 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(tooltip, { direction: 'top' }).addTo(map!);
      });
      if (points.length) map.fitBounds(points.map((point) => [point.coordinates.lat, point.coordinates.lng]), { padding: [36, 36], maxZoom: 13 });
      else if (placeCenter) map.setView([placeCenter.lat, placeCenter.lng], 13);
      else map.setView([55.9533, -3.1883], 12);
    }).catch(() => setMapError('Map tiles could not be loaded.'));
    return () => { disposed = true; map?.remove(); };
  }, [points, provider, compact, placeCenter]);

  useEffect(() => {
    if (!mapRef.current || provider !== 'apple' || !appleToken) return;
    let disposed = false;
    let appleMap: { destroy?: () => void } | undefined;
    setMapError('');
    const start = async () => {
      const mapkit = (window as unknown as { mapkit?: any }).mapkit;
      if (!mapkit || disposed || !mapRef.current) return;
      try {
        const libraries = ['map', 'annotations', 'overlays'];
        await mapkit.init({ authorizationCallback: (done: (token: string) => void) => done(appleToken), language: 'en', libraries });
        const loaded = typeof mapkit.load === 'function' ? await mapkit.load(libraries) : mapkit;
        const api = loaded ?? mapkit;
        if (!api.Map || !api.MarkerAnnotation || !api.PolylineOverlay) throw new Error('Required MapKit libraries did not load');
        const map = new api.Map(mapRef.current, { showsZoomControl: !compact, showsMapTypeControl: !compact });
        appleMap = map;
        const items: any[] = [];
        points.forEach((point) => {
          const coordinate = new api.Coordinate(point.coordinates.lat, point.coordinates.lng);
          const annotation = new api.MarkerAnnotation(coordinate, {
            title: point.label,
            subtitle: point.detail,
            color: point.kind === 'stay' ? '#2563eb' : point.kind === 'activity' ? '#d97706' : '#171717',
            glyphText: point.kind === 'stay' ? '●' : point.kind === 'activity' ? '•' : '★',
          });
          map.addAnnotation(annotation); items.push(annotation);
        });
        if (items.length) map.showItems(items, { animate: true, padding: new api.Padding(50, 50, 50, 50) });
        else if (placeCenter) map.region = new api.CoordinateRegion(new api.Coordinate(placeCenter.lat, placeCenter.lng), new api.CoordinateSpan(0.08, 0.08));
      } catch (error) { setMapError(`Apple Maps could not start: ${error instanceof Error ? error.message : 'check the token and allowed domain'}`); }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-roamwise-mapkit]');
    if ((window as unknown as { mapkit?: unknown }).mapkit) start();
    else if (existing) existing.addEventListener('load', start, { once: true });
    else {
      const script = document.createElement('script');
      script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
      script.crossOrigin = 'anonymous'; script.dataset.roamwiseMapkit = 'true'; script.async = true;
      script.dataset.libraries = 'map,annotations,overlays';
      script.addEventListener('load', start, { once: true }); script.addEventListener('error', () => setMapError('Apple MapKit could not be loaded.'), { once: true });
      document.head.appendChild(script);
    }
    return () => { disposed = true; appleMap?.destroy?.(); };
  }, [provider, appleToken, points, compact, placeCenter]);

  function useApple() {
    if (!appleToken) { setShowToken(true); return; }
    setProvider('apple');
  }

  function saveToken() {
    const token = appleToken.trim();
    if (!token) return;
    localStorage.setItem('roamwise-mapkit-token', token);
    setShowToken(false); setProvider('apple');
  }

  function toggleLayer(layer: keyof Layers) { setLayers((current) => ({ ...current, [layer]: !current[layer] })); }

  return <div className="flex h-full min-h-[360px] flex-col bg-[#ececec]">
    {!compact && <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium"><MapIcon size={16} /> Trip map</div>
      <div className="flex gap-1 rounded-lg bg-[#f2f2f2] p-1">
        <button onClick={() => setProvider('open')} className={`rounded-md px-2.5 py-1 text-xs ${provider === 'open' ? 'bg-white shadow-sm' : 'text-black/55'}`}>Open map</button>
        <button onClick={useApple} className={`rounded-md px-2.5 py-1 text-xs ${provider === 'apple' ? 'bg-white shadow-sm' : 'text-black/55'}`}>Apple Maps</button>
        <button onClick={() => setShowToken((v) => !v)} className="rounded-md p-1 text-black/45 hover:bg-white" aria-label="Apple Maps settings"><Settings2 size={14} /></button>
      </div>
    </div>}
    {!compact && <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-white px-3 py-2">
      <LayerButton active={layers.stays} onClick={() => toggleLayer('stays')} icon={<BedDouble />} label="Stays" count={trip.stays.filter((item) => item.coordinates).length} />
      <LayerButton active={layers.activities} onClick={() => toggleLayer('activities')} icon={<Sparkles />} label="Activities" count={trip.activities.filter((item) => item.coordinates).length} />
      <LayerButton active={layers.highlights} onClick={() => toggleLayer('highlights')} icon={<Landmark />} label={placesLoading ? 'Finding highlights…' : 'Highlights'} count={highlights.length} />
    </div>}
    {showToken && !compact && <div className="border-b bg-white p-3"><p className="mb-2 text-xs text-black/55">Paste an origin-restricted MapKit JS token. It stays in this browser.</p><div className="flex gap-2"><Input value={appleToken} onChange={(e) => setAppleToken(e.target.value)} placeholder="eyJ…" className="h-8 font-mono text-xs" /><Button onClick={saveToken} size="sm">Use token</Button></div></div>}
    {provider === 'apple' && !appleToken ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-black/50">Add your MapKit JS token to enable Apple Maps.</div> : <div ref={mapRef} className="min-h-[360px] flex-1" />}
    {mapError && <p className="border-t bg-white px-4 py-2 text-xs text-red-600">{mapError}</p>}
    {!compact && <div className="flex flex-wrap gap-4 border-t border-black/10 bg-white px-4 py-2 text-[11px] text-black/50"><span><i className="mr-1 inline-block size-2 rounded-full bg-blue-600" /> Stays</span><span><i className="mr-1 inline-block size-2 rounded-full bg-amber-600" /> Activities</span><span><i className="mr-1 inline-block size-2 rounded-full bg-black" /> Highlights</span></div>}
  </div>;
}

function LayerButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition [&_svg]:size-3.5 ${active ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/45 hover:border-black/25'}`}>{icon}<span>{label}</span><span className={active ? 'text-white/55' : 'text-black/30'}>{count}</span></button>;
}
