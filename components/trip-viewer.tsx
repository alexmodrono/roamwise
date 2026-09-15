'use client';
import { RoamwiseLogo } from './roamwise-logo';
import { apiEnabled } from '@/lib/api';
import { StayImage } from './stay-image';

import { TripMap } from '@/components/trip-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { openStreetMapUrl } from '@/lib/maps';
import {
  isDate,
  parseTrip,
  stringifyTrip,
  type Activity,
  type FlightLeg,
  type Stay,
  type TripDetails,
  type TripDocument,
} from '@/packages/core/trip-schema';
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  DoorClosed,
  DoorOpen,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Images,
  Link2,
  LoaderCircle,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Settings2,
  Star,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { TripOnboarding } from '@/components/trip-onboarding';
import { useTripDocument, type TripSource } from '@/hooks/use-trip-document';
import { calculateCosts } from '@/packages/core/costs';
import {
  buildItinerary,
  compareActivities,
  type DayEvent,
  type DayPlan,
} from '@/packages/core/itinerary';

const AddEntryDialog = lazy(() =>
  import('./trip-dialogs').then((m) => ({ default: m.AddEntryDialog })),
);
const TripSettingsDialog = lazy(() =>
  import('./trip-dialogs').then((m) => ({ default: m.TripSettingsDialog })),
);
const StayDetailsDialog = lazy(() =>
  import('./trip-dialogs').then((m) => ({ default: m.StayDetailsDialog })),
);
const DeleteEntryDialog = lazy(() =>
  import('./trip-dialogs').then((m) => ({ default: m.DeleteEntryDialog })),
);
const FinalVersion = lazy(() => import('./trip-print'));
const YamlEditor = lazy(() => import('@/components/yaml-editor'));

