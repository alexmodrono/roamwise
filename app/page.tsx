'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BedDouble, CalendarDays, Check, Clock3, Code2, Download, ExternalLink, FileText,
  Link2, LoaderCircle, MapPin, Plane, Plus, Sparkles, Star, Upload, Users, X,
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
type Draft = { name: string; detail: string; address: string; price: string; image: string; url: string; lat: string; lng: string };
const emptyDraft: Draft = { name: '', detail: '', address: '', price: '', image: '', url: '', lat: '', lng: '' };

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}
function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function time(value?: string) { return value?.split('T')[1]?.slice(0, 5) ?? '—'; }
function safeId(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `item-${Date.now()}`; }

export default function Home() {
  const [trip, setTrip] = useState<TripDocument>(DEFAULT_TRIP);
  const [source, setSource] = useState(() => stringifyTrip(DEFAULT_TRIP));
  const [view, setView] = useState<'plan' | 'source'>('plan');
  const [sourceError, setSourceError] = useState('');
  const [link, setLink] = useState('');
  const [linkState, setLinkState] = useState<'idle' | 'loading' | 'done' | 'fallback'>('idle');
  const [stayState, setStayState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [flightDirection, setFlightDirection] = useState<'outbound' | 'return'>('outbound');
  const [flightState, setFlightState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setLinkState('loading');
    let data: Record<string, unknown> = {};
    try {
      const response = await fetch('/api/unfurl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: link.trim() }) });
      data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error ?? 'Import failed'));
      setLinkState('done');
    } catch { setLinkState('fallback'); }
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
      url: link.trim(),
    };
    commit({ ...trip, stays: [...trip.stays, stay], selected: { ...trip.selected, stay: stay.id } });
    if (!data.title || (!data.image && !data.address)) {
      setEditingId(stay.id);
      setDraft({ name: stay.name, detail: stay.type ?? '', address: stay.address ?? '', price: '', image: '', url: stay.url ?? '', lat: '', lng: '' });
      setAddKind('stay');
    }
    setLink(''); setTimeout(() => setLinkState('idle'), 2800);
  }

  function addEntry() {
    if (!addKind || !draft.name.trim()) return;
    const coordinates = Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng)) && draft.lat && draft.lng ? { lat: Number(draft.lat), lng: Number(draft.lng) } : undefined;
    const id = `${safeId(draft.name)}-${Date.now()}`;
    if (addKind === 'stay') {
      const item: Stay = { id, name: draft.name, type: draft.detail, address: draft.address, price_total: Number(draft.price) || 0, image: draft.image || undefined, url: draft.url || undefined, coordinates };
      if (editingId) commit({ ...trip, stays: trip.stays.map((existing) => existing.id === editingId ? { ...existing, ...item, id: editingId } : existing), selected: { ...trip.selected, stay: editingId } });
      else commit({ ...trip, stays: [...trip.stays, item], selected: { ...trip.selected, stay: id } });
    } else if (addKind === 'activity') {
      const item: Activity = { id, name: draft.name, address: draft.address, price_total: Number(draft.price) || 0, image: draft.image || undefined, url: draft.url || undefined, coordinates };
      commit({ ...trip, activities: [...trip.activities, item], selected: { ...trip.selected, activities: [...trip.selected.activities, id] } });
    } else {
      const origin = trip.trip.origin.code ?? trip.trip.origin.name; const destination = trip.trip.destination.code ?? trip.trip.destination.name;
      const isOutbound = flightDirection === 'outbound';
      const item: FlightLeg = { id, airline: draft.name, price_per_person: Number(draft.price) || 0, url: draft.url || undefined, from: isOutbound ? origin : destination, to: isOutbound ? destination : origin, depart: `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00`, arrive: `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00` };
      commit({ ...trip, flights: { ...trip.flights, [flightDirection]: [...trip.flights[flightDirection], item] }, selected: { ...trip.selected, [isOutbound ? 'outbound_flight' : 'return_flight']: id } });
    }
    setDraft(emptyDraft); setEditingId(null); setAddKind(null);
  }

  function toggleActivity(id: string, checked: boolean) {
    const activities = checked ? [...trip.selected.activities, id] : trip.selected.activities.filter((item) => item !== id);
    commit({ ...trip, selected: { ...trip.selected, activities: [...new Set(activities)] } });
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
        const response = await fetch('/api/unfurl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: stay.url }) });
        if (!response.ok) return stay;
        const data = await response.json() as Record<string, unknown>;
        const coordinate = data.coordinates as { lat?: number; lng?: number } | undefined;
        return { ...stay, name: data.title ? String(data.title) : stay.name, type: data.description ? String(data.description) : stay.type, address: data.address ? String(data.address) : stay.address, image: data.image ? String(data.image) : stay.image, coordinates: coordinate?.lat && coordinate?.lng ? { lat: coordinate.lat, lng: coordinate.lng } : stay.coordinates, price_total: Number(data.price) || stay.price_total };
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

          <section><div className="mb-3 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-base font-semibold"><Plane size={17} />Flights</h2><p className="mt-1 text-xs text-black/40">{trip.flights.provider ? `Live via ${trip.flights.provider}` : 'Trip source'}{trip.flights.updated_at ? ` · checked ${new Date(trip.flights.updated_at).toISOString().slice(11, 16)} UTC` : ''}</p></div><Button onClick={() => void refreshFlights()} disabled={flightState === 'loading'} variant="outline" size="sm">{flightState === 'loading' ? <LoaderCircle className="animate-spin" /> : <Download />} {flightState === 'done' ? 'Updated' : 'Refresh live'}</Button></div>{flightState === 'error' && <p className="mb-3 text-xs text-red-600">No live direct fares were returned. Existing options are unchanged.</p>}<div className="grid gap-4 md:grid-cols-2"><FlightGroup title="Outbound" items={trip.flights.outbound} selected={trip.selected.outbound_flight} currency={trip.trip.currency} onSelect={(id) => commit({ ...trip, selected: { ...trip.selected, outbound_flight: id } })} onAdd={() => { setFlightDirection('outbound'); setDraft(emptyDraft); setAddKind('flight'); }} /><FlightGroup title="Return" items={trip.flights.return} selected={trip.selected.return_flight} currency={trip.trip.currency} onSelect={(id) => commit({ ...trip, selected: { ...trip.selected, return_flight: id } })} onAdd={() => { setFlightDirection('return'); setDraft(emptyDraft); setAddKind('flight'); }} /></div></section>

          <Section title="Stays" icon={<BedDouble size={17} />} action={() => { setEditingId(null); setDraft(emptyDraft); setAddKind('stay'); }}>
            <div className="mb-3 flex gap-2"><Input value={link} onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void importListing()} placeholder="Paste an Airbnb or Booking.com link" className="h-10" /><Button onClick={() => void importListing()} disabled={linkState === 'loading'} className="h-10 bg-black text-white"><span className="hidden sm:inline">Import listing</span>{linkState === 'loading' ? <LoaderCircle className="animate-spin" /> : <Link2 />}</Button></div>
            <div className="mb-3 flex min-h-5 items-center justify-between">{linkState === 'done' ? <p className="text-xs text-green-700">Listing details loaded. Check the price before deciding.</p> : linkState === 'fallback' ? <p className="text-xs text-amber-700">The site blocked its preview, so the link was added as an editable entry.</p> : <span />}<button onClick={() => void refreshStays()} disabled={stayState === 'loading'} className="text-xs text-black/45 hover:text-black">{stayState === 'loading' ? 'Refreshing…' : stayState === 'done' ? 'Details refreshed' : 'Refresh stay details'}</button></div>
            <div className="grid gap-4 sm:grid-cols-2">{trip.stays.map((item) => <PreviewCard
              key={item.id}
              title={item.name}
              subtitle={item.type ?? 'Stay'}
              location={item.address ?? 'Location not added'}
              image={item.image}
              price={money(item.price_total, trip.trip.currency)}
              selected={trip.selected.stay === item.id}
              placeholder={<BedDouble />}
              details={[
                { icon: <BedDouble />, label: item.type ?? 'Stay' },
                { icon: <Star />, label: item.rating ? `${item.rating} rating` : 'Not rated' },
              ]}
              onSelect={() => commit({ ...trip, selected: { ...trip.selected, stay: item.id } })}
              actions={<><button onClick={() => { setEditingId(item.id); setDraft({ name: item.name, detail: item.type ?? '', address: item.address ?? '', price: String(item.price_total), image: item.image ?? '', url: item.url ?? '', lat: item.coordinates ? String(item.coordinates.lat) : '', lng: item.coordinates ? String(item.coordinates.lng) : '' }); setAddKind('stay'); }} className="text-xs font-medium text-black/45 hover:text-black">Edit</button>{item.url && <External item={item.url} label="Stay listing" />}</>}
            />)}</div>
          </Section>

          <Section title="Activities" icon={<Sparkles size={17} />} action={() => { setDraft(emptyDraft); setAddKind('activity'); }}>
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
                actions={item.url ? <External item={item.url} label="Activity listing" /> : undefined}
              />;
            })}</div> : <button onClick={() => { setDraft(emptyDraft); setAddKind('activity'); }} className="flex w-full items-center justify-between rounded-xl border border-dashed p-5 text-left text-sm text-black/45 hover:bg-[#fafafa]"><span>Add restaurants, tickets, tours or anything with a location.</span><Plus size={16} /></button>}
          </Section>

          <button onClick={() => setView('source')} className="flex w-full items-center justify-between rounded-xl bg-[#f4f4f4] p-4 text-left"><span><strong className="block text-sm">Portable trip source</strong><small className="mt-1 block text-black/45">Edit, download or ask a coding agent to generate roamwise/v1 YAML.</small></span><Code2 size={18} /></button>
        </div>}
      </section>
      <aside className="h-[56vh] overflow-hidden border-t lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:border-t-0"><TripMap trip={trip} /></aside>
    </div>

    <AddEntryDialog kind={addKind} editing={Boolean(editingId)} draft={draft} setDraft={setDraft} onClose={() => { setAddKind(null); setEditingId(null); }} onAdd={addEntry} />
    {finalOpen && <FinalVersion trip={trip} total={total} perPerson={perPerson} outbound={selectedOutbound} returnFlight={selectedReturn} stay={selectedStay} activities={selectedActivities} onClose={() => setFinalOpen(false)} />}
  </main>;
}

