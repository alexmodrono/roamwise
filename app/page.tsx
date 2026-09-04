'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble, CalendarDays, Check, ChevronRight, CirclePlus, ExternalLink,
  MapPin, Minus, Plane, Plus, ReceiptText, Share2, Sparkles, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Option = { id: string; name: string; detail: string; subdetail?: string; rating?: string; price: number; url?: string; custom?: boolean };
type Activity = Option & { selected: boolean };

const initialFlights: Option[] = [
  { id: 'ryanair', name: 'Ryanair · Direct return', detail: 'MAD 10:20 → EDI 12:15', subdetail: 'EDI 10:00 → MAD 13:55', price: 81.8, url: 'https://www.ryanair.com/es/es/trip/flights/select?adults=2&teens=0&children=0&infants=0&dateOut=2026-11-13&dateIn=2026-11-16&isConnectedFlight=false&originIata=MAD&destinationIata=EDI' },
];

const initialStays: Option[] = [
  { id: 'dryden', name: 'Dryden Gardens', detail: 'Private double room', subdetail: 'Broughton · 2 km to centre', rating: '9.2', price: 274, url: 'https://www.booking.com/hotel/gb/dryden-gardens.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1' },
  { id: 'lavender', name: 'Lavender Guest House', detail: 'Double room · en-suite', subdetail: 'Edinburgh', rating: '8.9', price: 310, url: 'https://www.booking.com/hotel/gb/lavender-guest-house-edinburgh.html?checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1' },
  { id: 'moon', name: 'Moon suite apart', detail: 'Entire 1-bed apartment', subdetail: 'Grange · 47 m²', rating: 'New', price: 324, url: 'https://www.booking.com/searchresults.html?ss=Moon%20suite%20apart%2C%20Edinburgh&checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1' },
  { id: 'suite', name: 'Suite 3 En-suite', detail: 'Private en-suite double', subdetail: 'Edinburgh', rating: '9.0', price: 344, url: 'https://www.booking.com/searchresults.html?ss=Suite%203%20En-suite%20Room%20with%20Double%20Bed%2C%20Edinburgh&checkin=2026-11-13&checkout=2026-11-16&group_adults=2&no_rooms=1' },
];

