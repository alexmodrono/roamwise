'use client';
import { StayImage } from './stay-image';

import { MapCanvas } from '@/components/map-canvas';
import { Button } from '@/components/ui/button';
import { openStreetMapUrl } from '@/lib/maps';
import {
  isDate,
  type Coordinates,
  type FlightLeg,
  type TripDocument,
} from '@/packages/core/trip-schema';
import {
  BedDouble,
  CalendarDays,
  DoorClosed,
  DoorOpen,
  Download,
  MapPin,
  Plane,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { calculateCosts } from '@/packages/core/costs';
import {
  buildItinerary,
  type DayEvent,
  type DayPlan,
} from '@/packages/core/itinerary';

import {
  activityCostText,
  categoryIcon,
  durationText,
  eventTimeText,
  linkHost,
  longDate,
  money,
  PrintLink,
  shortDate,
  time,
} from './trip-viewer-shared';
export default function FinalVersion({
  trip,
  total,
  perPerson,
  onClose,
}: {
  trip: TripDocument;
  total: number;
  perPerson: number;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [preparing, setPreparing] = useState(false);
  async function print() {
    setPreparing(true);
    const deadline = Date.now() + 15000;
    while (
      Date.now() < deadline &&
      sheet.current?.querySelector(
        '[data-map-state="loading"], [data-map-state="ready"]',
      )
    )
      await new Promise((resolve) => setTimeout(resolve, 100));
    let imageTimeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([new Promise(resolve => { imageTimeout = setTimeout(resolve, 5000); }), Promise.all(
      Array.from(sheet.current?.querySelectorAll('img') ?? []).map((img) =>
        img.decode().catch(() => {}),
      ),
    )]);
    clearTimeout(imageTimeout);
    if (!sheet.current) return;
    setPreparing(false);
    window.print();
  }
  const outbound = trip.flights.outbound.find(
    (item) => item.id === trip.selected.outbound_flight,
  );
  const returnFlight = trip.flights.return.find(
    (item) => item.id === trip.selected.return_flight,
  );
  const stay = trip.stays.find((item) => item.id === trip.selected.stay);
  const days = buildItinerary(trip)
    .map((day) => ({
      ...day,
      events: day.events.filter((event) =>
        event.kind === 'activity' || event.kind === 'flight'
          ? event.selected
          : true,
      ),
    }))
    .filter((day) => day.events.length);
  const selectedActivities = trip.activities.filter(
    (item) => trip.selected.activities.includes(item.id) && isDate(item.date),
  );
  const activitiesTotal = selectedActivities.reduce(
    (sum, item) => sum + (item.price_total ?? 0),
    0,
  );
  const paidActivities = selectedActivities.filter(
    (item) => typeof item.price_total === 'number' && item.price_total > 0,
  );
  const currency = trip.trip.currency;
  const travellers = trip.trip.travellers;
  const costs = calculateCosts(trip);

  return (
    <div
      ref={sheet}
      className="final-overlay fixed inset-0 z-[90] overflow-y-auto bg-[#eceae6] print:static print:overflow-visible print:bg-white"
    >
      <div className="no-print fixed right-5 top-5 z-10 flex gap-2">
        <Button onClick={onClose} variant="outline" className="bg-white">
          <X /> Close
        </Button>
        <Button
          disabled={preparing}
          onClick={() => void print()}
          className="bg-black text-white"
        >
          <Download /> {preparing ? 'Preparing…' : 'Save as PDF'}
        </Button>
      </div>
      <article className="print-sheet mx-auto my-10 w-[min(794px,calc(100%-32px))] overflow-hidden bg-white shadow-xl print:my-0 print:w-full print:shadow-none">
        <header className="bg-black px-12 py-10 text-white">
          <div className="flex items-end justify-between gap-8">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Final itinerary
              </p>
              <h1 className="mt-2 truncate text-4xl font-semibold tracking-[-0.05em]">
                {trip.trip.title || 'Untitled trip'}
              </h1>
              <p className="mt-3 text-sm text-white/55">
                {shortDate(trip.trip.dates.start)}–
                {shortDate(trip.trip.dates.end)} · {travellers} traveller
                {travellers === 1 ? '' : 's'}
                {trip.trip.destination.name
                  ? ` · ${trip.trip.destination.name}`
                  : ''}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-semibold">
                {money(perPerson, currency)}
              </p>
              <p className="mt-1 text-[11px] text-white/45">
                per person · known flights + stay
              </p>
            </div>
          </div>
        </header>

        <section className="px-12 pt-9">
          <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
            <Plane /> Flights
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FlightTicket
              label="Outbound"
              flight={outbound}
              currency={currency}
              travellers={travellers}
            />
            <FlightTicket
              label="Return"
              flight={returnFlight}
              currency={currency}
              travellers={travellers}
            />
          </div>
        </section>

        <section className="px-12 pt-9">
          <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
            <BedDouble /> Stay
          </h2>
          {stay ? (
            <div className="mt-4 overflow-hidden rounded-xl border">
              {stay.image && (
                <StayImage
                  loading="eager"
                  src={stay.image}
                  alt={stay.name}
                  className="h-44 w-full object-cover"
                />
              )}
              <div className="grid gap-5 p-5 sm:grid-cols-[1fr_248px]">
                <div className="min-w-0">
                  <p className="text-base font-semibold">{stay.name}</p>
                  {stay.type && (
                    <p className="mt-1 text-sm text-black/55">{stay.type}</p>
                  )}
                  {stay.address && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-black/55">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {stay.address}
                    </p>
                  )}
                  {(stay.check_in || stay.check_out) && (
                    <p className="mt-3 text-xs text-black/55">
                      {stay.check_in ? `Check-in ${stay.check_in}` : ''}
                      {stay.check_in && stay.check_out ? ' · ' : ''}
                      {stay.check_out ? `Check-out ${stay.check_out}` : ''}
                    </p>
                  )}
                  <p className="mt-3 text-sm">
                    <strong>{money(stay.price_total, currency)}</strong> total
                  </p>
                  {(stay.url || stay.address || stay.coordinates) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stay.url && (
                        <PrintLink href={stay.url}>
                          Booking · {linkHost(stay.url)}
                        </PrintLink>
                      )}
                      {(stay.address || stay.coordinates) && (
                        <PrintLink
                          href={openStreetMapUrl(
                            stay.name,
                            stay.address,
                            stay.coordinates,
                          )}
                        >
                          Map · openstreetmap.org
                        </PrintLink>
                      )}
                    </div>
                  )}
                </div>
                {stay.coordinates && (
                  <StayMap
                    coordinates={stay.coordinates}
                    name={stay.name}
                    address={stay.address}
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed p-5 text-sm text-black/40">
              Stay not selected
            </p>
          )}
        </section>

        <section className="px-12 pt-9">
          <h2 className="print-plan-heading flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
            <CalendarDays /> Daily plan
          </h2>
          <div className="mt-4 space-y-5 print:mt-0 print:space-y-0">
            {days.length ? (
              days.map((day) => (
                <FinalDayCard key={day.date} day={day} currency={currency} />
              ))
            ) : (
              <p className="text-sm text-black/45">No scheduled days yet.</p>
            )}
          </div>
        </section>

        <section className="print-costs mt-9 border-t bg-[#fafaf8] px-12 py-8 print:mt-0 print:border-t-0 print:pt-16 print:pb-12">
          <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
            <Users /> Costs
          </h2>
          {costs.unknown > 0 && (
            <p className="mt-2 text-sm">
              {costs.unknown} selected item(s) have unknown prices and are
              excluded from the subtotals.
            </p>
          )}
          <div className="mt-4 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">
                Trip · flights + stay
              </h3>
              <ul className="mt-3 divide-y divide-dashed text-sm">
                {outbound && (
                  <CostRow
                    label={`Outbound flight · ${money(outbound.price_per_person, currency)} × ${travellers}`}
                    value={money(
                      outbound.price_per_person === undefined
                        ? undefined
                        : outbound.price_per_person * travellers,
                      currency,
                    )}
                  />
                )}
                {returnFlight && (
                  <CostRow
                    label={`Return flight · ${money(returnFlight.price_per_person, currency)} × ${travellers}`}
                    value={money(
                      returnFlight.price_per_person === undefined
                        ? undefined
                        : returnFlight.price_per_person * travellers,
                      currency,
                    )}
                  />
                )}
                {stay && (
                  <CostRow
                    label={`Stay · ${stay.name}`}
                    value={money(stay.price_total, currency)}
                  />
                )}
              </ul>
              <p className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm">
                <strong>Known trip subtotal</strong>
                <span className="text-right">
                  <strong>{money(perPerson, currency)}</strong>
                  <span className="ml-2 text-xs text-black/45">
                    per person · {money(total, currency)} total
                  </span>
                </span>
              </p>
              {trip.trip.budget_per_person && costs.unknown === 0 ? (
                <p className="mt-2 text-xs text-black/45">
                  Budget {money(trip.trip.budget_per_person, currency)} per
                  person ·{' '}
                  {perPerson <= trip.trip.budget_per_person ? 'under' : 'over'}{' '}
                  by{' '}
                  {money(
                    Math.abs(trip.trip.budget_per_person - perPerson),
                    currency,
                  )}
                </p>
              ) : null}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">
                Activities and extras
              </h3>
              {paidActivities.length ? (
                <>
                  <ul className="mt-3 divide-y divide-dashed text-sm">
                    {paidActivities.map((item) => (
                      <CostRow
                        key={item.id}
                        label={item.name}
                        value={activityCostText(item, currency)}
                      />
                    ))}
                  </ul>
                  <p className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm">
                    <strong>Paid activities total</strong>
                    <strong>{money(activitiesTotal, currency)}</strong>
                  </p>
                  <p className="mt-2 text-xs text-black/45">
                    Includes only activities with a known price;
                    unpriced meals and other variable expenses are excluded.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-black/40">
                  No activities with a known price.
                </p>
              )}
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="min-w-0 truncate text-black/60">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </li>
  );
}
function FlightTicket({
  label,
  flight,
  currency,
  travellers,
}: {
  label: string;
  flight?: FlightLeg;
  currency: string;
  travellers: number;
}) {
  if (!flight)
    return (
      <div className="grid place-items-center rounded-xl border border-dashed p-6 text-sm text-black/40">
        {label} not selected
      </div>
    );
  return (
    <div className="break-inside-avoid rounded-xl border p-5">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
        <span>{label}</span>
        <span>{shortDate(flight.depart.slice(0, 10))}</span>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {flight.from}
          </p>
          <p className="mt-0.5 font-mono text-xs text-black/45">
            {time(flight.depart)}
          </p>
        </div>
        <div className="flex items-center">
          <span className="h-px flex-1 border-t border-dashed border-black/25" />
          <Plane className="mx-2 size-4 rotate-90 text-black/45" />
          <span className="h-px flex-1 border-t border-dashed border-black/25" />
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-[-0.03em]">
            {flight.to}
          </p>
          <p className="mt-0.5 font-mono text-xs text-black/45">
            {time(flight.arrive)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed pt-3 text-xs text-black/55">
        <span className="min-w-0 truncate">
          {flight.airline}
          {flight.flight_number ? ` · ${flight.flight_number}` : ''}
        </span>
        <span className="shrink-0">
          {money(flight.price_per_person, currency)} × {travellers}
        </span>
      </div>
      {flight.url && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-dashed pt-3">
          <PrintLink href={flight.url}>Book · {linkHost(flight.url)}</PrintLink>
        </div>
      )}
    </div>
  );
}
function FinalDayCard({ day, currency }: { day: DayPlan; currency: string }) {
  const activityTotal = day.events.reduce(
    (sum, event) =>
      event.kind === 'activity' ? sum + (event.activity.price_total ?? 0) : sum,
    0,
  );
  return (
    <div className="print-day break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40">
            Day {day.index}
          </span>
          <span className="text-sm font-semibold">{longDate(day.date)}</span>
        </div>
        <span className="shrink-0 text-[11px] text-black/45">
          {day.events.length} item{day.events.length === 1 ? '' : 's'}
          {activityTotal > 0 ? ` · ${money(activityTotal, currency)}` : ''}
        </span>
      </div>
      <div className="mt-2 divide-y divide-dashed rounded-xl border">
        {day.events.map((event) => (
          <FinalEventRow key={event.id} event={event} currency={currency} />
        ))}
      </div>
    </div>
  );
}
function FinalEventRow({
  event,
  currency,
}: {
  event: DayEvent;
  currency: string;
}) {
  const activityMeta =
    event.kind === 'activity'
      ? [
          durationText(event.activity.time, event.activity.end_time),
          event.activity.category,
          event.activity.address,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
  return (
    <div className="print-event grid grid-cols-[64px_28px_1fr_auto] items-start gap-3 px-4 py-3">
      <div className="font-mono text-xs leading-5 text-black/45">
        {eventTimeText(event)}
      </div>
      <div className="grid size-6 place-items-center rounded-full border bg-white text-black/60">
        {event.kind === 'flight' ? (
          <Plane size={12} />
        ) : event.kind === 'milestone' ? (
          event.icon === 'door-closed' ? (
            <DoorClosed size={12} />
          ) : event.icon === 'plane' ? (
            <Plane size={12} />
          ) : (
            <DoorOpen size={12} />
          )
        ) : (
          categoryIcon(event.activity.category, 12)
        )}
      </div>
      <div className="min-w-0">
        {event.kind === 'flight' && (
          <>
            <p className="truncate text-sm font-medium leading-5">
              {event.flight.airline}
              {event.flight.flight_number
                ? ` · ${event.flight.flight_number}`
                : ''}
            </p>
            <p className="text-xs leading-5 text-black/50">
              {event.flight.from} → {event.flight.to} · departs{' '}
              {time(event.flight.depart)} · arrives {time(event.flight.arrive)}{' '}
              · {event.direction}
            </p>
            {event.flight.url && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <PrintLink href={event.flight.url}>
                  Book · {linkHost(event.flight.url)}
                </PrintLink>
              </div>
            )}
          </>
        )}
        {event.kind === 'milestone' && (
          <>
            <p className="truncate text-sm font-medium leading-5">
              {event.label}
            </p>
            {event.detail && (
              <p className="text-xs leading-5 text-black/50">{event.detail}</p>
            )}
          </>
        )}
        {event.kind === 'activity' && (
          <>
            <p className="truncate text-sm font-medium leading-5">
              {event.activity.name}
            </p>
            {activityMeta && (
              <p className="text-xs leading-5 text-black/50">{activityMeta}</p>
            )}
            {event.activity.notes && (
              <p className="line-clamp-2 text-xs leading-5 text-black/45 italic">
                {event.activity.notes}
              </p>
            )}
            {(event.activity.url ||
              event.activity.address ||
              event.activity.coordinates) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {event.activity.url && (
                  <PrintLink href={event.activity.url}>
                    Details · {linkHost(event.activity.url)}
                  </PrintLink>
                )}
                {(event.activity.address || event.activity.coordinates) && (
                  <PrintLink
                    href={openStreetMapUrl(
                      event.activity.name,
                      event.activity.address,
                      event.activity.coordinates,
                    )}
                  >
                    Map · openstreetmap.org
                  </PrintLink>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="shrink-0 text-right text-xs text-black/55">
        {event.kind === 'activity'
          ? activityCostText(event.activity, currency)
          : event.kind === 'flight'
            ? `${money(event.flight.price_per_person, currency)} pp`
            : ''}
      </div>
    </div>
  );
}
function StayMap({
  coordinates,
  name,
  address,
}: {
  coordinates: Coordinates;
  name: string;
  address?: string;
}) {
  const points = useMemo(
    () => [
      {
        id: 'stay',
        label: name,
        detail: address,
        kind: 'stay' as const,
        coordinates,
        selected: true,
      },
    ],
    [coordinates, name, address],
  );
  return (
    <figure className="overflow-hidden rounded-xl border">
      <div className="h-44">
        <MapCanvas points={points} snapshot compact />
      </div>
      <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] text-black/45">
        <span>
          <a href="https://openfreemap.org/">OpenFreeMap</a> ·{' '}
          <a href="https://openmaptiles.org/">© OpenMapTiles</a> ·{' '}
          <a href="https://www.openstreetmap.org/copyright">
            Data from OpenStreetMap
          </a>
        </span>
        <a
          href={openStreetMapUrl(name, address, coordinates)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 underline underline-offset-2"
        >
          Open in OpenStreetMap
        </a>
      </figcaption>
    </figure>
  );
}
