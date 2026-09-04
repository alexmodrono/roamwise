'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Coordinates, TripDocument } from '@/lib/trip-schema';

type MapPoint = { id: string; label: string; kind: 'airport' | 'stay' | 'activity'; coordinates: Coordinates; selected?: boolean };

export function TripMap({ trip, compact = false }: { trip: TripDocument; compact?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<'open' | 'apple'>('open');
  const [appleToken, setAppleToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => { setAppleToken(localStorage.getItem('roamwise-mapkit-token') ?? ''); }, []);

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = [];
    const { origin, destination } = trip.trip;
    if (origin.coordinates) result.push({ id: 'origin', label: origin.code ?? origin.name, kind: 'airport', coordinates: origin.coordinates });
    if (destination.coordinates) result.push({ id: 'destination', label: destination.code ?? destination.name, kind: 'airport', coordinates: destination.coordinates });
    trip.stays.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, kind: 'stay', coordinates: item.coordinates, selected: trip.selected.stay === item.id }));
    trip.activities.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, kind: 'activity', coordinates: item.coordinates, selected: trip.selected.activities.includes(item.id) }));
    return result;
  }, [trip]);

  useEffect(() => {
    if (!mapRef.current || provider !== 'open') return;
    let disposed = false;
    let map: import('leaflet').Map | undefined;
    import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;
      map = L.map(mapRef.current, { zoomControl: !compact, attributionControl: !compact });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      points.forEach((point) => {
        const color = point.kind === 'airport' ? '#171717' : point.kind === 'stay' ? '#2563eb' : '#d97706';
        L.circleMarker([point.coordinates.lat, point.coordinates.lng], { radius: point.selected ? 9 : 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(point.label, { direction: 'top' }).addTo(map!);
      });
      const origin = trip.trip.origin.coordinates;
      const destination = trip.trip.destination.coordinates;
      if (origin && destination) L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], { color: '#171717', weight: 2, dashArray: '7 7', opacity: 0.75 }).addTo(map);
      if (points.length) map.fitBounds(points.map((point) => [point.coordinates.lat, point.coordinates.lng]), { padding: [36, 36], maxZoom: 13 });
      else map.setView([55.9533, -3.1883], 12);
    }).catch(() => setMapError('Map tiles could not be loaded.'));
    return () => { disposed = true; map?.remove(); };
  }, [points, provider, compact, trip.trip.origin.coordinates, trip.trip.destination.coordinates]);

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
            color: point.kind === 'airport' ? '#171717' : point.kind === 'stay' ? '#2563eb' : '#d97706',
            glyphText: point.kind === 'airport' ? '✈' : point.kind === 'stay' ? '●' : '•',
          });
          map.addAnnotation(annotation); items.push(annotation);
        });
        const origin = trip.trip.origin.coordinates;
        const destination = trip.trip.destination.coordinates;
        if (origin && destination) {
          const overlay = new api.PolylineOverlay([new api.Coordinate(origin.lat, origin.lng), new api.Coordinate(destination.lat, destination.lng)], { style: new api.Style({ strokeColor: '#171717', lineWidth: 2, lineDash: [7, 7] }) });
          map.addOverlay(overlay); items.push(overlay);
        }
        if (items.length) map.showItems(items, { animate: true, padding: new api.Padding(50, 50, 50, 50) });
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
  }, [provider, appleToken, points, compact, trip.trip.origin.coordinates, trip.trip.destination.coordinates]);

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

  return <div className="flex h-full min-h-[360px] flex-col bg-[#ececec]">
    {!compact && <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium"><MapIcon size={16} /> Trip map</div>
      <div className="flex gap-1 rounded-lg bg-[#f2f2f2] p-1">
        <button onClick={() => setProvider('open')} className={`rounded-md px-2.5 py-1 text-xs ${provider === 'open' ? 'bg-white shadow-sm' : 'text-black/55'}`}>Open map</button>
        <button onClick={useApple} className={`rounded-md px-2.5 py-1 text-xs ${provider === 'apple' ? 'bg-white shadow-sm' : 'text-black/55'}`}>Apple Maps</button>
        <button onClick={() => setShowToken((v) => !v)} className="rounded-md p-1 text-black/45 hover:bg-white" aria-label="Apple Maps settings"><Settings2 size={14} /></button>
      </div>
    </div>}
    {showToken && !compact && <div className="border-b bg-white p-3"><p className="mb-2 text-xs text-black/55">Paste an origin-restricted MapKit JS token. It stays in this browser.</p><div className="flex gap-2"><Input value={appleToken} onChange={(e) => setAppleToken(e.target.value)} placeholder="eyJ…" className="h-8 font-mono text-xs" /><Button onClick={saveToken} size="sm">Use token</Button></div></div>}
    {provider === 'apple' && !appleToken ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-black/50">Add your MapKit JS token to enable Apple Maps.</div> : <div ref={mapRef} className="min-h-[360px] flex-1" />}
    {mapError && <p className="border-t bg-white px-4 py-2 text-xs text-red-600">{mapError}</p>}
    {!compact && <div className="flex flex-wrap gap-4 border-t border-black/10 bg-white px-4 py-2 text-[11px] text-black/50"><span><i className="mr-1 inline-block size-2 rounded-full bg-black" /> Flight</span><span><i className="mr-1 inline-block size-2 rounded-full bg-blue-600" /> Stays</span><span><i className="mr-1 inline-block size-2 rounded-full bg-amber-600" /> Activities</span></div>}
  </div>;
}