const euro = (value: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', minimumFractionDigits: value % 1 ? 2 : 0 }).format(value);

export default function Home() {
  const [travellers, setTravellers] = useState(2);
  const [flights, setFlights] = useState<Option[]>(initialFlights);
  const [stays, setStays] = useState<Option[]>(initialStays);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedFlight, setSelectedFlight] = useState('ryanair');
  const [selectedStay, setSelectedStay] = useState('dryden');
  const [cabinBag, setCabinBag] = useState(false);
  const [addType, setAddType] = useState<'flight' | 'stay' | 'activity'>('activity');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share trip');

  useEffect(() => {
    const raw = localStorage.getItem('roamwise-edinburgh');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.travellers) setTravellers(saved.travellers);
      if (saved.flights) setFlights(saved.flights);
      if (saved.stays) setStays(saved.stays);
      if (saved.activities) setActivities(saved.activities);
      if (saved.selectedFlight) setSelectedFlight(saved.selectedFlight);
      if (saved.selectedStay) setSelectedStay(saved.selectedStay);
      if (typeof saved.cabinBag === 'boolean') setCabinBag(saved.cabinBag);
    } catch { /* Ignore malformed local drafts. */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('roamwise-edinburgh', JSON.stringify({ travellers, flights, stays, activities, selectedFlight, selectedStay, cabinBag }));
  }, [travellers, flights, stays, activities, selectedFlight, selectedStay, cabinBag]);

  const flight = flights.find((item) => item.id === selectedFlight) ?? flights[0];
  const stay = stays.find((item) => item.id === selectedStay) ?? stays[0];
  const activitiesTotal = activities.filter((item) => item.selected).reduce((sum, item) => sum + item.price, 0);
  const flightsTotal = flight ? flight.price * travellers : 0;
  const bagTotal = cabinBag ? 30 * travellers : 0;
  const total = flightsTotal + bagTotal + (stay?.price ?? 0) + activitiesTotal;
  const perPerson = total / travellers;
  const budgetMax = 300;
  const budgetDelta = budgetMax - perPerson;

  function addOption() {
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(price) || price < 0) return;
    const item = { id: `${addType}-${Date.now()}`, name: newName.trim(), detail: 'Custom option', price, custom: true };
    if (addType === 'flight') { setFlights((v) => [...v, item]); setSelectedFlight(item.id); }
    if (addType === 'stay') { setStays((v) => [...v, item]); setSelectedStay(item.id); }
    if (addType === 'activity') setActivities((v) => [...v, { ...item, selected: true }]);
    setNewName(''); setNewPrice(''); setDialogOpen(false);
  }

  function removeCustom(type: 'flight' | 'stay' | 'activity', id: string) {
    if (type === 'flight') { setFlights((v) => v.filter((x) => x.id !== id)); if (selectedFlight === id) setSelectedFlight('ryanair'); }
    if (type === 'stay') { setStays((v) => v.filter((x) => x.id !== id)); if (selectedStay === id) setSelectedStay('dryden'); }
    if (type === 'activity') setActivities((v) => v.filter((x) => x.id !== id));
  }

  async function shareTrip() {
    const summary = `Edinburgh weekend · ${euro(perPerson)} per person\nFlight: ${flight?.name}\nStay: ${stay?.name}${activitiesTotal ? `\nActivities: ${euro(activitiesTotal)} total` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Edinburgh weekend', text: summary });
      else await navigator.clipboard.writeText(summary);
      setShareLabel('Copied!'); setTimeout(() => setShareLabel('Share trip'), 1800);
    } catch { /* User cancelled share. */ }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-[#17342e] text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#f4bd62] text-[#17342e]"><MapPin size={18} strokeWidth={2.4} /></div>
            <div><p className="text-[15px] font-semibold leading-none">Roamwise</p><p className="mt-1 text-xs text-white/55">Trips, decided together</p></div>
          </div>
          <Button onClick={shareTrip} className="rounded-xl bg-white/10 text-white hover:bg-white/15"><Share2 /> {shareLabel}</Button>
        </div>
      </header>

      <section className="border-b bg-[#17342e] text-white">
        <div className="mx-auto max-w-[1440px] px-5 pb-7 pt-5 lg:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-[#f4bd62]"><span className="h-px w-5 bg-[#f4bd62]" /> Trip board</div>
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Edinburgh weekend</h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
                <span className="flex items-center gap-2"><CalendarDays size={15} /> 13–16 Nov 2026</span>
                <span className="flex items-center gap-2"><MapPin size={15} /> Madrid → Edinburgh</span>
                <span className="flex items-center gap-2"><Users size={15} /> <button aria-label="Remove traveller" className="rounded hover:text-white" onClick={() => setTravellers((v) => Math.max(1, v - 1))}><Minus size={13} /></button><strong className="text-white">{travellers}</strong><button aria-label="Add traveller" className="rounded hover:text-white" onClick={() => setTravellers((v) => Math.min(12, v + 1))}><Plus size={13} /></button> travellers</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <img src="/og.png" alt="Edinburgh Castle illustration" className="hidden h-[74px] w-[142px] rounded-2xl border border-white/10 object-cover object-right lg:block" />
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm text-white/70">Budget <strong className="ml-2 text-white">€200–300 / person</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-7 lg:grid-cols-[minmax(0,1fr)_350px] lg:px-8">
        <div className="min-w-0 space-y-8">
          <OptionSection icon={<Plane size={18} />} step="1" title="Choose a flight" subtitle="Prices are per person" onAdd={() => { setAddType('flight'); setDialogOpen(true); }}>
            <div className="grid gap-3">
              {flights.map((item) => <OptionRow key={item.id} item={item} selected={item.id === selectedFlight} priceLabel={`${euro(item.price)} / person`} onSelect={() => setSelectedFlight(item.id)} onRemove={item.custom ? () => removeCustom('flight', item.id) : undefined} />)}
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-[#c8c1b4] bg-[#f2eee5]/70 px-4 py-3 text-sm"><span className="flex items-center gap-3"><Checkbox checked={cabinBag} onCheckedChange={(checked) => setCabinBag(Boolean(checked))} /><span><strong>Add 10 kg cabin bag</strong><small className="ml-2 text-muted-foreground">Priority boarding</small></span></span><strong>+€30 pp</strong></label>
            </div>
          </OptionSection>

          <OptionSection icon={<BedDouble size={18} />} step="2" title="Pick a place to stay" subtitle="3 nights · total for everyone" onAdd={() => { setAddType('stay'); setDialogOpen(true); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              {stays.map((item) => <StayCard key={item.id} item={item} selected={item.id === selectedStay} travellers={travellers} onSelect={() => setSelectedStay(item.id)} onRemove={item.custom ? () => removeCustom('stay', item.id) : undefined} />)}
            </div>
          </OptionSection>

          <OptionSection icon={<Sparkles size={18} />} step="3" title="Add activities" subtitle="Optional · total for everyone" onAdd={() => { setAddType('activity'); setDialogOpen(true); }}>
            {activities.length === 0 ? <button onClick={() => { setAddType('activity'); setDialogOpen(true); }} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#c8c1b4] bg-white/45 p-5 text-left transition-colors hover:bg-white"><span><strong className="text-sm">Nothing planned yet</strong><span className="mt-1 block text-sm text-muted-foreground">Add castle tickets, a tour, dinner—or anything else.</span></span><CirclePlus className="text-[#2d6a58]" /></button> : <div className="space-y-2">{activities.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4"><Checkbox checked={item.selected} onCheckedChange={(checked) => setActivities((v) => v.map((x) => x.id === item.id ? { ...x, selected: Boolean(checked) } : x))} /><span className="flex-1 text-sm font-medium">{item.name}</span><strong className="text-sm">{euro(item.price)}</strong><button onClick={(event) => { event.preventDefault(); removeCustom('activity', item.id); }} className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button></label>)}</div>}
          </OptionSection>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-3xl bg-[#17342e] text-white shadow-[0_18px_50px_rgba(23,52,46,0.18)]">
            <div className="border-b border-white/10 p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4bd62]">Your trip total</p><div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-[-0.05em]">{euro(perPerson)}</span><span className="text-sm text-white/55">per person</span></div><p className={`mt-2 text-sm ${budgetDelta >= 0 ? 'text-[#9cd2bb]' : 'text-[#f0a49b]'}`}>{budgetDelta >= 0 ? `${euro(budgetDelta)} below your max budget` : `${euro(Math.abs(budgetDelta))} over your max budget`}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${perPerson <= budgetMax ? 'bg-[#f4bd62]' : 'bg-[#e97d70]'}`} style={{ width: `${Math.min(100, perPerson / budgetMax * 100)}%` }} /></div></div>
            <div className="space-y-4 p-6 text-sm"><PriceRow label="Return flights" value={flightsTotal} /><PriceRow label={cabinBag ? 'Cabin bags' : 'Cabin bags · not added'} value={bagTotal} muted={!cabinBag} /><PriceRow label={stay?.name ?? 'No stay'} value={stay?.price ?? 0} />{activitiesTotal > 0 && <PriceRow label="Activities" value={activitiesTotal} />}<div className="h-px bg-white/10" /><div className="flex justify-between font-semibold"><span>Total for {travellers}</span><span>{euro(total)}</span></div></div>
            <div className="bg-white/[0.06] p-6">
              <Dialog><DialogTrigger render={<Button className="w-full rounded-xl bg-[#f4bd62] text-[#17342e] hover:bg-[#ffd180]" />}><ReceiptText /> View decision summary</DialogTrigger><DialogContent className="max-w-lg rounded-2xl p-6"><DialogHeader><DialogTitle className="text-xl">Edinburgh weekend</DialogTitle><DialogDescription>Your selected plan, ready to book.</DialogDescription></DialogHeader><div className="my-2 space-y-3 rounded-xl bg-muted p-4"><SummaryLine label="Dates" value="13–16 Nov 2026" /><SummaryLine label="Flight" value={flight?.name ?? '—'} /><SummaryLine label="Stay" value={stay?.name ?? '—'} /><SummaryLine label="Travellers" value={String(travellers)} /></div><div className="flex items-end justify-between"><span className="text-sm text-muted-foreground">Final price per person</span><strong className="text-2xl">{euro(perPerson)}</strong></div><DialogFooter className="mt-2"><DialogClose render={<Button onClick={shareTrip} className="bg-[#2d6a58]" />}><Share2 /> Share summary</DialogClose></DialogFooter></DialogContent></Dialog>
              <p className="mt-3 text-center text-xs text-white/40">Changes save automatically on this device</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border bg-white/65 p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Price check</strong><br />Flight and stay prices were checked 1 Sep 2026. Open each booking link before paying.</div>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="rounded-2xl p-6"><DialogHeader><DialogTitle>Add {addType}</DialogTitle><DialogDescription>{addType === 'flight' ? 'Enter the return price per person.' : 'Enter the total price for everyone.'}</DialogDescription></DialogHeader><div className="space-y-4 py-2"><label className="block text-sm font-medium">Name<Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-2 h-10" placeholder={addType === 'activity' ? 'Ghost tour' : `New ${addType} option`} /></label><label className="block text-sm font-medium">Price in euros<Input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOption()} className="mt-2 h-10" placeholder="0" /></label></div><DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button onClick={addOption} className="bg-[#2d6a58]">Add to trip</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}

function OptionSection({ icon, step, title, subtitle, onAdd, children }: { icon: React.ReactNode; step: string; title: string; subtitle: string; onAdd: () => void; children: React.ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#e5eee9] text-[#2d6a58]">{icon}</div><div><h2 className="text-lg font-semibold tracking-tight"><span className="text-muted-foreground">{step}.</span> {title}</h2><p className="text-sm text-muted-foreground">{subtitle}</p></div></div><Button onClick={onAdd} variant="outline" size="sm" className="rounded-xl bg-white"><Plus /> Add option</Button></div>{children}</section>;
}

function OptionRow({ item, selected, priceLabel, onSelect, onRemove }: { item: Option; selected: boolean; priceLabel: string; onSelect: () => void; onRemove?: () => void }) {
  return <div className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition-all ${selected ? 'border-[#2d6a58] ring-1 ring-[#2d6a58]' : 'hover:border-[#9bb9ad]'}`}><button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? 'bg-[#17342e] text-white' : 'bg-muted'}`}><Plane size={18} /></div><div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 truncate text-sm text-muted-foreground">{item.detail}{item.subdetail ? ` · ${item.subdetail}` : ''}</p></div></button><div className="shrink-0 text-right"><p className="font-semibold">{priceLabel}</p><div className="mt-1 flex justify-end gap-2">{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#2d6a58] hover:underline">Book <ExternalLink size={11} /></a>}{onRemove && <button onClick={onRemove} aria-label={`Remove ${item.name}`} className="text-muted-foreground hover:text-foreground"><Trash2 size={13} /></button>}</div></div><span className={`grid size-5 shrink-0 place-items-center rounded-full ${selected ? 'bg-[#2d6a58] text-white' : 'border text-transparent'}`}><Check size={13} /></span></div>;
}

