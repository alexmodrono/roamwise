'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bath, BedDouble, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Code2, Download, ExternalLink, Expand, FileText,
  Images, Link2, LoaderCircle, MapPin, Pencil, Plane, Plus, Sparkles, Star, Trash2, Upload, Users, X, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TripMap } from '@/components/trip-map';
import { DEFAULT_TRIP, parseTrip, stringifyTrip, type Activity, type FlightLeg, type Stay, type TripDocument } from '@/lib/trip-schema';

type AddKind = 'flight' | 'stay' | 'activity';
type Draft = { name: string; detail: string; address: string; price: string; image: string; url: string; lat: string; lng: string; from: string; to: string; depart: string; arrive: string; date: string; time: string; notes: string; neighbourhood: string; amenities: string; pros: string; cons: string; checkIn: string; checkOut: string; cancellationPolicy: string; bedrooms: string; bathrooms: string; size: string };
type DeleteTarget = { kind: AddKind; id: string; name: string; direction?: 'outbound' | 'return' };
const emptyDraft: Draft = { name: '', detail: '', address: '', price: '', image: '', url: '', lat: '', lng: '', from: '', to: '', depart: '', arrive: '', date: '', time: '', notes: '', neighbourhood: '', amenities: '', pros: '', cons: '', checkIn: '', checkOut: '', cancellationPolicy: '', bedrooms: '', bathrooms: '', size: '' };

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}
function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function time(value?: string) { return value?.split('T')[1]?.slice(0, 5) ?? '—'; }
function safeId(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `item-${Date.now()}`; }
function splitList(value: string) { return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean); }

