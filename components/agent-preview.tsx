import { lazy, Suspense, useEffect, useState } from 'react';
import { useTripDocument } from '@/hooks/use-trip-document';
import { buildItinerary } from '@/packages/core/itinerary';
import { calculateCosts } from '@/packages/core/costs';
import { money, shortDate, eventTimeText } from './trip-viewer-shared';
import { StayImage } from './stay-image';
const TripMap = lazy(() =>
  import('./trip-map').then((module) => ({ default: module.TripMap })),
);
const Print = lazy(() => import('./trip-print'));

export default function AgentPreview({ session }: { session: string }) {
  const { trip, source, status, fileName, documentError, warnings } =
    useTripDocument({ kind: 'local', session });
  const [showMap, setShowMap] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [print, setPrint] = useState(false);
  useEffect(() => {
    const changed = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  const costs = calculateCosts(trip);
  const currency = trip.trip.currency;
  function download() {
    const url = URL.createObjectURL(
      new Blob([source], { type: 'application/yaml' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'trip.yaml';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-5 sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <strong>Roamwise</strong>
        <span role="status" className="text-sm text-black/55">
          {status}
        </span>
        <div className="flex gap-4 text-sm">
          <button onClick={download}>Download YAML</button>
          <button onClick={() => setPrint(true)}>Preview & print</button>
        </div>
      </header>
      <section>
        <p className="text-xs text-black/45">
          {fileName} · Live, read-only preview
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {trip.trip.title || 'Your trip'}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          {shortDate(trip.trip.dates.start)} – {shortDate(trip.trip.dates.end)}{' '}
          · {trip.trip.travellers} travellers · {trip.trip.destination.name}
        </p>
        <p className="mt-4 text-xl font-semibold">
          {money(costs.travelPerPerson, currency)} per person
        </p>
        <p className="text-xs text-black/55">
          Known flights + stay · Ask your agent to update the YAML to revise
          this plan.
        </p>
      </section>
      {costs.unknown > 0 && (
        <p className="text-sm text-amber-700">
          {costs.unknown} selected item(s) have unknown prices and are excluded
          from totals.
        </p>
      )}
      {trip.trip.budget_per_person && (
        <p className="text-sm">
          Budget {money(trip.trip.budget_per_person, currency)} per person
        </p>
      )}
      {documentError && (
        <p role="alert" className="rounded-xl border p-4 text-red-600">
          {documentError}
        </p>
      )}
      {!!warnings.length && (
        <details>
          <summary className="cursor-pointer text-sm">
            {warnings.length} trip notes
          </summary>
          <ul className="mt-2 text-sm">
            {warnings.map((warning, i) => (
              <li key={i}>
                {warning.path}: {warning.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Flight options</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['outbound', 'return'] as const).map((direction) => (
            <div key={direction} className="rounded-xl border p-4">
              <h3 className="mb-3 capitalize">{direction}</h3>
              {trip.flights[direction].map((flight) => (
                <div key={flight.id} className="border-t py-3 text-sm">
                  <strong>
                    {flight.airline} {flight.flight_number}
                  </strong>
                  {trip.selected[
                    direction === 'outbound'
                      ? 'outbound_flight'
                      : 'return_flight'
                  ] === flight.id && (
                    <span className="ml-2 text-xs">Selected</span>
                  )}
                  <p>
                    {flight.from} → {flight.to}
                  </p>
                  <p>
                    {flight.depart} → {flight.arrive}
                  </p>
                  <p>{money(flight.price_per_person, currency)} per person</p>
                  {flight.url && (
                    <a
                      href={flight.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Listing
                    </a>
                  )}
                </div>
              ))}
              {!trip.flights[direction].length && (
                <p className="text-sm text-black/45">No options yet</p>
              )}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Stay options</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {trip.stays.map((stay) => (
            <article
              key={stay.id}
              className="overflow-hidden rounded-xl border"
            >
              {stay.image && (
                <StayImage
                  src={stay.image}
                  alt={stay.name}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="space-y-2 p-4">
                <h3 className="font-semibold">
                  {stay.name}
                  {trip.selected.stay === stay.id && ' · Selected'}
                </h3>
                <p className="text-sm">
                  {money(stay.price_total, currency)} total · {stay.type}
                </p>
                <p className="text-sm text-black/55">{stay.address}</p>
                <details>
                  <summary className="cursor-pointer text-sm">
                    Details & photos
                  </summary>
                  <div className="space-y-2 pt-3 text-sm">
                    <p>
                      {stay.neighbourhood}{' '}
                      {stay.rating && `· Rating ${stay.rating}`}
                    </p>
                    <p>
                      {stay.bedrooms} bedrooms · {stay.bathrooms} bathrooms{' '}
                      {stay.size_m2 && `· ${stay.size_m2} m²`}
                    </p>
                    <p>
                      Check-in {stay.check_in || 'Not set'} · Check-out{' '}
                      {stay.check_out || 'Not set'}
                    </p>
                    <p className="whitespace-pre-wrap">{stay.notes}</p>
                    <p>{stay.amenities?.join(' · ')}</p>
                    <p>Pros: {stay.pros?.join(' · ')}</p>
                    <p>Cons: {stay.cons?.join(' · ')}</p>
                    <p>{stay.cancellation_policy}</p>
                    {stay.images
                      ?.filter((src) => src !== stay.image)
                      .map((src) => (
                        <StayImage
                          key={src}
                          src={src}
                          alt={stay.name}
                          className="w-full rounded-lg"
                        />
                      ))}
                  </div>
                </details>
                {stay.url && (
                  <a
                    className="inline-block text-sm underline"
                    href={stay.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View listing
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Itinerary</h2>
        <div className="space-y-4">
          {buildItinerary(trip).map((day) => (
            <article key={day.date} className="rounded-xl border p-4">
              <h3 className="font-semibold">
                Day {day.index} · {shortDate(day.date)}
              </h3>
              {day.events.map((event) => (
                <div key={event.id} className="mt-3 border-t pt-3 text-sm">
                  <span className="text-black/50">{eventTimeText(event)} </span>
                  {event.kind === 'activity' ? (
                    <>
                      <strong>{event.activity.name}</strong>
                      <p>{event.activity.address}</p>
                      <p>{event.activity.notes}</p>
                      <p>
                        {money(event.activity.price_total, currency)}
                        {event.selected && ' · Selected'}
                      </p>
                      {event.activity.url && (
                        <a
                          className="underline"
                          href={event.activity.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Details
                        </a>
                      )}
                    </>
                  ) : event.kind === 'flight' ? (
                    `${event.flight.from} → ${event.flight.to} · ${event.flight.airline}`
                  ) : (
                    `${event.label} ${event.detail || ''}`
                  )}
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
      {trip.activities.some((activity) => !activity.date) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Unscheduled activities</h2>
          {trip.activities
            .filter((activity) => !activity.date)
            .map((activity) => (
              <article key={activity.id} className="mb-3 rounded-xl border p-4">
                <strong>{activity.name}</strong>
                <p>{activity.notes}</p>
                <p>{activity.address}</p>
                <p>
                  {money(activity.price_total, currency)}
                  {trip.selected.activities.includes(activity.id) &&
                    ' · Selected'}
                </p>
                {activity.url && (
                  <a
                    href={activity.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Details
                  </a>
                )}
              </article>
            ))}
        </section>
      )}
      <section className="rounded-xl border p-4">
        <button
          className="text-sm font-medium"
          onClick={() => setShowMap((value) => !value)}
        >
          {showMap ? 'Hide map' : 'Load interactive map'}
        </button>
        {showMap && visible && (
          <div className="mt-4 h-[480px]">
            <Suspense fallback={<p role="status">Loading map…</p>}>
              <TripMap trip={trip} enrichment={false} />
            </Suspense>
          </div>
        )}
      </section>
      <details>
        <summary className="cursor-pointer text-sm">YAML source</summary>
        <pre className="mt-3 max-h-[65vh] overflow-auto rounded-xl bg-neutral-100 p-4 text-xs">
          {source}
        </pre>
      </details>
      {print && visible && (
        <Suspense fallback={<p role="status">Preparing print preview…</p>}>
          <Print
            trip={trip}
            total={costs.travel}
            perPerson={costs.travelPerPerson}
            onClose={() => setPrint(false)}
          />
        </Suspense>
      )}
    </main>
  );
}
