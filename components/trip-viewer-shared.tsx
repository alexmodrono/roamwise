'use client';

import { type Activity, type FlightLeg } from '@/lib/trip-schema';
import {
  Bus,
  ExternalLink,
  Landmark,
  Mountain,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react';

import { type DayEvent } from '@/packages/core/itinerary';

export type AddKind = 'flight' | 'stay' | 'activity';
export type Draft = {
  name: string;
  detail: string;
  address: string;
  price: string;
  image: string;
  url: string;
  lat: string;
  lng: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  date: string;
  time: string;
  endTime: string;
  category: string;
  notes: string;
  neighbourhood: string;
  amenities: string;
  pros: string;
  cons: string;
  checkIn: string;
  checkOut: string;
  cancellationPolicy: string;
  bedrooms: string;
  bathrooms: string;
  size: string;
};
export type DeleteTarget = {
  kind: AddKind;
  id: string;
  name: string;
  direction?: 'outbound' | 'return';
};
export const emptyDraft: Draft = {
  name: '',
  detail: '',
  address: '',
  price: '',
  image: '',
  url: '',
  lat: '',
  lng: '',
  from: '',
  to: '',
  depart: '',
  arrive: '',
  date: '',
  time: '',
  endTime: '',
  category: '',
  notes: '',
  neighbourhood: '',
  amenities: '',
  pros: '',
  cons: '',
  checkIn: '',
  checkOut: '',
  cancellationPolicy: '',
  bedrooms: '',
  bathrooms: '',
  size: '',
};
export const ACTIVITY_CATEGORIES = [
  { value: '', label: 'General' },
  { value: 'food', label: 'Food & drink' },
  { value: 'sight', label: 'Sightseeing' },
  { value: 'transport', label: 'Transport' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'shopping', label: 'Shopping' },
];

export function money(value: number | undefined, currency = 'EUR') {
  if (value === undefined) return 'Price unknown';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value || 0);
}
export function shortDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Date not set';
}
export function longDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
export function time(value?: string) {
  return value?.split('T')[1]?.slice(0, 5) ?? '—';
}
export function safeId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || `item-${Date.now()}`
  );
}
export function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
export function flightKey(item: FlightLeg) {
  return [
    item.flight_number?.replace(/\s/g, '').toUpperCase(),
    item.from,
    item.to,
    item.depart,
  ].join('|');
}
export function mergeFlightOptions(
  existing: FlightLeg[],
  incoming: FlightLeg[],
) {
  const liveByKey = new Map(incoming.map((item) => [flightKey(item), item]));
  const existingKeys = new Set(existing.map(flightKey));
  return [
    ...existing.map((item) => {
      const live = liveByKey.get(flightKey(item));
      return live
        ? { ...item, ...live, id: item.id, url: item.url ?? live.url }
        : item;
    }),
    ...incoming.filter((item) => !existingKeys.has(flightKey(item))),
  ];
}
export function durationText(start?: string, end?: string) {
  if (
    !start ||
    !end ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end)
  )
    return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  const hours = Math.floor(mins / 60);
  return hours
    ? mins % 60
      ? `${hours}h ${mins % 60}m`
      : `${hours}h`
    : `${mins}m`;
}
export function categoryIcon(category?: string, size = 14) {
  switch (category) {
    case 'food':
      return <Utensils size={size} />;
    case 'sight':
      return <Landmark size={size} />;
    case 'transport':
      return <Bus size={size} />;
    case 'outdoor':
      return <Mountain size={size} />;
    case 'shopping':
      return <ShoppingBag size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}
export function activityCostText(item: Activity, currency: string) {
  if (item.price_total !== undefined)
    return money(item.price_total as number, currency);
  if (item.cost_label) return item.cost_label;
  switch (item.category) {
    case 'food':
      return 'Food';
    case 'sight':
      return 'Sightseeing';
    case 'transport':
      return 'Transport';
    case 'outdoor':
      return 'Outdoor';
    case 'shopping':
      return 'Shopping';
    case 'practical':
      return 'Logistics';
    case 'seasonal':
      return 'Seasonal activity';
    case 'tour':
      return 'Guided tour';
    default:
      return 'Activity';
  }
}
export function eventTimeText(event: DayEvent): string {
  if (event.kind === 'flight') return time(event.flight.depart);
  if (event.kind === 'milestone') return event.timeText ?? '';
  const { activity } = event;
  return activity.time
    ? activity.end_time
      ? `${activity.time}–${activity.end_time}`
      : activity.time
    : '';
}
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
export function PrintLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 rounded-md border border-black/15 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-black/70 no-underline print:text-black ${className ?? ''}`}
    >
      <ExternalLink className="size-3" />
      {children}
    </a>
  );
}