function StayCard({ item, selected, travellers, onSelect, onRemove }: { item: Option; selected: boolean; travellers: number; onSelect: () => void; onRemove?: () => void }) {
  return <div className={`group relative rounded-2xl border bg-white p-5 transition-all ${selected ? 'border-[#2d6a58] ring-1 ring-[#2d6a58] shadow-[0_8px_24px_rgba(27,63,52,0.08)]' : 'hover:-translate-y-0.5 hover:border-[#9bb9ad]'}`}><button onClick={onSelect} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#f4efe4] text-[#8d5b24]"><BedDouble size={18} /></div><div className="flex items-center gap-2">{item.rating && <span className="rounded-lg bg-[#f2f0ea] px-2 py-1 text-xs font-semibold">{item.rating}</span>}<span className={`grid size-5 place-items-center rounded-full ${selected ? 'bg-[#2d6a58] text-white' : 'border text-transparent'}`}><Check size={13} /></span></div></div><h3 className="mt-4 font-semibold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.detail}</p><p className="mt-3 text-xs text-muted-foreground">{item.subdetail ?? 'Added by you'}</p><div className="mt-4 flex items-end justify-between border-t pt-4"><span className="text-xs text-muted-foreground">Total stay</span><span><strong className="text-lg">{euro(item.price)}</strong><small className="ml-1 text-muted-foreground">· {euro(item.price / travellers)} pp</small></span></div></button><div className="mt-3 flex justify-end gap-3">{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#2d6a58] hover:underline">View stay <ChevronRight size={12} /></a>}{onRemove && <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>}</div></div>;
}

function PriceRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) { return <div className={`flex justify-between ${muted ? 'text-white/35' : ''}`}><span className={muted ? '' : 'text-white/60'}>{label}</span><span>{euro(value)}</span></div>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-5 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>; }