export default function Home() {
  const [trip, setTrip] = useState<TripDocument>(DEFAULT_TRIP);
  const [source, setSource] = useState(() => stringifyTrip(DEFAULT_TRIP));
  const [view, setView] = useState<'plan' | 'source'>('plan');
  const [sourceError, setSourceError] = useState('');
  const [link, setLink] = useState('');
  const [linkState, setLinkState] = useState<'idle' | 'loading' | 'done' | 'fallback'>('idle');
  const [linkMessage, setLinkMessage] = useState('');
  const [stayState, setStayState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [flightDirection, setFlightDirection] = useState<'outbound' | 'return'>('outbound');
  const [flightState, setFlightState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [viewingStayId, setViewingStayId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [finalOpen, setFinalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('roamwise-trip-v2');
    let base = DEFAULT_TRIP;
    if (stored) { try { base = parseTrip(stored); setTrip(base); setSource(stringifyTrip(base)); } catch { /* Keep the bundled example. */ } }
    void refreshStays(base, false);
  }, []);

  function commit(next: TripDocument) {
    setTrip(next);
    const yaml = stringifyTrip(next);
    setSource(yaml);
    localStorage.setItem('roamwise-trip-v2', yaml);
  }

  const selectedOutbound = trip.flights.outbound.find((item) => item.id === trip.selected.outbound_flight);
  const selectedReturn = trip.flights.return.find((item) => item.id === trip.selected.return_flight);
  const selectedStay = trip.stays.find((item) => item.id === trip.selected.stay);
  const viewingStay = trip.stays.find((item) => item.id === viewingStayId);
  const selectedActivities = trip.activities.filter((item) => trip.selected.activities.includes(item.id));
  const total = ((selectedOutbound?.price_per_person ?? 0) + (selectedReturn?.price_per_person ?? 0)) * trip.trip.travellers + (selectedStay?.price_total ?? 0) + selectedActivities.reduce((sum, item) => sum + item.price_total, 0);
  const perPerson = total / Math.max(1, trip.trip.travellers);

  function applySource() {
    try { const parsed = parseTrip(source); commit(parsed); setSourceError(''); setView('plan'); }
    catch (error) { setSourceError(error instanceof Error ? error.message : 'Invalid YAML'); }
  }

  async function readTripFile(file?: File) {
    if (!file) return;
    try { const parsed = parseTrip(await file.text()); commit(parsed); setSourceError(''); setView('plan'); }
    catch (error) { setSourceError(error instanceof Error ? error.message : 'Could not read this trip file'); setView('source'); }
  }

  function downloadTrip() {
    const blob = new Blob([stringifyTrip(trip)], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${safeId(trip.trip.title)}.trip.yaml`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function importListing() {
    if (!link.trim()) return;
    setLinkState('loading'); setLinkMessage('');
    let data: Record<string, unknown> = {};
    try {
      const response = await fetch('/api/unfurl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: link.trim(), start: trip.trip.dates.start, end: trip.trip.dates.end, travellers: trip.trip.travellers, currency: trip.trip.currency }) });
      data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error ?? 'Import failed'));
      setLinkState('done');
      const photoCount = Array.isArray(data.images) ? data.images.length : data.image ? 1 : 0;
      const loaded = [photoCount ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : '', Number(data.price) ? 'live price' : '', data.address ? 'location' : ''].filter(Boolean);
      setLinkMessage(loaded.length ? `Loaded ${loaded.join(', ')}. Check the details before deciding.` : 'Listing added. Complete any details the provider did not expose.');
    } catch { setLinkState('fallback'); setLinkMessage('The provider blocked its listing details, so the link was added as an editable entry.'); }
    const host = (() => { try { return new URL(link).hostname.replace('www.', ''); } catch { return 'Imported stay'; } })();
    const coordinate = data.coordinates as { lat?: number; lng?: number } | undefined;
    const stay: Stay = {
      id: `${safeId(String(data.title ?? host))}-${Date.now()}`,
      name: String(data.title ?? `Stay from ${host}`),
      type: String(data.description ?? 'Imported listing — add any missing details'),
      address: data.address ? String(data.address) : trip.trip.destination.name,
      coordinates: coordinate?.lat && coordinate?.lng ? { lat: coordinate.lat, lng: coordinate.lng } : undefined,
      price_total: Number(data.price) || 0,
      image: data.image ? String(data.image) : undefined,
      images: Array.isArray(data.images) ? data.images.map(String) : undefined,
      amenities: Array.isArray(data.amenities) ? data.amenities.map(String) : undefined,
      check_in: data.check_in ? String(data.check_in) : undefined,
      check_out: data.check_out ? String(data.check_out) : undefined,
      bedrooms: Number(data.bedrooms) || undefined,
      bathrooms: Number(data.bathrooms) || undefined,
      size_m2: Number(data.size_m2) || undefined,
      url: link.trim(),
    };
    commit({ ...trip, stays: [...trip.stays, stay], selected: { ...trip.selected, stay: stay.id } });
    if (!data.title || (!data.image && !data.address)) {
      setEditingId(stay.id);
      setDraft({ ...emptyDraft, name: stay.name, detail: stay.type ?? '', address: stay.address ?? '', price: '', image: '', url: stay.url ?? '' });
      setAddKind('stay');
    }
    setLink(''); setTimeout(() => setLinkState('idle'), 2800);
  }

  function addEntry() {
    if (!addKind || !draft.name.trim()) return;
    const coordinates = Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng)) && draft.lat && draft.lng ? { lat: Number(draft.lat), lng: Number(draft.lng) } : undefined;
    const id = `${safeId(draft.name)}-${Date.now()}`;
    if (addKind === 'stay') {
      const item: Stay = { id, name: draft.name, type: draft.detail, address: draft.address, price_total: Number(draft.price) || 0, image: draft.image || undefined, url: draft.url || undefined, coordinates, notes: draft.notes || undefined, neighbourhood: draft.neighbourhood || undefined, amenities: splitList(draft.amenities), pros: splitList(draft.pros), cons: splitList(draft.cons), check_in: draft.checkIn || undefined, check_out: draft.checkOut || undefined, cancellation_policy: draft.cancellationPolicy || undefined, bedrooms: Number(draft.bedrooms) || undefined, bathrooms: Number(draft.bathrooms) || undefined, size_m2: Number(draft.size) || undefined };
      if (editingId) commit({ ...trip, stays: trip.stays.map((existing) => existing.id === editingId ? { ...existing, ...item, id: editingId } : existing), selected: { ...trip.selected, stay: editingId } });
      else commit({ ...trip, stays: [...trip.stays, item], selected: { ...trip.selected, stay: id } });
    } else if (addKind === 'activity') {
      const item: Activity = { id, name: draft.name, date: draft.date || undefined, time: draft.time || undefined, address: draft.address, price_total: Number(draft.price) || 0, image: draft.image || undefined, url: draft.url || undefined, coordinates };
      if (editingId) commit({ ...trip, activities: trip.activities.map((existing) => existing.id === editingId ? { ...existing, ...item, id: editingId } : existing) });
      else commit({ ...trip, activities: [...trip.activities, item], selected: { ...trip.selected, activities: [...trip.selected.activities, id] } });
    } else {
      const origin = trip.trip.origin.code ?? trip.trip.origin.name; const destination = trip.trip.destination.code ?? trip.trip.destination.name;
      const isOutbound = flightDirection === 'outbound';
      const item: FlightLeg = { id, airline: draft.name, flight_number: draft.detail || undefined, price_per_person: Number(draft.price) || 0, url: draft.url || undefined, from: draft.from || (isOutbound ? origin : destination), to: draft.to || (isOutbound ? destination : origin), depart: draft.depart || `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00`, arrive: draft.arrive || `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00` };
      if (editingId) commit({ ...trip, flights: { ...trip.flights, [flightDirection]: trip.flights[flightDirection].map((existing) => existing.id === editingId ? { ...existing, ...item, id: editingId, live: false } : existing) } });
      else commit({ ...trip, flights: { ...trip.flights, [flightDirection]: [...trip.flights[flightDirection], item] }, selected: { ...trip.selected, [isOutbound ? 'outbound_flight' : 'return_flight']: id } });
    }
    setDraft(emptyDraft); setEditingId(null); setAddKind(null);
  }

  function toggleActivity(id: string, checked: boolean) {
    const activities = checked ? [...trip.selected.activities, id] : trip.selected.activities.filter((item) => item !== id);
    commit({ ...trip, selected: { ...trip.selected, activities: [...new Set(activities)] } });
  }

  function editStay(item: Stay) {
    setViewingStayId(null); setEditingId(item.id); setDraft({ ...emptyDraft, name: item.name, detail: item.type ?? '', address: item.address ?? '', price: String(item.price_total), image: item.image ?? '', url: item.url ?? '', lat: item.coordinates ? String(item.coordinates.lat) : '', lng: item.coordinates ? String(item.coordinates.lng) : '', notes: item.notes ?? '', neighbourhood: item.neighbourhood ?? '', amenities: item.amenities?.join('\n') ?? '', pros: item.pros?.join('\n') ?? '', cons: item.cons?.join('\n') ?? '', checkIn: item.check_in ?? '', checkOut: item.check_out ?? '', cancellationPolicy: item.cancellation_policy ?? '', bedrooms: item.bedrooms ? String(item.bedrooms) : '', bathrooms: item.bathrooms ? String(item.bathrooms) : '', size: item.size_m2 ? String(item.size_m2) : '' }); setAddKind('stay');
  }

  function editActivity(item: Activity) {
    setEditingId(item.id); setDraft({ ...emptyDraft, name: item.name, address: item.address ?? '', price: String(item.price_total), image: item.image ?? '', url: item.url ?? '', lat: item.coordinates ? String(item.coordinates.lat) : '', lng: item.coordinates ? String(item.coordinates.lng) : '', date: item.date ?? '', time: item.time ?? '' }); setAddKind('activity');
  }

  function editFlight(item: FlightLeg, direction: 'outbound' | 'return') {
    setFlightDirection(direction); setEditingId(item.id); setDraft({ ...emptyDraft, name: item.airline, detail: item.flight_number ?? '', price: String(item.price_per_person), url: item.url ?? '', from: item.from, to: item.to, depart: item.depart.slice(0, 16), arrive: item.arrive.slice(0, 16) }); setAddKind('flight');
  }

  function deleteEntry() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'stay') {
      const stays = trip.stays.filter((item) => item.id !== deleteTarget.id);
      commit({ ...trip, stays, selected: { ...trip.selected, stay: trip.selected.stay === deleteTarget.id ? stays[0]?.id : trip.selected.stay } });
      if (viewingStayId === deleteTarget.id) setViewingStayId(null);
    } else if (deleteTarget.kind === 'activity') {
      commit({ ...trip, activities: trip.activities.filter((item) => item.id !== deleteTarget.id), selected: { ...trip.selected, activities: trip.selected.activities.filter((id) => id !== deleteTarget.id) } });
    } else {
      const direction = deleteTarget.direction ?? 'outbound'; const remaining = trip.flights[direction].filter((item) => item.id !== deleteTarget.id); const selectionKey = direction === 'outbound' ? 'outbound_flight' : 'return_flight';
      commit({ ...trip, flights: { ...trip.flights, [direction]: remaining }, selected: { ...trip.selected, [selectionKey]: trip.selected[selectionKey] === deleteTarget.id ? remaining[0]?.id : trip.selected[selectionKey] } });
    }
    setDeleteTarget(null);
  }

  async function refreshFlights() {
    const origin = trip.trip.origin.code; const destination = trip.trip.destination.code;
    if (!origin || !destination) { setFlightState('error'); return; }
    setFlightState('loading');
    try {
      const response = await fetch('/api/flights', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin, destination, start: trip.trip.dates.start, end: trip.trip.dates.end, currency: trip.trip.currency }) });
      const data = await response.json() as TripDocument['flights'] & { error?: string };
      if (!response.ok) throw new Error(data.error);
      commit({ ...trip, flights: data, selected: { ...trip.selected, outbound_flight: data.outbound[0]?.id, return_flight: data.return[0]?.id } });
      setFlightState('done'); setTimeout(() => setFlightState('idle'), 2500);
    } catch { setFlightState('error'); }
  }

  async function refreshStays(base = trip, visible = true) {
    if (visible) setStayState('loading');
    const refreshed = await Promise.all(base.stays.map(async (stay) => {
      if (!stay.url) return stay;
      try {
        const response = await fetch('/api/unfurl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: stay.url, start: base.trip.dates.start, end: base.trip.dates.end, travellers: base.trip.travellers, currency: base.trip.currency }) });
        if (!response.ok) return stay;
        const data = await response.json() as Record<string, unknown>;
        const coordinate = data.coordinates as { lat?: number; lng?: number } | undefined;
        return { ...stay, name: data.title ? String(data.title) : stay.name, type: data.description ? String(data.description) : stay.type, address: data.address ? String(data.address) : stay.address, image: data.image ? String(data.image) : stay.image, images: Array.isArray(data.images) && data.images.length ? data.images.map(String) : stay.images, amenities: Array.isArray(data.amenities) && data.amenities.length ? data.amenities.map(String) : stay.amenities, check_in: data.check_in ? String(data.check_in) : stay.check_in, check_out: data.check_out ? String(data.check_out) : stay.check_out, bedrooms: Number(data.bedrooms) || stay.bedrooms, bathrooms: Number(data.bathrooms) || stay.bathrooms, size_m2: Number(data.size_m2) || stay.size_m2, coordinates: coordinate?.lat && coordinate?.lng ? { lat: coordinate.lat, lng: coordinate.lng } : stay.coordinates, price_total: Number(data.price) || stay.price_total };
      } catch { return stay; }
    }));
    const next = { ...base, stays: refreshed };
    setTrip(next); const yaml = stringifyTrip(next); setSource(yaml); localStorage.setItem('roamwise-trip-v2', yaml);
    if (visible) { setStayState('done'); setTimeout(() => setStayState('idle'), 2200); }
  }

  return <main onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void readTripFile(event.dataTransfer.files[0]); }} className={`min-h-screen bg-white text-[#171717] ${finalOpen ? 'final-mode' : ''}`}>
    {dragging && <div className="fixed inset-3 z-[100] grid place-items-center rounded-2xl border-2 border-dashed border-blue-600 bg-blue-50/95"><div className="text-center"><Upload className="mx-auto mb-3 text-blue-600" /><p className="font-semibold">Drop a .trip.yaml file</p></div></div>}
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5"><div className="grid size-8 place-items-center rounded-lg bg-black text-white"><MapPin size={16} /></div><span className="font-semibold tracking-tight">Roamwise</span><span className="hidden text-sm text-black/35 sm:inline">/ {trip.trip.title}</span></div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="mr-1 hidden rounded-lg bg-[#f1f1f1] p-1 sm:flex"><button onClick={() => setView('plan')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'plan' ? 'bg-white shadow-sm' : 'text-black/50'}`}>Plan</button><button onClick={() => setView('source')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'source' ? 'bg-white shadow-sm' : 'text-black/50'}`}><Code2 className="mr-1 inline size-3" /> YAML</button></div>
          <Button onClick={() => fileInput.current?.click()} variant="ghost" size="sm"><Upload /> <span className="hidden sm:inline">Load</span></Button><input ref={fileInput} type="file" accept=".yaml,.yml,text/yaml" className="hidden" onChange={(event) => void readTripFile(event.target.files?.[0])} />
          <Button onClick={downloadTrip} variant="ghost" size="sm"><Download /> <span className="hidden sm:inline">Save</span></Button>
          <Button onClick={() => setFinalOpen(true)} size="sm" className="bg-black text-white hover:bg-black/75"><FileText /> Final version</Button>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(520px,58%)_minmax(400px,42%)]">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:min-h-[calc(100vh-64px)] lg:border-r lg:px-8">
        {view === 'source' ? <SourceEditor source={source} setSource={setSource} error={sourceError} onApply={applySource} onDownload={downloadTrip} /> : <div className="mx-auto max-w-3xl space-y-8">
          <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-black/40">Trip plan</p><h1 className="text-3xl font-semibold tracking-[-0.04em]">{trip.trip.title}</h1><div className="mt-3 flex flex-wrap gap-4 text-sm text-black/50"><span className="flex items-center gap-1.5"><CalendarDays size={14} /> {shortDate(trip.trip.dates.start)}–{shortDate(trip.trip.dates.end)}</span><span className="flex items-center gap-1.5"><Users size={14} /> {trip.trip.travellers} travellers</span></div></div>
            <div className="text-left sm:text-right"><p className="text-3xl font-semibold tracking-[-0.04em]">{money(perPerson, trip.trip.currency)}</p><p className="text-xs text-black/45">per person · {money(total, trip.trip.currency)} total</p></div>
          </div>

          <section><div className="mb-3 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-base font-semibold"><Plane size={17} />Flights</h2><p className="mt-1 text-xs text-black/40">{trip.flights.provider ? `Live via ${trip.flights.provider}` : 'Trip source'}{trip.flights.updated_at ? ` · checked ${new Date(trip.flights.updated_at).toISOString().slice(11, 16)} UTC` : ''}</p></div><Button onClick={() => void refreshFlights()} disabled={flightState === 'loading'} variant="outline" size="sm">{flightState === 'loading' ? <LoaderCircle className="animate-spin" /> : <Download />} {flightState === 'done' ? 'Updated' : 'Refresh live'}</Button></div>{flightState === 'error' && <p className="mb-3 text-xs text-red-600">No live direct fares were returned. Existing options are unchanged.</p>}<div className="grid gap-4 md:grid-cols-2"><FlightGroup title="Outbound" direction="outbound" items={trip.flights.outbound} selected={trip.selected.outbound_flight} currency={trip.trip.currency} onSelect={(id) => commit({ ...trip, selected: { ...trip.selected, outbound_flight: id } })} onEdit={editFlight} onDelete={(item) => setDeleteTarget({ kind: 'flight', id: item.id, name: item.flight_number ?? item.airline, direction: 'outbound' })} onAdd={() => { setEditingId(null); setFlightDirection('outbound'); setDraft(emptyDraft); setAddKind('flight'); }} /><FlightGroup title="Return" direction="return" items={trip.flights.return} selected={trip.selected.return_flight} currency={trip.trip.currency} onSelect={(id) => commit({ ...trip, selected: { ...trip.selected, return_flight: id } })} onEdit={editFlight} onDelete={(item) => setDeleteTarget({ kind: 'flight', id: item.id, name: item.flight_number ?? item.airline, direction: 'return' })} onAdd={() => { setEditingId(null); setFlightDirection('return'); setDraft(emptyDraft); setAddKind('flight'); }} /></div></section>

          <Section title="Stays" icon={<BedDouble size={17} />} action={() => { setEditingId(null); setDraft(emptyDraft); setAddKind('stay'); }}>
            <div className="mb-3 flex gap-2"><Input value={link} onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void importListing()} placeholder="Paste an Airbnb or Booking.com link" className="h-10" /><Button onClick={() => void importListing()} disabled={linkState === 'loading'} className="h-10 bg-black text-white"><span className="hidden sm:inline">Import listing</span>{linkState === 'loading' ? <LoaderCircle className="animate-spin" /> : <Link2 />}</Button></div>
            <div className="mb-3 flex min-h-5 items-center justify-between gap-3">{linkState === 'done' ? <p className="text-xs text-green-700">{linkMessage}</p> : linkState === 'fallback' ? <p className="text-xs text-amber-700">{linkMessage}</p> : <span />}<button onClick={() => void refreshStays()} disabled={stayState === 'loading'} className="shrink-0 text-xs text-black/45 hover:text-black">{stayState === 'loading' ? 'Refreshing…' : stayState === 'done' ? 'Details refreshed' : 'Refresh stay details'}</button></div>
            <div className="grid gap-4 sm:grid-cols-2">{trip.stays.map((item) => <PreviewCard
              key={item.id}
              title={item.name}
              subtitle={item.type ?? 'Stay'}
              location={item.address ?? 'Location not added'}
              image={item.image}
              images={item.images}
              price={money(item.price_total, trip.trip.currency)}
              selected={trip.selected.stay === item.id}
              placeholder={<BedDouble />}
              details={[
                { icon: <BedDouble />, label: item.neighbourhood ?? item.type ?? 'Stay' },
                { icon: <Star />, label: item.rating ? `${item.rating} rating` : 'Not rated' },
              ]}
              onSelect={() => commit({ ...trip, selected: { ...trip.selected, stay: item.id } })}
              actions={<><EntryAction label="Details" onClick={() => setViewingStayId(item.id)} icon={<BookOpen />} /><EntryAction label="Edit" onClick={() => editStay(item)} icon={<Pencil />} /><EntryAction label="Delete" onClick={() => setDeleteTarget({ kind: 'stay', id: item.id, name: item.name })} icon={<Trash2 />} destructive />{item.url && <External item={item.url} label="Stay listing" />}</>}
            />)}</div>
          </Section>

          <Section title="Activities" icon={<Sparkles size={17} />} action={() => { setEditingId(null); setDraft(emptyDraft); setAddKind('activity'); }}>
            {trip.activities.length ? <div className="grid gap-4 sm:grid-cols-2">{trip.activities.map((item) => {
              const selected = trip.selected.activities.includes(item.id);
              return <PreviewCard
                key={item.id}
                title={item.name}
                subtitle="Activity"
                location={item.address ?? 'Location not added'}
                image={item.image}
                price={money(item.price_total, trip.trip.currency)}
                selected={selected}
                placeholder={<Sparkles />}
                details={[
                  { icon: <CalendarDays />, label: item.date ? shortDate(item.date) : 'Date not set' },
                  { icon: <Clock3 />, label: item.time ?? 'Time not set' },
                ]}
                onSelect={() => toggleActivity(item.id, !selected)}
                actions={<><EntryAction label="Edit" onClick={() => editActivity(item)} icon={<Pencil />} /><EntryAction label="Delete" onClick={() => setDeleteTarget({ kind: 'activity', id: item.id, name: item.name })} icon={<Trash2 />} destructive />{item.url && <External item={item.url} label="Activity listing" />}</>}
              />;
            })}</div> : <button onClick={() => { setDraft(emptyDraft); setAddKind('activity'); }} className="flex w-full items-center justify-between rounded-xl border border-dashed p-5 text-left text-sm text-black/45 hover:bg-[#fafafa]"><span>Add restaurants, tickets, tours or anything with a location.</span><Plus size={16} /></button>}
          </Section>

          <button onClick={() => setView('source')} className="flex w-full items-center justify-between rounded-xl bg-[#f4f4f4] p-4 text-left"><span><strong className="block text-sm">Portable trip source</strong><small className="mt-1 block text-black/45">Edit, download or ask a coding agent to generate roamwise/v1 YAML.</small></span><Code2 size={18} /></button>
        </div>}
      </section>
      <aside className="h-[56vh] overflow-hidden border-t lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:border-t-0"><TripMap trip={trip} /></aside>
    </div>

    <AddEntryDialog kind={addKind} editing={Boolean(editingId)} draft={draft} setDraft={setDraft} onClose={() => { setAddKind(null); setEditingId(null); }} onAdd={addEntry} />
    <StayDetailsDialog stay={viewingStay} currency={trip.trip.currency} onClose={() => setViewingStayId(null)} onEdit={editStay} />
    <DeleteEntryDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={deleteEntry} />
    {finalOpen && <FinalVersion trip={trip} total={total} perPerson={perPerson} outbound={selectedOutbound} returnFlight={selectedReturn} stay={selectedStay} activities={selectedActivities} onClose={() => setFinalOpen(false)} />}
  </main>;
}

function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action: () => void; children: React.ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2><Button onClick={action} variant="ghost" size="sm"><Plus /> Add</Button></div>{children}</section>;
}
function FlightGroup({ title, direction, items, selected, currency, onSelect, onEdit, onDelete, onAdd }: { title: string; direction: 'outbound' | 'return'; items: FlightLeg[]; selected?: string; currency: string; onSelect: (id: string) => void; onEdit: (item: FlightLeg, direction: 'outbound' | 'return') => void; onDelete: (item: FlightLeg) => void; onAdd: () => void }) {
  return <div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-black/40">{title}</h3><button onClick={onAdd} className="text-xs text-black/45 hover:text-black">+ Add</button></div><div className="space-y-3">{items.map((item) => {
    const isSelected = selected === item.id;
    return <div key={item.id} className={`relative overflow-hidden rounded-2xl border bg-[#fbfbf8] transition hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? 'border-black ring-1 ring-black' : 'hover:border-black/25'}`}>
      <button type="button" aria-pressed={isSelected} onClick={() => onSelect(item.id)} className="block w-full p-4 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset">
        <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-black text-white"><Plane size={13} /></span><span className="truncate text-sm font-semibold">{item.airline}</span>{item.live && <Badge className="h-5 rounded-full bg-green-50 px-2 text-[10px] text-green-700 hover:bg-green-50">Live</Badge>}</div><span className="font-mono text-[11px] tracking-wider text-black/45">{item.flight_number ?? 'FLIGHT'}</span></div>
        <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-3"><div><p className="text-2xl font-semibold tracking-[-0.04em]">{item.from}</p><p className="mt-0.5 text-xs text-black/45">{time(item.depart)}</p></div><div className="flex items-center"><span className="h-px flex-1 border-t border-dashed border-black/25" /><Plane className="mx-2 size-4 rotate-90 text-black/45" /><span className="h-px flex-1 border-t border-dashed border-black/25" /></div><div className="text-right"><p className="text-2xl font-semibold tracking-[-0.04em]">{item.to}</p><p className="mt-0.5 text-xs text-black/45">{time(item.arrive)}</p></div></div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-black/40"><span>{shortDate(item.depart.slice(0, 10))}</span><span>{direction === 'outbound' ? 'Outbound' : 'Return'} · per person</span></div>
      </button>
      <div className="relative flex items-center justify-between border-t border-dashed px-4 py-3"><span className="absolute -left-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-r bg-white" /><span className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border-l bg-white" /><div className="flex items-center gap-2"><SelectDot selected={isSelected} /><strong className="text-sm">{money(item.price_per_person, currency)}</strong></div><div className="flex items-center gap-1"><EntryAction label="Edit" onClick={() => onEdit(item, direction)} icon={<Pencil />} /><EntryAction label="Delete" onClick={() => onDelete(item)} icon={<Trash2 />} destructive />{item.url && <External item={item.url} label={`${title} flight listing`} />}</div></div>
    </div>;
  })}{!items.length && <button onClick={onAdd} className="w-full rounded-2xl border border-dashed p-5 text-sm text-black/40">Add a {title.toLowerCase()} option</button>}</div></div>;
}
function SelectDot({ selected }: { selected: boolean }) { return <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-black bg-black text-white' : 'text-transparent'}`}><Check size={12} /></span>; }
function External({ item, label }: { item: string; label: string }) { return <a href={item} onClick={(event) => event.stopPropagation()} target="_blank" rel="noreferrer" aria-label={label} className="rounded p-1 text-black/35 hover:bg-black/5 hover:text-black"><ExternalLink size={14} /></a>; }
function EntryAction({ label, onClick, icon, destructive = false }: { label: string; onClick: () => void; icon: React.ReactNode; destructive?: boolean }) { return <button type="button" onClick={onClick} aria-label={label} title={label} className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition [&_svg]:size-3.5 ${destructive ? 'text-black/35 hover:bg-red-50 hover:text-red-600' : 'text-black/45 hover:bg-black/5 hover:text-black'}`}>{icon}<span className="hidden xl:inline">{label}</span></button>; }

function PreviewCard({ title, subtitle, location, image, images, price, selected, placeholder, details, onSelect, actions }: {
  title: string; subtitle: string; location: string; image?: string; images?: string[]; price: string; selected: boolean;
  placeholder: React.ReactNode; details: { icon: React.ReactNode; label: string }[];
  onSelect: () => void; actions?: React.ReactNode;
}) {
  const gallery = useMemo(() => [...new Set([image, ...(images ?? [])].filter((item): item is string => Boolean(item)))], [image, images]);
  const [photo, setPhoto] = useState(0);
  useEffect(() => { if (photo >= gallery.length) setPhoto(0); }, [gallery.length, photo]);
  return <Card className={`group relative gap-0 overflow-hidden rounded-2xl py-0 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${selected ? 'border-black ring-1 ring-black' : 'hover:border-black/25'}`}>
    <div className="relative h-48 overflow-hidden bg-[#efefed]">
      <button type="button" aria-label={`Select ${title}`} aria-pressed={selected} onClick={onSelect} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset">
        {gallery[photo] ? <img src={gallery[photo]} alt={`${title} · photo ${photo + 1}`} className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 group-hover:brightness-[0.68]" /> : <div className="grid h-full place-items-center text-black/20 [&_svg]:size-8">{placeholder}</div>}
        <span className="absolute right-4 top-4 grid size-10 translate-y-1 place-items-center rounded-full bg-white text-black opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"><ArrowRight size={18} /></span>
        <span className={`absolute left-4 top-4 grid size-7 place-items-center rounded-full border transition ${selected ? 'border-black bg-black text-white' : 'border-white/80 bg-white/90 text-transparent'}`}><Check size={14} /></span>
      </button>
      {gallery.length > 1 && <><button type="button" onClick={() => setPhoto((current) => (current - 1 + gallery.length) % gallery.length)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"><ChevronLeft size={16} /></button><button type="button" onClick={() => setPhoto((current) => (current + 1) % gallery.length)} aria-label="Next photo" className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"><ChevronRight size={16} /></button><span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white backdrop-blur"><Images size={11} /> {photo + 1}/{gallery.length}</span></>}
    </div>
    <button type="button" aria-pressed={selected} onClick={onSelect} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate text-lg font-medium tracking-[-0.02em] transition group-hover:text-black/65">{title}</h3><p className="mt-1 truncate text-sm text-black/45">{subtitle}</p></div>
          <Badge className="shrink-0 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black">{price}</Badge>
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-xs leading-5 text-black/45"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{location}</span></p>
        <div className="mt-5 grid grid-cols-2 border-t pt-4">{details.map((detail, index) => <div key={`${detail.label}-${index}`} className={`min-w-0 ${index ? 'border-l pl-4' : 'pr-4'}`}><span className="block text-black/55 [&_svg]:size-4">{detail.icon}</span><p className="mt-2 truncate text-xs text-black/60">{detail.label}</p></div>)}</div>
      </div>
    </button>
    {actions && <div className="flex min-h-11 items-center justify-end gap-1 border-t px-5 py-2.5">{actions}</div>}
  </Card>;
}

function SourceEditor({ source, setSource, error, onApply, onDownload }: { source: string; setSource: (value: string) => void; error: string; onApply: () => void; onDownload: () => void }) {
  return <div className="mx-auto max-w-3xl"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">Portable source</p><h1 className="mt-2 text-2xl font-semibold">Trip YAML</h1><p className="mt-2 max-w-xl text-sm text-black/50">The visual plan is generated from this file. Edit it here, drop in another <code>.trip.yaml</code>, or give the format to a coding agent.</p></div><Button onClick={onDownload} variant="outline"><Download /> Download</Button></div><Textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} className="min-h-[65vh] resize-y rounded-xl bg-[#111] p-5 font-mono text-[13px] leading-6 text-[#ededed]" />{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-4 flex items-center justify-between"><a href="/trips/edinburgh.trip.yaml" download className="text-xs text-black/45 underline underline-offset-4">Example file</a><Button onClick={onApply} className="bg-black text-white">Apply YAML</Button></div></div>;
}

function AddEntryDialog({ kind, editing, draft, setDraft, onClose, onAdd }: { kind: AddKind | null; editing: boolean; draft: Draft; setDraft: (value: Draft) => void; onClose: () => void; onAdd: () => void }) {
  const set = (key: keyof Draft, value: string) => setDraft({ ...draft, [key]: value });
  return <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} {kind}</DialogTitle><DialogDescription>{editing ? 'Change any field below.' : 'Add it visually now.'} The YAML source updates automatically.</DialogDescription></DialogHeader><div className="grid gap-4 py-2">
    <Field label={kind === 'flight' ? 'Airline' : 'Name'} value={draft.name} setValue={(value) => set('name', value)} placeholder={kind === 'activity' ? 'Edinburgh Castle' : kind === 'flight' ? 'Ryanair' : 'Name'} />
    {kind === 'flight' ? <>
      <Field label="Flight number" value={draft.detail} setValue={(value) => set('detail', value)} placeholder="FR188" />
      <div className="grid grid-cols-2 gap-3"><Field label="From" value={draft.from} setValue={(value) => set('from', value.toUpperCase())} placeholder="MAD" /><Field label="To" value={draft.to} setValue={(value) => set('to', value.toUpperCase())} placeholder="EDI" /></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Departure" value={draft.depart} setValue={(value) => set('depart', value)} placeholder="" type="datetime-local" /><Field label="Arrival" value={draft.arrive} setValue={(value) => set('arrive', value)} placeholder="" type="datetime-local" /></div>
    </> : <>
      {kind === 'stay' && <><Field label="Type / short summary" value={draft.detail} setValue={(value) => set('detail', value)} placeholder="Entire apartment · 1 bedroom" /><Field label="Neighbourhood" value={draft.neighbourhood} setValue={(value) => set('neighbourhood', value)} placeholder="Old Town" /><div className="grid grid-cols-3 gap-3"><Field label="Bedrooms" value={draft.bedrooms} setValue={(value) => set('bedrooms', value)} placeholder="1" type="number" /><Field label="Bathrooms" value={draft.bathrooms} setValue={(value) => set('bathrooms', value)} placeholder="1" type="number" /><Field label="Size (m²)" value={draft.size} setValue={(value) => set('size', value)} placeholder="47" type="number" /></div></>}
      {kind === 'activity' && <div className="grid grid-cols-2 gap-3"><Field label="Date" value={draft.date} setValue={(value) => set('date', value)} placeholder="" type="date" /><Field label="Time" value={draft.time} setValue={(value) => set('time', value)} placeholder="" type="time" /></div>}
      <Field label="Address" value={draft.address} setValue={(value) => set('address', value)} placeholder="Address or neighbourhood" />
      <div className="grid grid-cols-2 gap-3"><Field label="Latitude" value={draft.lat} setValue={(value) => set('lat', value)} placeholder="55.9533" /><Field label="Longitude" value={draft.lng} setValue={(value) => set('lng', value)} placeholder="-3.1883" /></div>
      {kind === 'stay' && <><div className="grid grid-cols-2 gap-3"><Field label="Check-in" value={draft.checkIn} setValue={(value) => set('checkIn', value)} placeholder="15:00" /><Field label="Check-out" value={draft.checkOut} setValue={(value) => set('checkOut', value)} placeholder="11:00" /></div><TextAreaField label="Amenities" value={draft.amenities} setValue={(value) => set('amenities', value)} placeholder="Wi-Fi\nKitchen\nWasher" hint="One per line or comma-separated" /><div className="grid grid-cols-2 gap-3"><TextAreaField label="Pros" value={draft.pros} setValue={(value) => set('pros', value)} placeholder="Walkable\nQuiet street" /><TextAreaField label="Cons" value={draft.cons} setValue={(value) => set('cons', value)} placeholder="No lift\nSmall kitchen" /></div><TextAreaField label="Cancellation policy" value={draft.cancellationPolicy} setValue={(value) => set('cancellationPolicy', value)} placeholder="Free cancellation until…" /><TextAreaField label="Extensive notes" value={draft.notes} setValue={(value) => set('notes', value)} placeholder="Add research, impressions, transport notes, questions for the host, or anything useful for the decision…" rows={7} /></>}
    </>}
    <Field label={kind === 'flight' ? 'Price per person' : 'Total price'} value={draft.price} setValue={(value) => set('price', value)} placeholder="0" type="number" />
    <Field label="Link" value={draft.url} setValue={(value) => set('url', value)} placeholder="https://…" type="url" />
    {kind !== 'flight' && <Field label="Image URL" value={draft.image} setValue={(value) => set('image', value)} placeholder="https://…" type="url" />}
  </div><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button onClick={onAdd} className="bg-black text-white">{editing ? 'Save changes' : 'Add to trip'}</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, value, setValue, placeholder, type = 'text' }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; type?: string }) { return <label className="text-sm font-medium">{label}<Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} type={type} className="mt-1.5 h-10" /></label>; }
function TextAreaField({ label, value, setValue, placeholder, hint, rows = 3 }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; hint?: string; rows?: number }) { return <label className="text-sm font-medium">{label}<Textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} rows={rows} className="mt-1.5 resize-y" />{hint && <span className="mt-1 block text-[11px] font-normal text-black/40">{hint}</span>}</label>; }

function StayDetailsDialog({ stay, currency, onClose, onEdit }: { stay?: Stay; currency: string; onClose: () => void; onEdit: (stay: Stay) => void }) {
  const facts = stay ? [
    stay.bedrooms ? { icon: <BedDouble />, label: `${stay.bedrooms} bedroom${stay.bedrooms === 1 ? '' : 's'}` } : null,
    stay.bathrooms ? { icon: <Bath />, label: `${stay.bathrooms} bathroom${stay.bathrooms === 1 ? '' : 's'}` } : null,
    stay.size_m2 ? { icon: <Expand />, label: `${stay.size_m2} m²` } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[] : [];
  return <Dialog open={Boolean(stay)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-3xl">
    {stay && <><div className="relative h-56 overflow-hidden rounded-t-2xl bg-[#ededeb] sm:h-72">{stay.image ? <img src={stay.image} alt={stay.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-black/20"><BedDouble size={34} /></div>}<div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" /><div className="absolute inset-x-6 bottom-5 flex items-end justify-between gap-4 text-white"><div><p className="text-sm text-white/70">{stay.neighbourhood ?? stay.type ?? 'Accommodation'}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{stay.name}</h2></div><strong className="rounded-full bg-white px-4 py-2 text-sm text-black">{money(stay.price_total, currency)}</strong></div></div>
      <div className="space-y-7 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-black/55"><span className="flex items-center gap-1.5"><MapPin size={14} />{stay.address ?? 'Location not added'}</span>{stay.rating && <Badge variant="secondary" className="rounded-full"><Star /> {stay.rating}</Badge>}</div>
        {facts.length > 0 && <div className="grid gap-2 sm:grid-cols-3">{facts.map((fact) => <div key={fact.label} className="flex items-center gap-2 rounded-xl bg-[#f5f5f3] px-4 py-3 text-sm [&_svg]:size-4">{fact.icon}{fact.label}</div>)}</div>}
        <DetailSection title="Notes"><p className="whitespace-pre-wrap text-sm leading-6 text-black/65">{stay.notes || 'No detailed notes yet. Use Edit to add research, impressions, transport information, or questions for the host.'}</p></DetailSection>
        {stay.amenities && stay.amenities.length > 0 && <DetailSection title="Amenities"><div className="flex flex-wrap gap-2">{stay.amenities.map((item) => <span key={item} className="rounded-full bg-[#f2f2f0] px-3 py-1.5 text-xs text-black/65">{item}</span>)}</div></DetailSection>}
        {((stay.pros?.length ?? 0) > 0 || (stay.cons?.length ?? 0) > 0) && <div className="grid gap-5 sm:grid-cols-2"><DetailList title="Pros" items={stay.pros ?? []} icon={<CheckCircle2 className="text-green-700" />} /><DetailList title="Cons" items={stay.cons ?? []} icon={<XCircle className="text-red-600" />} /></div>}
        <div className="grid gap-5 sm:grid-cols-2"><DetailSection title="Arrival"><div className="space-y-2 text-sm text-black/60"><p><span className="text-black/35">Check-in</span><br />{stay.check_in || 'Not added'}</p><p><span className="text-black/35">Check-out</span><br />{stay.check_out || 'Not added'}</p></div></DetailSection><DetailSection title="Cancellation"><p className="whitespace-pre-wrap text-sm leading-6 text-black/60">{stay.cancellation_policy || 'Policy not added'}</p></DetailSection></div>
      </div>
      <DialogFooter className="border-t px-6 py-4 sm:px-8"><Button variant="outline" onClick={onClose}>Close</Button>{stay.url && <Button variant="outline" render={<a href={stay.url} target="_blank" rel="noreferrer" />}><ExternalLink /> Listing</Button>}<Button onClick={() => onEdit(stay)} className="bg-black text-white"><Pencil /> Edit all details</Button></DialogFooter></>}
  </DialogContent></Dialog>;
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">{title}</h3>{children}</section>; }
function DetailList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) { return <DetailSection title={title}>{items.length ? <ul className="space-y-2">{items.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-black/65 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">{icon}<span>{item}</span></li>)}</ul> : <p className="text-sm text-black/40">Nothing added yet.</p>}</DetailSection>; }

function DeleteEntryDialog({ target, onCancel, onConfirm }: { target: DeleteTarget | null; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onCancel()}><DialogContent className="rounded-xl sm:max-w-sm"><DialogHeader><DialogTitle>Delete {target?.name}?</DialogTitle><DialogDescription>This removes the {target?.kind} from the trip and recalculates the selected total. You can still restore it from a saved YAML file.</DialogDescription></DialogHeader><DialogFooter><Button onClick={onCancel} variant="outline">Cancel</Button><Button onClick={onConfirm} variant="destructive"><Trash2 /> Delete</Button></DialogFooter></DialogContent></Dialog>;
}

function FinalVersion({ trip, total, perPerson, outbound, returnFlight, stay, activities, onClose }: { trip: TripDocument; total: number; perPerson: number; outbound?: FlightLeg; returnFlight?: FlightLeg; stay?: Stay; activities: Activity[]; onClose: () => void }) {
  return <div className="final-overlay fixed inset-0 z-[90] overflow-y-auto bg-[#eceae6] print:static print:overflow-visible print:bg-white"><div className="no-print fixed right-5 top-5 z-10 flex gap-2"><Button onClick={onClose} variant="outline" className="bg-white"><X /> Close</Button><Button onClick={() => window.print()} className="bg-black text-white"><Download /> Save as PDF</Button></div><article className="print-sheet mx-auto my-10 w-[min(900px,calc(100%-32px))] overflow-hidden bg-white shadow-xl print:my-0 print:w-full print:shadow-none"><header className="bg-black p-10 text-white"><div className="flex items-start justify-between gap-8"><div><p className="text-xs uppercase tracking-[0.16em] text-white/50">Final itinerary</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{trip.trip.title}</h1><p className="mt-4 text-white/55">{shortDate(trip.trip.dates.start)}–{shortDate(trip.trip.dates.end)} · {trip.trip.travellers} travellers</p></div><div className="text-right"><p className="text-3xl font-semibold">{money(perPerson, trip.trip.currency)}</p><p className="mt-1 text-xs text-white/45">per person</p></div></div></header><div className="grid gap-8 p-10 md:grid-cols-[1fr_1fr]"><div className="space-y-7"><FinalBlock icon={<Plane />} title="Flights">{outbound ? <p><strong>{outbound.flight_number ?? outbound.airline}</strong> · {outbound.from} {time(outbound.depart)} → {outbound.to} {time(outbound.arrive)} · {money(outbound.price_per_person, trip.trip.currency)}</p> : <p>Outbound not selected</p>}{returnFlight ? <p><strong>{returnFlight.flight_number ?? returnFlight.airline}</strong> · {returnFlight.from} {time(returnFlight.depart)} → {returnFlight.to} {time(returnFlight.arrive)} · {money(returnFlight.price_per_person, trip.trip.currency)}</p> : <p>Return not selected</p>}</FinalBlock><FinalBlock icon={<BedDouble />} title="Stay">{stay ? <><p className="font-medium">{stay.name}</p><p>{stay.type}</p><p>{stay.address}</p>{(stay.check_in || stay.check_out) && <p>Check-in {stay.check_in || '—'} · check-out {stay.check_out || '—'}</p>}{stay.amenities?.length ? <p>Amenities: {stay.amenities.join(', ')}</p> : null}{stay.notes && <p className="mt-2 whitespace-pre-wrap border-l-2 pl-3">{stay.notes}</p>}</> : <p>Not selected</p>}</FinalBlock><FinalBlock icon={<Sparkles />} title="Activities">{activities.length ? activities.map((item) => <p key={item.id}><strong>{item.name}</strong>{item.address ? ` · ${item.address}` : ''}</p>) : <p>No activities added</p>}</FinalBlock><div className="border-t pt-5"><div className="flex justify-between text-sm"><span>Total trip</span><strong>{money(total, trip.trip.currency)}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Per person</span><strong>{money(perPerson, trip.trip.currency)}</strong></div></div></div><div className="min-h-[440px] overflow-hidden rounded-xl border"><TripMap trip={trip} compact /></div></div><footer className="border-t px-10 py-5 text-xs text-black/40">Generated with Roamwise · Verify live prices and booking details before purchase.</footer></article></div>;
}
function FinalBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">{icon}{title}</h2><div className="space-y-1.5 text-sm text-black/55">{children}</div></section>; }