import {
  activityCostText,
  AddKind,
  categoryIcon,
  DeleteTarget,
  Draft,
  durationText,
  emptyDraft,
  eventTimeText,
  longDate,
  mergeFlightOptions,
  money,
  safeId,
  shortDate,
  splitList,
  time,
} from './trip-viewer-shared';
export default function TripViewer({
  documentSource = { kind: 'browser' },
}: {
  documentSource?: TripSource;
}) {
  const {
    trip,
    source,
    setSource,
    commit,
    readOnly,
    status,
    fileName,
    documentError,
    warnings,
  } = useTripDocument(documentSource);
  const [view, setView] = useState<'plan' | 'source'>('plan');
  const [sourceError, setSourceError] = useState('');
  const [link, setLink] = useState('');
  const [linkState, setLinkState] = useState<
    'idle' | 'loading' | 'done' | 'fallback'
  >('idle');
  const [linkMessage, setLinkMessage] = useState('');
  const [stayState, setStayState] = useState<'idle' | 'loading' | 'done'>(
    'idle',
  );
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [flightDirection, setFlightDirection] = useState<'outbound' | 'return'>(
    'outbound',
  );
  const [flightState, setFlightState] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle');
  const [flightError, setFlightError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [viewingStayId, setViewingStayId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<TripDetails>(trip.trip);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [finalOpen, setFinalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragActivityId, setDragActivityId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    date: string | null;
    index: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function openSettings() {
    setSettingsDraft({ ...trip.trip, dates: { ...trip.trip.dates } });
    setSettingsOpen(true);
  }

  const blank =
    !trip.trip.title &&
    !isDate(trip.trip.dates.start) &&
    !trip.activities.length &&
    !trip.stays.length &&
    !trip.flights.outbound.length &&
    !trip.flights.return.length;
  const viewingStay = trip.stays.find((item) => item.id === viewingStayId);
  const selectedActivities = trip.activities.filter((item) =>
    trip.selected.activities.includes(item.id),
  );
  const activitiesTotal = selectedActivities.reduce(
    (sum, item) => sum + (item.price_total ?? 0),
    0,
  );
  const costs = calculateCosts(trip);
  const total = costs.travel;
  const perPerson = costs.travelPerPerson;
  const itinerary = useMemo(() => buildItinerary(trip), [trip]);
  const unscheduled = useMemo(
    () => trip.activities.filter((item) => !isDate(item.date)),
    [trip.activities],
  );

  function applySource() {
    try {
      const parsed = parseTrip(source);
      commit(parsed);
      setSourceError('');
      setView('plan');
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : 'Invalid YAML');
    }
  }

  async function readTripFile(file?: File) {
    if (!file || readOnly) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error('Trip files must be smaller than 2 MiB');
      const uploadedSource = await file.text();
      setSource(uploadedSource);
      const parsed = parseTrip(uploadedSource);
      commit(parsed);
      setSourceError('');
      setView('plan');
    } catch (error) {
      setSourceError(
        error instanceof Error
          ? error.message
          : 'Could not read this trip file',
      );
      setView('source');
    }
  }

  function downloadTrip() {
    const blob = new Blob([readOnly ? source : stringifyTrip(trip)], {
      type: 'application/yaml',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      fileName || `${safeId(trip.trip.title || 'trip')}-trip.yaml`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function saveTripDetails(details: TripDetails) {
    commit({ ...trip, trip: { ...details, dates: { ...details.dates } } });
    setSettingsOpen(false);
  }

  async function importListing() {
    if (!link.trim()) return;
    setLinkState('loading');
    setLinkMessage('');
    let data: Record<string, unknown> = {};
    try {
      if (!apiEnabled) throw new Error('Manual listing');
      const response = await fetch('/api/unfurl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: link.trim(),
          start: trip.trip.dates.start,
          end: trip.trip.dates.end,
          travellers: trip.trip.travellers,
          currency: trip.trip.currency,
        }),
      });
      data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error ?? 'Import failed'));
      setLinkState('done');
      const photoCount = Array.isArray(data.images)
        ? data.images.length
        : data.image
          ? 1
          : 0;
      const loaded = [
        photoCount ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : '',
        Number(data.price) ? 'live price' : '',
        data.address ? 'location' : '',
      ].filter(Boolean);
      setLinkMessage(
        loaded.length
          ? `Loaded ${loaded.join(', ')}. Check the details before deciding.`
          : 'Listing added. Complete any details the provider did not expose.',
      );
    } catch {
      setLinkState('fallback');
      setLinkMessage(
        'The link was added as an editable entry. Fill in the listing details below.',
      );
    }
    const host = (() => {
      try {
        return new URL(link).hostname.replace('www.', '');
      } catch {
        return 'Imported stay';
      }
    })();
    const coordinate = data.coordinates as
      | { lat?: number; lng?: number }
      | undefined;
    const stay: Stay = {
      id: `${safeId(String(data.title ?? host))}-${Date.now()}`,
      name: String(data.title ?? `Stay from ${host}`),
      type: String(
        data.description ?? 'Imported listing — add any missing details',
      ),
      address: data.address ? String(data.address) : trip.trip.destination.name,
      coordinates:
        coordinate?.lat && coordinate?.lng
          ? { lat: coordinate.lat, lng: coordinate.lng }
          : undefined,
      price_total: typeof data.price === 'number' ? data.price : undefined,
      image: data.image ? String(data.image) : undefined,
      images: Array.isArray(data.images) ? data.images.map(String) : undefined,
      amenities: Array.isArray(data.amenities)
        ? data.amenities.map(String)
        : undefined,
      check_in: data.check_in ? String(data.check_in) : undefined,
      check_out: data.check_out ? String(data.check_out) : undefined,
      bedrooms: Number(data.bedrooms) || undefined,
      bathrooms: Number(data.bathrooms) || undefined,
      size_m2: Number(data.size_m2) || undefined,
      url: link.trim(),
    };
    commit({
      ...trip,
      stays: [...trip.stays, stay],
      selected: { ...trip.selected, stay: stay.id },
    });
    if (!data.title || (!data.image && !data.address)) {
      setEditingId(stay.id);
      setDraft({
        ...emptyDraft,
        name: stay.name,
        detail: stay.type ?? '',
        address: stay.address ?? '',
        price: '',
        image: '',
        url: stay.url ?? '',
      });
      setAddKind('stay');
    }
    setLink('');
    setTimeout(() => setLinkState('idle'), 2800);
  }

  function addEntry() {
    if (!addKind || !draft.name.trim()) return;
    const coordinates =
      Number.isFinite(Number(draft.lat)) &&
      Number.isFinite(Number(draft.lng)) &&
      draft.lat &&
      draft.lng
        ? { lat: Number(draft.lat), lng: Number(draft.lng) }
        : undefined;
    const id = `${safeId(draft.name)}-${Date.now()}`;
    if (addKind === 'stay') {
      const item: Stay = {
        id,
        name: draft.name,
        type: draft.detail,
        address: draft.address,
        price_total: draft.price.trim() ? Number(draft.price) : undefined,
        image: draft.image || undefined,
        url: draft.url || undefined,
        coordinates,
        notes: draft.notes || undefined,
        neighbourhood: draft.neighbourhood || undefined,
        amenities: splitList(draft.amenities),
        pros: splitList(draft.pros),
        cons: splitList(draft.cons),
        check_in: draft.checkIn || undefined,
        check_out: draft.checkOut || undefined,
        cancellation_policy: draft.cancellationPolicy || undefined,
        bedrooms: Number(draft.bedrooms) || undefined,
        bathrooms: Number(draft.bathrooms) || undefined,
        size_m2: Number(draft.size) || undefined,
      };
      if (editingId)
        commit({
          ...trip,
          stays: trip.stays.map((existing) =>
            existing.id === editingId
              ? { ...existing, ...item, id: editingId }
              : existing,
          ),
          selected: { ...trip.selected, stay: editingId },
        });
      else
        commit({
          ...trip,
          stays: [...trip.stays, item],
          selected: { ...trip.selected, stay: id },
        });
    } else if (addKind === 'activity') {
      const item: Activity = {
        id,
        name: draft.name,
        date: draft.date || undefined,
        time: draft.time || undefined,
        end_time: draft.endTime || undefined,
        category: draft.category || undefined,
        address: draft.address,
        price_total: draft.price.trim() ? Number(draft.price) : undefined,
        image: draft.image || undefined,
        url: draft.url || undefined,
        coordinates,
        notes: draft.notes || undefined,
      };
      if (editingId)
        commit({
          ...trip,
          activities: trip.activities.map((existing) =>
            existing.id === editingId
              ? { ...existing, ...item, id: editingId }
              : existing,
          ),
        });
      else
        commit({
          ...trip,
          activities: [...trip.activities, item],
          selected: {
            ...trip.selected,
            activities: [...trip.selected.activities, id],
          },
        });
    } else {
      const origin = trip.trip.origin.code ?? trip.trip.origin.name;
      const destination =
        trip.trip.destination.code ?? trip.trip.destination.name;
      const isOutbound = flightDirection === 'outbound';
      const item: FlightLeg = {
        id,
        airline: draft.name,
        flight_number: draft.detail || undefined,
        price_per_person: draft.price.trim() ? Number(draft.price) : undefined,
        url: draft.url || undefined,
        from: draft.from || (isOutbound ? origin : destination),
        to: draft.to || (isOutbound ? destination : origin),
        depart:
          draft.depart ||
          `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00`,
        arrive:
          draft.arrive ||
          `${isOutbound ? trip.trip.dates.start : trip.trip.dates.end}T00:00`,
      };
      if (editingId)
        commit({
          ...trip,
          flights: {
            ...trip.flights,
            [flightDirection]: trip.flights[flightDirection].map((existing) =>
              existing.id === editingId
                ? {
                    ...existing,
                    ...item,
                    id: editingId,
                    live: false,
                    fare_source: undefined,
                    price_updated_at: undefined,
                  }
                : existing,
            ),
          },
        });
      else
        commit({
          ...trip,
          flights: {
            ...trip.flights,
            [flightDirection]: [...trip.flights[flightDirection], item],
          },
          selected: {
            ...trip.selected,
            [isOutbound ? 'outbound_flight' : 'return_flight']: id,
          },
        });
    }
    setDraft(emptyDraft);
    setEditingId(null);
    setAddKind(null);
  }

  function toggleActivity(id: string, checked: boolean) {
    const activities = checked
      ? [...trip.selected.activities, id]
      : trip.selected.activities.filter((item) => item !== id);
    commit({
      ...trip,
      selected: { ...trip.selected, activities: [...new Set(activities)] },
    });
  }

  function moveActivity(
    id: string,
    targetDate: string | null,
    targetIndex?: number,
  ) {
    const moving = trip.activities.find((item) => item.id === id);
    if (!moving) return;
    const sourceDate = isDate(moving.date) ? moving.date! : null;
    if (sourceDate === targetDate && targetIndex == null) return;
    const activities = trip.activities.map((item) => ({ ...item }));
    const reindex = (date: string, ids: string[]) => {
      // The day's time slots stay fixed; activities adopt the slot matching their new position.
      const slots = ids
        .flatMap((activityId) => {
          const item = activities.find((entry) => entry.id === activityId);
          return item?.time ? [{ time: item.time, end: item.end_time }] : [];
        })
        .sort((a, b) => a.time.localeCompare(b.time));
      ids.forEach((activityId, position) => {
        const item = activities.find((entry) => entry.id === activityId);
        if (!item) return;
        item.date = date;
        item.order = position;
        if (item.time) {
          const slot = slots.shift();
          if (slot) {
            item.time = slot.time;
            item.end_time = slot.end;
          }
        }
      });
    };
    if (targetDate === null) {
      const moved = activities.find((item) => item.id === id);
      if (moved) {
        moved.date = undefined;
        moved.order = undefined;
      }
    } else {
      const ids = activities
        .filter((item) => item.date === targetDate && item.id !== id)
        .sort(compareActivities)
        .map((item) => item.id);
      ids.splice(
        Math.max(0, Math.min(targetIndex ?? ids.length, ids.length)),
        0,
        id,
      );
      reindex(targetDate, ids);
    }
    if (sourceDate && sourceDate !== targetDate)
      reindex(
        sourceDate,
        activities
          .filter((item) => item.date === sourceDate)
          .sort(compareActivities)
          .map((item) => item.id),
      );
    commit({ ...trip, activities });
  }

  function handleActivityDragOver(date: string | null, index: number) {
    if (!dragActivityId) return;
    setDropTarget((current) =>
      current && current.date === date && current.index === index
        ? current
        : { date, index },
    );
  }
  function handleActivityDrop() {
    if (dragActivityId && dropTarget)
      moveActivity(dragActivityId, dropTarget.date, dropTarget.index);
    setDragActivityId(null);
    setDropTarget(null);
  }
  function handleActivityDragEnd() {
    setDragActivityId(null);
    setDropTarget(null);
  }

  function editStay(item: Stay) {
    setViewingStayId(null);
    setEditingId(item.id);
    setDraft({
      ...emptyDraft,
      name: item.name,
      detail: item.type ?? '',
      address: item.address ?? '',
      price: String(item.price_total ?? ''),
      image: item.image ?? '',
      url: item.url ?? '',
      lat: item.coordinates ? String(item.coordinates.lat) : '',
      lng: item.coordinates ? String(item.coordinates.lng) : '',
      notes: item.notes ?? '',
      neighbourhood: item.neighbourhood ?? '',
      amenities: item.amenities?.join('\n') ?? '',
      pros: item.pros?.join('\n') ?? '',
      cons: item.cons?.join('\n') ?? '',
      checkIn: item.check_in ?? '',
      checkOut: item.check_out ?? '',
      cancellationPolicy: item.cancellation_policy ?? '',
      bedrooms: item.bedrooms ? String(item.bedrooms) : '',
      bathrooms: item.bathrooms ? String(item.bathrooms) : '',
      size: item.size_m2 ? String(item.size_m2) : '',
    });
    setAddKind('stay');
  }

  function editActivity(item: Activity) {
    setEditingId(item.id);
    setDraft({
      ...emptyDraft,
      name: item.name,
      address: item.address ?? '',
      price: String(item.price_total ?? ''),
      image: item.image ?? '',
      url: item.url ?? '',
      lat: item.coordinates ? String(item.coordinates.lat) : '',
      lng: item.coordinates ? String(item.coordinates.lng) : '',
      date: item.date ?? '',
      time: item.time ?? '',
      endTime: item.end_time ?? '',
      category: item.category ?? '',
      notes: item.notes ?? '',
    });
    setAddKind('activity');
  }

  function editFlight(item: FlightLeg, direction: 'outbound' | 'return') {
    setFlightDirection(direction);
    setEditingId(item.id);
    setDraft({
      ...emptyDraft,
      name: item.airline,
      detail: item.flight_number ?? '',
      price: String(item.price_per_person ?? ''),
      url: item.url ?? '',
      from: item.from,
      to: item.to,
      depart: item.depart,
      arrive: item.arrive,
    });
    setAddKind('flight');
  }

  function deleteEntry() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'stay') {
      const stays = trip.stays.filter((item) => item.id !== deleteTarget.id);
      commit({
        ...trip,
        stays,
        selected: {
          ...trip.selected,
          stay:
            trip.selected.stay === deleteTarget.id
              ? stays[0]?.id
              : trip.selected.stay,
        },
      });
      if (viewingStayId === deleteTarget.id) setViewingStayId(null);
    } else if (deleteTarget.kind === 'activity') {
      commit({
        ...trip,
        activities: trip.activities.filter(
          (item) => item.id !== deleteTarget.id,
        ),
        selected: {
          ...trip.selected,
          activities: trip.selected.activities.filter(
            (id) => id !== deleteTarget.id,
          ),
        },
      });
    } else {
      const direction = deleteTarget.direction ?? 'outbound';
      const remaining = trip.flights[direction].filter(
        (item) => item.id !== deleteTarget.id,
      );
      const selectionKey =
        direction === 'outbound' ? 'outbound_flight' : 'return_flight';
      commit({
        ...trip,
        flights: { ...trip.flights, [direction]: remaining },
        selected: {
          ...trip.selected,
          [selectionKey]:
            trip.selected[selectionKey] === deleteTarget.id
              ? remaining[0]?.id
              : trip.selected[selectionKey],
        },
      });
    }
    setDeleteTarget(null);
  }

  async function refreshFlights() {
    const origin = trip.trip.origin.code ?? trip.trip.origin.name;
    const destination =
      trip.trip.destination.code ?? trip.trip.destination.name;
    if (!origin.trim() || !destination.trim()) {
      setFlightError('Add your origin and destination in trip details first.');
      setFlightState('error');
      return;
    }
    setFlightState('loading');
    setFlightError('');
    try {
      const response = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          start: trip.trip.dates.start,
          end: trip.trip.dates.end,
          currency: trip.trip.currency,
        }),
      });
      const data = (await response.json()) as TripDocument['flights'] & {
        error?: string;
        detail?: string;
      };
      if (!response.ok)
        throw new Error([data.error, data.detail].filter(Boolean).join(' '));
      const outbound = mergeFlightOptions(
        trip.flights.outbound,
        data.outbound ?? [],
      );
      const returns = mergeFlightOptions(
        trip.flights.return,
        data.return ?? [],
      );
      commit({
        ...trip,
        flights: {
          provider: data.provider,
          updated_at: data.updated_at,
          outbound,
          return: returns,
        },
        selected: {
          ...trip.selected,
          outbound_flight:
            trip.selected.outbound_flight ?? data.outbound?.[0]?.id,
          return_flight: trip.selected.return_flight ?? data.return?.[0]?.id,
        },
      });
      setFlightState('done');
      setTimeout(() => setFlightState('idle'), 2500);
    } catch (error) {
      setFlightError(
        error instanceof Error
          ? error.message
          : 'Live fares are temporarily unavailable.',
      );
      setFlightState('error');
    }
  }

  async function refreshStays(base = trip, visible = true) {
    if (visible) setStayState('loading');
    const refreshed = await Promise.all(
      base.stays.map(async (stay) => {
        if (!stay.url) return stay;
        try {
          const response = await fetch('/api/unfurl', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              url: stay.url,
              start: base.trip.dates.start,
              end: base.trip.dates.end,
              travellers: base.trip.travellers,
              currency: base.trip.currency,
            }),
          });
          if (!response.ok) return stay;
          const data = (await response.json()) as Record<string, unknown>;
          const coordinate = data.coordinates as
            | { lat?: number; lng?: number }
            | undefined;
          return {
            ...stay,
            name: data.title ? String(data.title) : stay.name,
            type: data.description ? String(data.description) : stay.type,
            address: data.address ? String(data.address) : stay.address,
            image: data.image ? String(data.image) : stay.image,
            images:
              Array.isArray(data.images) && data.images.length
                ? data.images.map(String)
                : stay.images,
            amenities:
              Array.isArray(data.amenities) && data.amenities.length
                ? data.amenities.map(String)
                : stay.amenities,
            check_in: data.check_in ? String(data.check_in) : stay.check_in,
            check_out: data.check_out ? String(data.check_out) : stay.check_out,
            bedrooms: Number(data.bedrooms) || stay.bedrooms,
            bathrooms: Number(data.bathrooms) || stay.bathrooms,
            size_m2: Number(data.size_m2) || stay.size_m2,
            coordinates:
              coordinate?.lat && coordinate?.lng
                ? { lat: coordinate.lat, lng: coordinate.lng }
                : stay.coordinates,
            price_total: Number(data.price) || stay.price_total,
          };
        } catch {
          return stay;
        }
      }),
    );
    const next = { ...base, stays: refreshed };
    commit(next);
    if (visible) {
      setStayState('done');
      setTimeout(() => setStayState('idle'), 2200);
    }
  }

  return (
    <main
      onDragStartCapture={(event) => {
        if (readOnly) event.preventDefault();
      }}
      onDragOver={(event) => {
        if (readOnly || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (readOnly || !event.dataTransfer.files.length) return;
        event.preventDefault();
        setDragging(false);
        void readTripFile(event.dataTransfer.files[0]);
      }}
      className={`planner-ui min-h-screen bg-[#f7f8fa] text-[#20242c] ${finalOpen ? 'final-mode' : ''}`}
    >
      {dragging && (
        <div className="fixed inset-3 z-[100] grid place-items-center rounded-2xl border-2 border-dashed border-blue-600 bg-blue-50/95">
          <div className="text-center">
            <Upload className="mx-auto mb-3 text-blue-600" />
            <p className="font-semibold">Drop a .trip.yaml file</p>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-black text-white">
              <MapPin size={16} />
            </div>
            <a href="/" aria-label="Roamwise home" className="flex items-center gap-2 font-semibold tracking-tight"><RoamwiseLogo className="size-7" />Roamwise</a>
            <span className="hidden max-w-48 truncate text-sm text-black/45 xl:inline">
              / {trip.trip.title || 'New trip'}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            <div className="mr-1 flex rounded-lg bg-[#f1f3f5] p-1">
              <button
                onClick={() => setView('plan')}
                aria-pressed={view === 'plan'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'plan' ? 'bg-white shadow-sm' : 'text-black/50'}`}
              >
                Plan
              </button>
              <button
                onClick={() => setView('source')}
                aria-pressed={view === 'source'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'source' ? 'bg-white shadow-sm' : 'text-black/50'}`}
              >
                <Code2 className="mr-1 inline size-3" /> YAML
              </button>
            </div>
            <Button
              aria-label="Trip details"
              title="Trip details"
              disabled={readOnly}
              onClick={openSettings}
              variant="ghost"
              size="sm"
            >
              <Settings2 />{' '}
              <span className="hidden sm:inline">Trip details</span>
            </Button>
            <Button
              aria-label="Load trip file"
              title="Load trip file"
              disabled={readOnly}
              onClick={() => fileInput.current?.click()}
              variant="ghost"
              size="sm"
            >
              <Upload /> <span className="hidden sm:inline">Load</span>
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".yaml,.yml,text/yaml"
              className="hidden"
              onChange={(event) => void readTripFile(event.target.files?.[0])}
            />
            <Button
              aria-label="Download trip file"
              title="Download trip file"
              onClick={downloadTrip}
              variant="ghost"
              size="sm"
            >
              <Download /> <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              onClick={() => setFinalOpen(true)}
              size="sm"
              className="bg-black text-white hover:bg-black/75"
            >
              <FileText />{' '}
              <span className="hidden sm:inline">Preview & print</span>
              <span className="sm:hidden">Preview</span>
            </Button>
          </div>
        </div>
      </header>

      {readOnly && (
        <output className="block border-b bg-blue-50 px-6 py-3 text-sm text-blue-950">
          <strong>{fileName || 'Local trip'}</strong> · {status} · Edit the YAML
          in your agent or editor to update this preview.
        </output>
      )}
      {(documentError || sourceError) && (
        <pre
          role="alert"
          className="mx-4 my-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {documentError || sourceError}
        </pre>
      )}
      {warnings.length > 0 && (
        <details className="mx-4 my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer">
            {warnings.length} trip notes · missing prices, locations, or other
            details
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {warnings.map((warning, index) => (
              <li key={index}>
                {warning.path}: {warning.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <fieldset
          disabled={readOnly && view === 'plan'}
          className="min-w-0 px-4 py-6 sm:px-6 lg:min-h-[calc(100vh-64px)] lg:border-r lg:px-8"
        >
          {view === 'source' ? (
            <SourceEditor
              readOnly={readOnly}
              source={source}
              setSource={setSource}
              error={sourceError}
              onApply={applySource}
              onDownload={downloadTrip}
            />
          ) : blank ? (
            <div className="mx-auto max-w-2xl">
              <TripOnboarding
                onLoad={() => fileInput.current?.click()}
                onBlank={openSettings}
                onPaste={() => {
                  setSource('');
                  setView('source');
                }}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              <div className="flex flex-col justify-between gap-5 border-b border-black/5 pb-6">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-black/40">
                    Trip plan
                  </p>
                  <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-[-0.04em]">
                    {trip.trip.title || 'Untitled trip'}
                    <button
                      type="button"
                      onClick={openSettings}
                      aria-label="Edit trip details"
                      title="Edit trip details"
                      className="text-black/30 transition hover:text-black"
                    >
                      <Pencil size={18} />
                    </button>
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-black/50">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={14} />{' '}
                      {shortDate(trip.trip.dates.start)}–
                      {shortDate(trip.trip.dates.end)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} /> {trip.trip.travellers} travellers
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />{' '}
                      {trip.trip.destination.name || 'Destination not set'}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-black/5 bg-white px-5 py-4 text-left">
                  <p className="text-3xl font-semibold tracking-[-0.04em]">
                    {money(perPerson, trip.trip.currency)}
                  </p>
                  <p className="text-xs text-black/45">
                    per person · {money(total, trip.trip.currency)} known
                    subtotal · flights + stay
                  </p>
                  {costs.unknown > 0 && (
                    <p className="mt-1 text-sm text-amber-700">
                      {costs.unknown} selected item(s) have no price yet
                    </p>
                  )}
                  {activitiesTotal > 0 && (
                    <p className="mt-1 text-xs text-black/45">
                      + {money(activitiesTotal, trip.trip.currency)} in selected
                      activities
                    </p>
                  )}
                  {trip.trip.budget_per_person && costs.unknown === 0 ? (
                    <p className="mt-1 text-xs text-black/45">
                      Budget{' '}
                      {money(trip.trip.budget_per_person, trip.trip.currency)} ·{' '}
                      {perPerson <= trip.trip.budget_per_person
                        ? 'under'
                        : 'over'}{' '}
                      by{' '}
                      {money(
                        Math.abs(trip.trip.budget_per_person - perPerson),
                        trip.trip.currency,
                      )}
                    </p>
                  ) : null}
                </div>
              </div>

              <nav aria-label="Trip sections" className="flex flex-wrap gap-2">
                {[
                  ['flights', 'Flights'],
                  ['stays', 'Stays'],
                  ['itinerary', 'Itinerary'],
                  ['trip-map', 'Map'],
                ].map(([id, label]) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document
                        .getElementById(id)
                        ?.scrollIntoView({ block: 'start' });
                    }}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/65 hover:border-black/25 hover:text-black"
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <section id="flights" className="planner-section">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <Plane size={17} />
                      Flights
                    </h2>
                    <p className="mt-1 text-xs text-black/40">
                      {trip.flights.provider
                        ? `Source: ${trip.flights.provider}`
                        : 'Add a flight or retrieve live fares'}
                      {trip.flights.updated_at
                        ? ` · checked ${new Date(trip.flights.updated_at).toISOString().slice(11, 16)} UTC`
                        : ''}
                    </p>
                  </div>
                  <Button
                    onClick={() => void refreshFlights()}
                    disabled={!apiEnabled || flightState === 'loading'}
                    title={
                      !apiEnabled
                        ? 'Live fares require the optional API service'
                        : undefined
                    }
                    variant="outline"
                    size="sm"
                  >
                    {flightState === 'loading' ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Download />
                    )}{' '}
                    {flightState === 'done' ? 'Updated' : 'Refresh live'}
                  </Button>
                </div>
                {flightState === 'error' && (
                  <p className="mb-3 text-xs text-red-600">
                    {flightError ||
                      'No live fares were returned. Your existing options are unchanged.'}
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <FlightGroup
                    title="Outbound"
                    direction="outbound"
                    items={trip.flights.outbound}
                    selected={trip.selected.outbound_flight}
                    currency={trip.trip.currency}
                    onSelect={(id) =>
                      commit({
                        ...trip,
                        selected: { ...trip.selected, outbound_flight: id },
                      })
                    }
                    onEdit={editFlight}
                    onDelete={(item) =>
                      setDeleteTarget({
                        kind: 'flight',
                        id: item.id,
                        name: item.flight_number ?? item.airline,
                        direction: 'outbound',
                      })
                    }
                    onAdd={() => {
                      setEditingId(null);
                      setFlightDirection('outbound');
                      setDraft(emptyDraft);
                      setAddKind('flight');
                    }}
                  />
                  <FlightGroup
                    title="Return"
                    direction="return"
                    items={trip.flights.return}
                    selected={trip.selected.return_flight}
                    currency={trip.trip.currency}
                    onSelect={(id) =>
                      commit({
                        ...trip,
                        selected: { ...trip.selected, return_flight: id },
                      })
                    }
                    onEdit={editFlight}
                    onDelete={(item) =>
                      setDeleteTarget({
                        kind: 'flight',
                        id: item.id,
                        name: item.flight_number ?? item.airline,
                        direction: 'return',
                      })
                    }
                    onAdd={() => {
                      setEditingId(null);
                      setFlightDirection('return');
                      setDraft(emptyDraft);
                      setAddKind('flight');
                    }}
                  />
                </div>
              </section>

              <Section
                title="Stays"
                icon={<BedDouble size={17} />}
                action={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                  setAddKind('stay');
                }}
              >
                <div className="mb-3 flex gap-2">
                  <Input
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    onKeyDown={(event) =>
                      event.key === 'Enter' && void importListing()
                    }
                    placeholder="Paste an Airbnb or Booking.com link"
                    className="h-10"
                  />
                  <Button
                    onClick={() => void importListing()}
                    disabled={linkState === 'loading'}
                    className="h-10 bg-black text-white"
                  >
                    <span className="hidden sm:inline">Import listing</span>
                    {linkState === 'loading' ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Link2 />
                    )}
                  </Button>
                </div>
                <div className="mb-3 flex min-h-5 items-center justify-between gap-3">
                  {linkState === 'done' ? (
                    <p className="text-xs text-green-700">{linkMessage}</p>
                  ) : linkState === 'fallback' ? (
                    <p className="text-xs text-amber-700">{linkMessage}</p>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => void refreshStays()}
                    disabled={!apiEnabled || stayState === 'loading'}
                    title={
                      !apiEnabled
                        ? 'Listing refresh requires the optional API service'
                        : undefined
                    }
                    className="shrink-0 text-xs text-black/45 hover:text-black"
                  >
                    {stayState === 'loading'
                      ? 'Refreshing…'
                      : stayState === 'done'
                        ? 'Details refreshed'
                        : 'Refresh stay details'}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {trip.stays.map((item) => (
                    <PreviewCard
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
                        {
                          icon: <BedDouble />,
                          label: item.neighbourhood ?? item.type ?? 'Stay',
                        },
                        {
                          icon: <Star />,
                          label: item.rating
                            ? `${item.rating} rating`
                            : 'Not rated',
                        },
                      ]}
                      onSelect={() =>
                        commit({
                          ...trip,
                          selected: { ...trip.selected, stay: item.id },
                        })
                      }
                      actions={
                        <>
                          <EntryAction
                            label="Details"
                            onClick={() => setViewingStayId(item.id)}
                            icon={<BookOpen />}
                          />
                          <EntryAction
                            label="Edit"
                            onClick={() => editStay(item)}
                            icon={<Pencil />}
                          />
                          <EntryAction
                            label="Delete"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'stay',
                                id: item.id,
                                name: item.name,
                              })
                            }
                            icon={<Trash2 />}
                            destructive
                          />
                          {(item.coordinates || item.address) && (
                            <External
                              item={openStreetMapUrl(
                                item.name,
                                item.address,
                                item.coordinates,
                              )}
                              label="Open in OpenStreetMap"
                              icon={<MapPin size={14} />}
                            />
                          )}
                          {item.url && (
                            <External item={item.url} label="Stay listing" />
                          )}
                        </>
                      }
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="Itinerary"
                icon={<CalendarDays size={17} />}
                action={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                  setAddKind('activity');
                }}
              >
                {itinerary.length || unscheduled.length ? (
                  <div className="space-y-4">
                    {itinerary.map((day) => (
                      <DayCard
                        key={day.date}
                        day={day}
                        currency={trip.trip.currency}
                        onToggleActivity={toggleActivity}
                        onEditActivity={editActivity}
                        onDeleteActivity={(item) =>
                          setDeleteTarget({
                            kind: 'activity',
                            id: item.id,
                            name: item.name,
                          })
                        }
                        onEditFlight={editFlight}
                        onDeleteFlight={(item, direction) =>
                          setDeleteTarget({
                            kind: 'flight',
                            id: item.id,
                            name: item.flight_number ?? item.airline,
                            direction,
                          })
                        }
                        onSelectFlight={(item, direction) =>
                          commit({
                            ...trip,
                            selected: {
                              ...trip.selected,
                              [direction === 'outbound'
                                ? 'outbound_flight'
                                : 'return_flight']: item.id,
                            },
                          })
                        }
                        onAddForDay={() => {
                          setEditingId(null);
                          setDraft({ ...emptyDraft, date: day.date });
                          setAddKind('activity');
                        }}
                        dragActivityId={dragActivityId}
                        dropTarget={dropTarget}
                        onActivityDragStart={setDragActivityId}
                        onActivityDragEnd={handleActivityDragEnd}
                        onActivityDragOver={handleActivityDragOver}
                        onActivityDrop={handleActivityDrop}
                      />
                    ))}
                    {unscheduled.length > 0 && (
                      <UnscheduledPool
                        items={unscheduled}
                        currency={trip.trip.currency}
                        selectedIds={trip.selected.activities}
                        onToggle={toggleActivity}
                        onSchedule={editActivity}
                        onDelete={(item) =>
                          setDeleteTarget({
                            kind: 'activity',
                            id: item.id,
                            name: item.name,
                          })
                        }
                        dragActivityId={dragActivityId}
                        dropTarget={dropTarget}
                        onActivityDragStart={setDragActivityId}
                        onActivityDragEnd={handleActivityDragEnd}
                        onActivityDragOver={handleActivityDragOver}
                        onActivityDrop={handleActivityDrop}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setDraft(emptyDraft);
                      setAddKind('activity');
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-dashed p-5 text-left text-sm text-black/45 hover:bg-[#fafafa]"
                  >
                    <span>
                      Add restaurants, tickets, tours or anything with a time
                      and location.
                    </span>
                    <Plus size={16} />
                  </button>
                )}
              </Section>

              <button
                onClick={() => setView('source')}
                className="flex w-full items-center justify-between rounded-xl bg-[#f4f4f4] p-4 text-left"
              >
                <span>
                  <strong className="block text-sm">
                    Portable trip source
                  </strong>
                  <small className="mt-1 block text-black/45">
                    Edit, download or ask a coding agent to generate roamwise/v2
                    YAML.
                  </small>
                </span>
                <Code2 size={18} />
              </button>
            </div>
          )}
        </fieldset>
        <aside
          id="trip-map"
          className="scroll-mt-32 h-[56vh] overflow-hidden border-t lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] lg:border-t-0"
        >
          <TripMap trip={trip} enrichment={!readOnly && apiEnabled} />
        </aside>
      </div>

      {addKind && (
        <Suspense fallback={<p role="status">Loading…</p>}>
          <AddEntryDialog
            kind={addKind}
            editing={Boolean(editingId)}
            draft={draft}
            setDraft={setDraft}
            onClose={() => {
              setAddKind(null);
              setEditingId(null);
            }}
            onAdd={addEntry}
          />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={<p role="status">Loading…</p>}>
          <TripSettingsDialog
            open={settingsOpen}
            form={settingsDraft}
            setForm={setSettingsDraft}
            onClose={() => setSettingsOpen(false)}
            onSave={saveTripDetails}
          />
        </Suspense>
      )}
      {viewingStay && (
        <Suspense fallback={<p role="status">Loading…</p>}>
          <StayDetailsDialog
            stay={viewingStay}
            currency={trip.trip.currency}
            onClose={() => setViewingStayId(null)}
            onEdit={editStay}
          />
        </Suspense>
      )}
      {deleteTarget && (
        <Suspense fallback={<p role="status">Loading…</p>}>
          <DeleteEntryDialog
            target={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={deleteEntry}
          />
        </Suspense>
      )}
      {finalOpen && (
        <Suspense fallback={<p role="status">Preparing itinerary…</p>}>
          <FinalVersion
            trip={trip}
            total={total}
            perPerson={perPerson}
            onClose={() => setFinalOpen(false)}
          />
        </Suspense>
      )}
    </main>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={title.toLowerCase()} className="planner-section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </h2>
        <Button onClick={action} variant="ghost" size="sm">
          <Plus /> Add
        </Button>
      </div>
      {children}
    </section>
  );
}
function FlightGroup({
  title,
  direction,
  items,
  selected,
  currency,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
}: {
  title: string;
  direction: 'outbound' | 'return';
  items: FlightLeg[];
  selected?: string;
  currency: string;
  onSelect: (id: string) => void;
  onEdit: (item: FlightLeg, direction: 'outbound' | 'return') => void;
  onDelete: (item: FlightLeg) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-black/40">
          {title}
        </h3>
        <button
          onClick={onAdd}
          className="text-xs text-black/45 hover:text-black"
        >
          + Add
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const isSelected = selected === item.id;
          return (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-xl border bg-white transition-colors ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/15' : 'border-black/10 hover:border-black/25'}`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(item.id)}
                className="block w-full p-4 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-black text-white">
                      <Plane size={13} />
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {item.airline}
                    </span>
                    {item.live ? (
                      <Badge
                        title={item.fare_source}
                        className="h-5 rounded-full bg-green-50 px-2 text-[10px] text-green-700 hover:bg-green-50"
                      >
                        Live fare
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="h-5 rounded-full px-2 text-[10px]"
                      >
                        Manual
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-[11px] tracking-wider text-black/45">
                    {item.flight_number ?? 'FLIGHT'}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-[-0.04em]">
                      {item.from}
                    </p>
                    <p className="mt-0.5 text-xs text-black/45">
                      {time(item.depart)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span className="h-px flex-1 border-t border-dashed border-black/25" />
                    <Plane className="mx-2 size-4 rotate-90 text-black/45" />
                    <span className="h-px flex-1 border-t border-dashed border-black/25" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-[-0.04em]">
                      {item.to}
                    </p>
                    <p className="mt-0.5 text-xs text-black/45">
                      {time(item.arrive)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-black/40">
                  <span>{shortDate(item.depart.slice(0, 10))}</span>
                  <span>
                    {direction === 'outbound' ? 'Outbound' : 'Return'} · per
                    person
                  </span>
                </div>
              </button>
              <div className="relative flex items-center justify-between border-t border-black/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SelectDot selected={isSelected} />
                  <span className="text-xs text-black/55">
                    {isSelected ? 'Selected' : 'Option'}
                  </span>
                  <strong className="text-sm">
                    {money(item.price_per_person, currency)}
                  </strong>
                </div>
                <div className="flex items-center gap-1">
                  <EntryAction
                    label="Edit"
                    onClick={() => onEdit(item, direction)}
                    icon={<Pencil />}
                  />
                  <EntryAction
                    label="Delete"
                    onClick={() => onDelete(item)}
                    icon={<Trash2 />}
                    destructive
                  />
                  {item.url && (
                    <External
                      item={item.url}
                      label={`${title} flight listing`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!items.length && (
          <button
            onClick={onAdd}
            className="w-full rounded-2xl border border-dashed p-5 text-sm text-black/40"
          >
            Add a {title.toLowerCase()} option
          </button>
        )}
      </div>
    </div>
  );
}
function SelectDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`grid size-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-black bg-black text-white' : 'text-transparent'}`}
    >
      <Check size={12} />
    </span>
  );
}
function External({
  item,
  label,
  icon,
}: {
  item: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <a
      href={item}
      onClick={(event) => event.stopPropagation()}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-black/50 hover:bg-black/5 hover:text-black"
    >
      {icon ?? <ExternalLink size={14} />}
    </a>
  );
}
function EntryAction({
  label,
  onClick,
  icon,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center gap-1.5 min-h-9 min-w-9 justify-center rounded-lg px-2 py-2 text-xs font-medium transition [&_svg]:size-3.5 ${destructive ? 'text-black/35 hover:bg-red-50 hover:text-red-600' : 'text-black/45 hover:bg-black/5 hover:text-black'}`}
    >
      {icon}
      <span className={label === 'Delete' ? 'sr-only' : 'hidden sm:inline'}>
        {label}
      </span>
    </button>
  );
}

function eventDotClass(event: DayEvent) {
  if (event.kind === 'flight') return 'bg-black';
  if (event.kind === 'milestone') return 'bg-blue-600';
  return 'bg-amber-600';
}
function DayCard({
  day,
  currency,
  onToggleActivity,
  onEditActivity,
  onDeleteActivity,
  onEditFlight,
  onDeleteFlight,
  onSelectFlight,
  onAddForDay,
  dragActivityId,
  dropTarget,
  onActivityDragStart,
  onActivityDragEnd,
  onActivityDragOver,
  onActivityDrop,
}: {
  day: DayPlan;
  currency: string;
  onToggleActivity: (id: string, checked: boolean) => void;
  onEditActivity: (item: Activity) => void;
  onDeleteActivity: (item: Activity) => void;
  onEditFlight: (item: FlightLeg, direction: 'outbound' | 'return') => void;
  onDeleteFlight: (item: FlightLeg, direction: 'outbound' | 'return') => void;
  onSelectFlight: (item: FlightLeg, direction: 'outbound' | 'return') => void;
  onAddForDay: () => void;
  dragActivityId: string | null;
  dropTarget: { date: string | null; index: number } | null;
  onActivityDragStart: (id: string) => void;
  onActivityDragEnd: () => void;
  onActivityDragOver: (date: string | null, index: number) => void;
  onActivityDrop: () => void;
}) {
  const plannedCost = day.events.reduce(
    (sum, event) =>
      event.kind === 'activity' && event.selected
        ? sum + (event.activity.price_total ?? 0)
        : sum,
    0,
  );
  const activityEvents = day.events.filter(
    (event) => event.kind === 'activity',
  );
  const dropHere = dropTarget?.date === day.date ? dropTarget.index : null;
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-[#fafbfc] px-4 py-3.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="shrink-0 rounded-md bg-[#edf1f6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60">
            Day {day.index}
          </span>
          <h3 className="truncate text-sm font-semibold">
            {longDate(day.date)}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {plannedCost > 0 && (
            <span className="text-xs text-black/45">
              {money(plannedCost, currency)} in activities
            </span>
          )}
          <button
            type="button"
            onClick={onAddForDay}
            className="text-xs text-black/45 hover:text-black"
          >
            + Add
          </button>
        </div>
      </div>
      <ol
        className={`divide-y divide-dashed ${dropHere != null && dropHere >= activityEvents.length && day.events.length ? 'shadow-[inset_0_-2px_0_0_#2563eb]' : ''}`}
        onDragOver={(event) => {
          if (!dragActivityId) return;
          event.preventDefault();
          onActivityDragOver(day.date, activityEvents.length);
        }}
        onDrop={(event) => {
          if (!dragActivityId) return;
          event.preventDefault();
          onActivityDrop();
        }}
      >
        {day.events.map((event) => {
          const activityIndex =
            event.kind === 'activity'
              ? activityEvents.findIndex((item) => item.id === event.id)
              : -1;
          return (
            <li
              key={event.id}
              draggable={activityIndex >= 0}
              onDragStart={
                activityIndex >= 0
                  ? (dragEvent) => {
                      dragEvent.dataTransfer.effectAllowed = 'move';
                      dragEvent.dataTransfer.setData('text/plain', event.id);
                      onActivityDragStart(event.id);
                    }
                  : undefined
              }
              onDragEnd={activityIndex >= 0 ? onActivityDragEnd : undefined}
              onDragOver={
                activityIndex >= 0
                  ? (dragEvent) => {
                      if (!dragActivityId) return;
                      dragEvent.preventDefault();
                      dragEvent.stopPropagation();
                      const rect =
                        dragEvent.currentTarget.getBoundingClientRect();
                      onActivityDragOver(
                        day.date,
                        activityIndex +
                          (dragEvent.clientY < rect.top + rect.height / 2
                            ? 0
                            : 1),
                      );
                    }
                  : undefined
              }
              onDrop={
                activityIndex >= 0
                  ? (dragEvent) => {
                      if (!dragActivityId) return;
                      dragEvent.preventDefault();
                      dragEvent.stopPropagation();
                      onActivityDrop();
                    }
                  : undefined
              }
              className={`flex gap-4 px-5 py-3.5 ${activityIndex >= 0 ? 'cursor-grab active:cursor-grabbing' : ''} ${event.id === dragActivityId ? 'opacity-40' : ''} ${dropHere === activityIndex && activityIndex >= 0 ? 'shadow-[inset_0_2px_0_0_#2563eb]' : ''}`}
            >
              <div className="w-16 shrink-0 pt-0.5 text-right font-mono text-[11px] leading-5 text-black/45">
                {eventTimeText(event)}
              </div>
              <div className="flex flex-col items-center self-stretch">
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${eventDotClass(event)}`}
                />
                <span className="w-px flex-1 bg-black/10" />
              </div>
              <div className="min-w-0 flex-1">
                {event.kind === 'flight' && (
                  <div
                    className={`flex items-start justify-between gap-3 ${event.selected ? '' : 'opacity-55'}`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Plane size={14} className="shrink-0 text-black/45" />
                        {event.flight.flight_number ?? event.flight.airline}
                        <span className="truncate text-xs font-normal text-black/45">
                          {event.flight.airline}
                        </span>
                        {!event.selected && (
                          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-black/45">
                            Alternative
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-black/50">
                        {event.flight.from} {time(event.flight.depart)} →{' '}
                        {event.flight.to} {time(event.flight.arrive)} ·{' '}
                        {money(event.flight.price_per_person, currency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectFlight(event.flight, event.direction)
                        }
                        aria-label={
                          event.selected
                            ? 'Selected flight'
                            : 'Select this flight'
                        }
                        aria-pressed={event.selected}
                        title={
                          event.selected
                            ? 'Selected flight'
                            : 'Select this flight'
                        }
                        className={`rounded p-1 transition [&_svg]:size-4 ${event.selected ? 'text-black hover:bg-black/5' : 'text-black/30 hover:bg-black/5 hover:text-black'}`}
                      >
                        <CheckCircle2 />
                      </button>
                      <EntryAction
                        label="Edit flight"
                        onClick={() =>
                          onEditFlight(event.flight, event.direction)
                        }
                        icon={<Pencil />}
                      />
                      <EntryAction
                        label="Delete flight"
                        onClick={() =>
                          onDeleteFlight(event.flight, event.direction)
                        }
                        icon={<Trash2 />}
                        destructive
                      />
                      {event.flight.url && (
                        <External
                          item={event.flight.url}
                          label="Flight listing"
                        />
                      )}
                    </div>
                  </div>
                )}
                {event.kind === 'milestone' && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {event.icon === 'door-closed' ? (
                          <DoorClosed
                            size={14}
                            className="shrink-0 text-blue-600"
                          />
                        ) : event.icon === 'plane' ? (
                          <Plane size={14} className="shrink-0 text-black/35" />
                        ) : (
                          <DoorOpen
                            size={14}
                            className="shrink-0 text-blue-600"
                          />
                        )}
                        {event.label}
                      </p>
                      {event.detail && (
                        <p className="mt-1 pl-6 text-xs text-black/40">
                          {event.detail}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {event.kind === 'activity' && (
                  <div
                    className={`flex items-start justify-between gap-3 ${event.selected ? '' : 'opacity-55'}`}
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {categoryIcon(event.activity.category)}
                        {event.activity.name}
                        {durationText(
                          event.activity.time,
                          event.activity.end_time,
                        ) && (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-black/45">
                            {durationText(
                              event.activity.time,
                              event.activity.end_time,
                            )}
                          </span>
                        )}
                        {!event.activity.time && (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-black/45">
                            All day
                          </span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-black/45">
                        {event.activity.address && (
                          <span className="line-clamp-1">
                            {event.activity.address}
                          </span>
                        )}
                        <span>
                          {activityCostText(event.activity, currency)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <GripVertical
                        size={14}
                        className="mr-0.5 text-black/25"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onToggleActivity(event.activity.id, !event.selected)
                        }
                        aria-label={
                          event.selected
                            ? 'Deselect activity'
                            : 'Select activity'
                        }
                        aria-pressed={event.selected}
                        className={`rounded p-1 transition [&_svg]:size-4 ${event.selected ? 'text-black hover:bg-black/5' : 'text-black/30 hover:bg-black/5 hover:text-black'}`}
                      >
                        <CheckCircle2 />
                      </button>
                      <EntryAction
                        label="Edit"
                        onClick={() => onEditActivity(event.activity)}
                        icon={<Pencil />}
                      />
                      <EntryAction
                        label="Delete"
                        onClick={() => onDeleteActivity(event.activity)}
                        icon={<Trash2 />}
                        destructive
                      />
                      {(event.activity.coordinates ||
                        event.activity.address) && (
                        <External
                          item={openStreetMapUrl(
                            event.activity.name,
                            event.activity.address,
                            event.activity.coordinates,
                          )}
                          label="Open in OpenStreetMap"
                          icon={<MapPin size={14} />}
                        />
                      )}
                      {event.activity.url && (
                        <External
                          item={event.activity.url}
                          label="Activity listing"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {!day.events.length && (
          <li
            className={`px-5 py-4 text-sm ${dropHere != null ? 'bg-blue-50 text-blue-700' : 'text-black/35'}`}
          >
            {dropHere != null
              ? 'Drop the activity here.'
              : 'Nothing planned for this day yet.'}
          </li>
        )}
      </ol>
    </div>
  );
}

function UnscheduledPool({
  items,
  currency,
  selectedIds,
  onToggle,
  onSchedule,
  onDelete,
  dragActivityId,
  dropTarget,
  onActivityDragStart,
  onActivityDragEnd,
  onActivityDragOver,
  onActivityDrop,
}: {
  items: Activity[];
  currency: string;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onSchedule: (item: Activity) => void;
  onDelete: (item: Activity) => void;
  dragActivityId: string | null;
  dropTarget: { date: string | null; index: number } | null;
  onActivityDragStart: (id: string) => void;
  onActivityDragEnd: () => void;
  onActivityDragOver: (date: string | null, index: number) => void;
  onActivityDrop: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed bg-white p-4 transition ${dragActivityId && dropTarget?.date === null ? 'border-blue-600 bg-blue-50/50' : ''}`}
      onDragOver={(event) => {
        if (!dragActivityId) return;
        event.preventDefault();
        onActivityDragOver(null, 0);
      }}
      onDrop={(event) => {
        if (!dragActivityId) return;
        event.preventDefault();
        onActivityDrop();
      }}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-black/40">
        Unscheduled · {items.length}
      </p>
      <ul className="space-y-2">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <li
              key={item.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
                onActivityDragStart(item.id);
              }}
              onDragEnd={onActivityDragEnd}
              className={`flex cursor-grab items-center justify-between gap-3 rounded-xl bg-[#f7f7f5] px-4 py-2.5 active:cursor-grabbing ${dragActivityId === item.id ? 'opacity-40' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <GripVertical size={14} className="shrink-0 text-black/25" />
                <button
                  type="button"
                  onClick={() => onToggle(item.id, !selected)}
                  aria-label={
                    selected ? 'Deselect activity' : 'Select activity'
                  }
                  aria-pressed={selected}
                  className={
                    selected ? 'text-black' : 'text-black/30 hover:text-black'
                  }
                >
                  <CheckCircle2 size={16} />
                </button>
                <span className="flex min-w-0 items-center gap-1.5 text-sm">
                  {categoryIcon(item.category)}
                  <span className="truncate font-medium">{item.name}</span>
                </span>
                <span className="shrink-0 text-xs text-black/40">
                  {activityCostText(item, currency)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <EntryAction
                  label="Schedule"
                  onClick={() => onSchedule(item)}
                  icon={<CalendarDays />}
                />
                <EntryAction
                  label="Delete"
                  onClick={() => onDelete(item)}
                  icon={<Trash2 />}
                  destructive
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  location,
  image,
  images,
  price,
  selected,
  placeholder,
  details,
  onSelect,
  actions,
}: {
  title: string;
  subtitle: string;
  location: string;
  image?: string;
  images?: string[];
  price: string;
  selected: boolean;
  placeholder: React.ReactNode;
  details: { icon: React.ReactNode; label: string }[];
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  const gallery = useMemo(
    () => [
      ...new Set(
        [image, ...(images ?? [])].filter((item): item is string =>
          Boolean(item),
        ),
      ),
    ],
    [image, images],
  );
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    if (photo >= gallery.length) setPhoto(0);
  }, [gallery.length, photo]);
  return (
    <Card
      className={`group relative gap-0 overflow-hidden rounded-xl bg-white py-0 text-left transition-colors ${selected ? 'border-blue-500 ring-1 ring-blue-500/15' : 'border-black/10 hover:border-black/25'}`}
    >
      <div className="relative h-40 overflow-hidden bg-[#efefed]">
        <button
          type="button"
          aria-label={`Select ${title}`}
          aria-pressed={selected}
          onClick={onSelect}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
        >
          {gallery[photo] ? (
            <StayImage
              src={gallery[photo]}
              alt={`${title} · photo ${photo + 1}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-black/20 [&_svg]:size-8">
              {placeholder}
            </div>
          )}
          <span
            className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${selected ? 'bg-blue-600 text-white' : 'bg-white/95 text-black/70'}`}
          >
            <Check size={13} className={selected ? '' : 'hidden'} />
            {selected ? 'Selected stay' : 'Select stay'}
          </span>
        </button>
        {gallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setPhoto(
                  (current) => (current - 1 + gallery.length) % gallery.length,
                )
              }
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-sm transition-colors hover:bg-white"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                setPhoto((current) => (current + 1) % gallery.length)
              }
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-sm transition-colors hover:bg-white"
            >
              <ChevronRight size={16} />
            </button>
            <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
              <Images size={11} /> {photo + 1}/{gallery.length}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset"
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold leading-6 tracking-[-0.02em]">
                {title}
              </h3>
              <p className="mt-1 truncate text-sm text-black/45">{subtitle}</p>
            </div>
            <Badge className="shrink-0 rounded-md bg-[#f1f3f5] px-2 py-1.5 text-sm font-semibold text-black hover:bg-[#f1f3f5]">
              {price}
            </Badge>
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-xs leading-5 text-black/45">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{location}</span>
          </p>
          <div className="mt-3 grid grid-cols-2 border-t border-black/5 pt-3">
            {details.map((detail, index) => (
              <div
                key={`${detail.label}-${index}`}
                className={`min-w-0 ${index ? 'border-l pl-4' : 'pr-4'}`}
              >
                <span className="block text-black/55 [&_svg]:size-4">
                  {detail.icon}
                </span>
                <p className="mt-2 truncate text-xs text-black/60">
                  {detail.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </button>
      {actions && (
        <div className="flex min-h-11 flex-wrap items-center justify-end gap-1 border-t border-black/5 bg-[#fafbfc] px-3 py-2">
          {actions}
        </div>
      )}
    </Card>
  );
}

function SourceEditor({
  readOnly = false,
  source,
  setSource,
  error,
  onApply,
  onDownload,
}: {
  readOnly?: boolean;
  source: string;
  setSource: (value: string) => void;
  error: string;
  onApply: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-black/40">
            Portable source
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Trip YAML</h1>
          <p className="mt-2 max-w-xl text-sm text-black/50">
            {readOnly
              ? 'This is the local trip file. Edit it in your agent or editor; the preview updates automatically.'
              : 'The visual plan is generated from this file. Paste or edit YAML here, then apply it to the trip.'}
          </p>
        </div>
        <Button onClick={onDownload} variant="outline">
          <Download /> Download
        </Button>
      </div>
      <Suspense
        fallback={
          <Textarea
            aria-label="Trip YAML source"
            readOnly={readOnly}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            className="min-h-[65vh] bg-white font-mono text-sm"
          />
        }
      >
        <YamlEditor value={source} onChange={setSource} readOnly={readOnly} />
      </Suspense>
      <p id="yaml-editor-help" className="mt-3 text-xs leading-5 text-black/50">
        {readOnly
          ? 'Search with Ctrl/Cmd + F. Select and copy any part of the file.'
          : 'Tab indents; Shift + Tab unindents. Escape, then Tab moves out of the editor. Ctrl/Cmd + F searches.'}
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center justify-between">
        <a
          href="/trips/minimal-trip.yaml"
          download
          className="text-xs text-black/45 underline underline-offset-4"
        >
          Example file
        </a>
        {!readOnly && (
          <Button onClick={onApply} className="bg-black text-white">
            Apply YAML
          </Button>
        )}
      </div>
    </div>
  );
}