function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action: () => void; children: React.ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2><Button onClick={action} variant="ghost" size="sm"><Plus /> Add</Button></div>{children}</section>;
}
function FlightGroup({ title, items, selected, currency, onSelect, onAdd }: { title: string; items: FlightLeg[]; selected?: string; currency: string; onSelect: (id: string) => void; onAdd: () => void }) {
  return <div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-black/40">{title}</h3><button onClick={onAdd} className="text-xs text-black/45 hover:text-black">+ Add</button></div><div className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === item.id ? 'border-black bg-[#fafafa]' : 'hover:bg-[#fafafa]'}`}><SelectDot selected={selected === item.id} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{item.airline}</p>{item.flight_number && <span className="text-[11px] text-black/40">{item.flight_number}</span>}{item.live && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Live</span>}</div><p className="mt-1 text-xs text-black/45">{item.from} {time(item.depart)} → {item.to} {time(item.arrive)}</p></div><strong className="text-sm">{money(item.price_per_person, currency)}</strong>{item.url && <External item={item.url} label={`${title} flight listing`} />}</button>)}{!items.length && <button onClick={onAdd} className="w-full rounded-xl border border-dashed p-4 text-sm text-black/40">Add a {title.toLowerCase()} option</button>}</div></div>;
}
function SelectDot({ selected }: { selected: boolean }) { return <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-black bg-black text-white' : 'text-transparent'}`}><Check size={12} /></span>; }
function External({ item, label }: { item: string; label: string }) { return <a href={item} onClick={(event) => event.stopPropagation()} target="_blank" rel="noreferrer" aria-label={label} className="rounded p-1 text-black/35 hover:bg-black/5 hover:text-black"><ExternalLink size={14} /></a>; }

function PreviewCard({ title, subtitle, location, image, price, selected, placeholder, details, onSelect, actions }: {
  title: string; subtitle: string; location: string; image?: string; price: string; selected: boolean;
  placeholder: React.ReactNode; details: { icon: React.ReactNode; label: string }[];
  onSelect: () => void; actions?: React.ReactNode;
}) {
  return <Card className={`group relative gap-0 overflow-hidden rounded-2xl py-0 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${selected ? 'border-black ring-1 ring-black' : 'hover:border-black/25'}`}>
    <button type="button" aria-pressed={selected} onClick={onSelect} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset">
      <div className="relative h-48 overflow-hidden bg-[#efefed]">
        {image ? <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 group-hover:brightness-[0.68]" /> : <div className="grid h-full place-items-center text-black/20 [&_svg]:size-8">{placeholder}</div>}
        <span className="absolute right-4 top-4 grid size-10 translate-y-1 place-items-center rounded-full bg-white text-black opacity-0 shadow-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"><ArrowRight size={18} /></span>
        <span className={`absolute left-4 top-4 grid size-7 place-items-center rounded-full border transition ${selected ? 'border-black bg-black text-white' : 'border-white/80 bg-white/90 text-transparent'}`}><Check size={14} /></span>
      </div>
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
  return <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} {kind}</DialogTitle><DialogDescription>{editing ? 'Complete or correct the imported details.' : 'Add it visually now.'} The YAML source updates automatically.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><Field label={kind === 'flight' ? 'Airline' : 'Name'} value={draft.name} setValue={(value) => set('name', value)} placeholder={kind === 'activity' ? 'Edinburgh Castle' : 'Name'} /><Field label="Details" value={draft.detail} setValue={(value) => set('detail', value)} placeholder="Room type, notes or timing" />{kind !== 'flight' && <Field label="Address" value={draft.address} setValue={(value) => set('address', value)} placeholder="Address or neighbourhood" />}<div className="grid grid-cols-2 gap-3">{kind !== 'flight' && <><Field label="Latitude" value={draft.lat} setValue={(value) => set('lat', value)} placeholder="55.9533" /><Field label="Longitude" value={draft.lng} setValue={(value) => set('lng', value)} placeholder="-3.1883" /></>}<Field label={kind === 'flight' ? 'Price per person' : 'Total price'} value={draft.price} setValue={(value) => set('price', value)} placeholder="0" type="number" /></div><Field label="Link" value={draft.url} setValue={(value) => set('url', value)} placeholder="https://…" type="url" />{kind !== 'flight' && <Field label="Image URL" value={draft.image} setValue={(value) => set('image', value)} placeholder="https://…" type="url" />}</div><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button onClick={onAdd} className="bg-black text-white">{editing ? 'Save changes' : 'Add to trip'}</Button></DialogFooter></DialogContent></Dialog>;
}
function Field({ label, value, setValue, placeholder, type = 'text' }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; type?: string }) { return <label className="text-sm font-medium">{label}<Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} type={type} className="mt-1.5 h-10" /></label>; }

