'use client';

import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Landmark, Map as MapIcon, Sparkles } from 'lucide-react';
import { MapCanvas, type MapPoint } from '@/components/map-canvas';
import type { Coordinates, TripDocument } from '@/packages/core/trip-schema';

type Highlight = { id: string; name: string; category: string; coordinates: Coordinates };
type Layers = { stays: boolean; activities: boolean; highlights: boolean };
export function TripMap({ trip, compact = false, enrichment = true }: { trip: TripDocument; compact?: boolean; enrichment?: boolean }) {
  const [discover, setDiscover] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [placeCenter, setPlaceCenter] = useState<Coordinates | undefined>(trip.trip.destination.coordinates);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [layers, setLayers] = useState<Layers>({ stays: true, activities: true, highlights: true });
  useEffect(() => {
    const destName = trip.trip.destination.name;
    const destLat = trip.trip.destination.coordinates?.lat;
    const destLng = trip.trip.destination.coordinates?.lng;
    const destCoordinates = destLat !== undefined && destLng !== undefined ? { lat: destLat, lng: destLng } : undefined;
    if (!enrichment || !discover || (!destName.trim() && !destCoordinates)) {
      setHighlights([]); setPlaceCenter(destCoordinates); setPlacesLoading(false);
      return;
    }
    let disposed = false;
    setPlacesLoading(true);
    fetch('/api/places', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ destination: destName, coordinates: destCoordinates }) })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json() as { places?: Highlight[]; center?: Coordinates };
          return { places: data.places ?? [], center: data.center };
        }
        return { places: [] as Highlight[], center: undefined as Coordinates | undefined };
      })
      .then((data) => { if (!disposed) { setHighlights(data.places); setPlaceCenter(data.center ?? destCoordinates); } })
      .catch(() => { if (!disposed) setHighlights([]); })
      .finally(() => { if (!disposed) setPlacesLoading(false); });
    return () => { disposed = true; };
  }, [enrichment, discover, trip.trip.destination.name, trip.trip.destination.coordinates?.lat, trip.trip.destination.coordinates?.lng]);

  const points = useMemo<MapPoint[]>(() => {
    const result: MapPoint[] = [];
    if (layers.stays) trip.stays.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, detail: item.type, kind: 'stay', coordinates: item.coordinates, selected: trip.selected.stay === item.id }));
    if (layers.activities) trip.activities.forEach((item) => item.coordinates && result.push({ id: item.id, label: item.name, detail: item.address, kind: 'activity', coordinates: item.coordinates, selected: trip.selected.activities.includes(item.id) }));
    if (layers.highlights) highlights.forEach((item) => result.push({ id: item.id, label: item.name, detail: item.category, kind: 'highlight', coordinates: item.coordinates }));
    return result;
  }, [trip.stays, trip.activities, trip.selected, highlights, layers]);

  function toggleLayer(layer: keyof Layers) { setLayers((current) => ({ ...current, [layer]: !current[layer] })); }

  const showEmptyState = !points.length && !placeCenter;

  return <div className="flex h-full min-h-[360px] flex-col bg-[#ececec]">
    {!compact && <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium"><MapIcon size={16} /> Trip map</div>
      <span className="text-xs text-black/55">OpenFreeMap · Orchard</span>
    </div>}
    {!compact && <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-white px-3 py-2">
      <LayerButton active={layers.stays} onClick={() => toggleLayer('stays')} icon={<BedDouble />} label="Stays" count={trip.stays.filter((item) => item.coordinates).length} />
      <LayerButton active={layers.activities} onClick={() => toggleLayer('activities')} icon={<Sparkles />} label="Activities" count={trip.activities.filter((item) => item.coordinates).length} />
      {enrichment && !discover ? <button onClick={() => setDiscover(true)} className="shrink-0 rounded-full border px-3 py-1.5 text-xs">Find nearby highlights</button> : <LayerButton active={layers.highlights} onClick={() => toggleLayer('highlights')} icon={<Landmark />} label={placesLoading ? 'Finding highlights…' : 'Highlights'} count={highlights.length} />}
    </div>}
    <div className="relative min-h-[360px] flex-1">
      <div className="absolute inset-0"><MapCanvas points={points} center={placeCenter} compact={compact} /></div>
      {showEmptyState && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#ececec] p-8 text-center text-sm text-black/45">Add locations to your trip — or a destination in trip details — to see them here.</div>}
    </div>
    {!compact && <div className="flex flex-wrap gap-4 border-t border-black/10 bg-white px-4 py-2 text-[11px] text-black/50"><span><i className="mr-1 inline-block size-2 rounded-full bg-blue-600" /> Stays</span><span><i className="mr-1 inline-block size-2 rounded-full bg-amber-600" /> Activities</span><span><i className="mr-1 inline-block size-2 rounded-full bg-black" /> Highlights</span></div>}
  </div>;
}

function LayerButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition [&_svg]:size-3.5 ${active ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black/45 hover:border-black/25'}`}>{icon}<span>{label}</span><span className={active ? 'text-white/55' : 'text-black/30'}>{count}</span></button>;
}