function FinalVersion({ trip, total, perPerson, outbound, returnFlight, stay, activities, onClose }: { trip: TripDocument; total: number; perPerson: number; outbound?: FlightLeg; returnFlight?: FlightLeg; stay?: Stay; activities: Activity[]; onClose: () => void }) {
  return <div className="final-overlay fixed inset-0 z-[90] overflow-y-auto bg-[#eceae6] print:static print:overflow-visible print:bg-white"><div className="no-print fixed right-5 top-5 z-10 flex gap-2"><Button onClick={onClose} variant="outline" className="bg-white"><X /> Close</Button><Button onClick={() => window.print()} className="bg-black text-white"><Download /> Save as PDF</Button></div><article className="print-sheet mx-auto my-10 w-[min(900px,calc(100%-32px))] overflow-hidden bg-white shadow-xl print:my-0 print:w-full print:shadow-none"><header className="bg-black p-10 text-white"><div className="flex items-start justify-between gap-8"><div><p className="text-xs uppercase tracking-[0.16em] text-white/50">Final itinerary</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{trip.trip.title}</h1><p className="mt-4 text-white/55">{shortDate(trip.trip.dates.start)}–{shortDate(trip.trip.dates.end)} · {trip.trip.travellers} travellers</p></div><div className="text-right"><p className="text-3xl font-semibold">{money(perPerson, trip.trip.currency)}</p><p className="mt-1 text-xs text-white/45">per person</p></div></div></header><div className="grid gap-8 p-10 md:grid-cols-[1fr_1fr]"><div className="space-y-7"><FinalBlock icon={<Plane />} title="Flights">{outbound ? <p><strong>{outbound.flight_number ?? outbound.airline}</strong> · {outbound.from} {time(outbound.depart)} → {outbound.to} {time(outbound.arrive)} · {money(outbound.price_per_person, trip.trip.currency)}</p> : <p>Outbound not selected</p>}{returnFlight ? <p><strong>{returnFlight.flight_number ?? returnFlight.airline}</strong> · {returnFlight.from} {time(returnFlight.depart)} → {returnFlight.to} {time(returnFlight.arrive)} · {money(returnFlight.price_per_person, trip.trip.currency)}</p> : <p>Return not selected</p>}</FinalBlock><FinalBlock icon={<BedDouble />} title="Stay">{stay ? <><p className="font-medium">{stay.name}</p><p>{stay.type}</p><p>{stay.address}</p></> : <p>Not selected</p>}</FinalBlock><FinalBlock icon={<Sparkles />} title="Activities">{activities.length ? activities.map((item) => <p key={item.id}><strong>{item.name}</strong>{item.address ? ` · ${item.address}` : ''}</p>) : <p>No activities added</p>}</FinalBlock><div className="border-t pt-5"><div className="flex justify-between text-sm"><span>Total trip</span><strong>{money(total, trip.trip.currency)}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Per person</span><strong>{money(perPerson, trip.trip.currency)}</strong></div></div></div><div className="min-h-[440px] overflow-hidden rounded-xl border"><TripMap trip={trip} compact /></div></div><footer className="border-t px-10 py-5 text-xs text-black/40">Generated with Roamwise · Verify live prices and booking details before purchase.</footer></article></div>;
}
function FinalBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">{icon}{title}</h2><div className="space-y-1.5 text-sm text-black/55">{children}</div></section>; }
