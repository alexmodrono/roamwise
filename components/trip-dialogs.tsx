'use client';
import { StayImage } from './stay-image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { type Stay, type TripDetails } from '@/lib/trip-schema';
import {
  Bath,
  BedDouble,
  CheckCircle2,
  Expand,
  ExternalLink,
  MapPin,
  Pencil,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import {
  ACTIVITY_CATEGORIES,
  AddKind,
  DeleteTarget,
  Draft,
  money,
} from './trip-viewer-shared';
export function AddEntryDialog({
  kind,
  editing,
  draft,
  setDraft,
  onClose,
  onAdd,
}: {
  kind: AddKind | null;
  editing: boolean;
  draft: Draft;
  setDraft: (value: Draft) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const set = (key: keyof Draft, value: string) =>
    setDraft({ ...draft, [key]: value });
  return (
    <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit' : 'Add'} {kind}
          </DialogTitle>
          <DialogDescription>
            {editing ? 'Change any field below.' : 'Add it visually now.'} The
            YAML source updates automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field
            label={kind === 'flight' ? 'Airline' : 'Name'}
            value={draft.name}
            setValue={(value) => set('name', value)}
            placeholder={
              kind === 'activity'
                ? 'Dinner at a local spot'
                : kind === 'flight'
                  ? 'Airline name'
                  : 'Name'
            }
          />
          {kind === 'flight' ? (
            <>
              <Field
                label="Flight number"
                value={draft.detail}
                setValue={(value) => set('detail', value)}
                placeholder="FR188"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="From"
                  value={draft.from}
                  setValue={(value) => set('from', value.toUpperCase())}
                  placeholder="MAD"
                />
                <Field
                  label="To"
                  value={draft.to}
                  setValue={(value) => set('to', value.toUpperCase())}
                  placeholder="SVQ"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Departure"
                  value={draft.depart}
                  setValue={(value) => set('depart', value)}
                  placeholder=""
                  type="datetime-local"
                />
                <Field
                  label="Arrival"
                  value={draft.arrive}
                  setValue={(value) => set('arrive', value)}
                  placeholder=""
                  type="datetime-local"
                />
              </div>
            </>
          ) : (
            <>
              {kind === 'stay' && (
                <>
                  <Field
                    label="Type / short summary"
                    value={draft.detail}
                    setValue={(value) => set('detail', value)}
                    placeholder="Entire apartment · 1 bedroom"
                  />
                  <Field
                    label="Neighbourhood"
                    value={draft.neighbourhood}
                    setValue={(value) => set('neighbourhood', value)}
                    placeholder="historic centre"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <Field
                      label="Bedrooms"
                      value={draft.bedrooms}
                      setValue={(value) => set('bedrooms', value)}
                      placeholder="1"
                      type="number"
                    />
                    <Field
                      label="Bathrooms"
                      value={draft.bathrooms}
                      setValue={(value) => set('bathrooms', value)}
                      placeholder="1"
                      type="number"
                    />
                    <Field
                      label="Size (m²)"
                      value={draft.size}
                      setValue={(value) => set('size', value)}
                      placeholder="47"
                      type="number"
                    />
                  </div>
                </>
              )}
              {kind === 'activity' && (
                <>
                  <label className="text-sm font-medium">
                    Category
                    <NativeSelect
                      className="mt-1.5 w-full"
                      value={draft.category}
                      onChange={(event) => set('category', event.target.value)}
                    >
                      {ACTIVITY_CATEGORIES.map((option) => (
                        <NativeSelectOption
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <Field
                      label="Date"
                      value={draft.date}
                      setValue={(value) => set('date', value)}
                      placeholder=""
                      type="date"
                    />
                    <Field
                      label="Start time"
                      value={draft.time}
                      setValue={(value) => set('time', value)}
                      placeholder=""
                      type="time"
                    />
                    <Field
                      label="End time"
                      value={draft.endTime}
                      setValue={(value) => set('endTime', value)}
                      placeholder=""
                      type="time"
                    />
                  </div>
                </>
              )}
              <Field
                label="Address"
                value={draft.address}
                setValue={(value) => set('address', value)}
                placeholder="Address or neighbourhood"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Latitude"
                  value={draft.lat}
                  setValue={(value) => set('lat', value)}
                  placeholder="40.4168"
                />
                <Field
                  label="Longitude"
                  value={draft.lng}
                  setValue={(value) => set('lng', value)}
                  placeholder="-3.7038"
                />
              </div>
              {kind === 'stay' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Check-in"
                      value={draft.checkIn}
                      setValue={(value) => set('checkIn', value)}
                      placeholder="15:00"
                    />
                    <Field
                      label="Check-out"
                      value={draft.checkOut}
                      setValue={(value) => set('checkOut', value)}
                      placeholder="11:00"
                    />
                  </div>
                  <TextAreaField
                    label="Amenities"
                    value={draft.amenities}
                    setValue={(value) => set('amenities', value)}
                    placeholder="Wi-Fi&#10;Kitchen&#10;Washer"
                    hint="One per line or comma-separated"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextAreaField
                      label="Pros"
                      value={draft.pros}
                      setValue={(value) => set('pros', value)}
                      placeholder="Walkable&#10;Quiet street"
                    />
                    <TextAreaField
                      label="Cons"
                      value={draft.cons}
                      setValue={(value) => set('cons', value)}
                      placeholder="No lift&#10;Small kitchen"
                    />
                  </div>
                  <TextAreaField
                    label="Cancellation policy"
                    value={draft.cancellationPolicy}
                    setValue={(value) => set('cancellationPolicy', value)}
                    placeholder="Free cancellation until…"
                  />
                  <TextAreaField
                    label="Extensive notes"
                    value={draft.notes}
                    setValue={(value) => set('notes', value)}
                    placeholder="Add research, impressions, transport notes, questions for the host, or anything useful for the decision…"
                    rows={7}
                  />
                </>
              )}
              {kind === 'activity' && (
                <TextAreaField
                  label="Notes"
                  value={draft.notes}
                  setValue={(value) => set('notes', value)}
                  placeholder="Booking reference, tickets, reminders…"
                  rows={3}
                />
              )}
            </>
          )}
          <Field
            label={kind === 'flight' ? 'Price per person' : 'Total price'}
            value={draft.price}
            setValue={(value) => set('price', value)}
            placeholder="0"
            type="number"
          />
          <Field
            label="Link"
            value={draft.url}
            setValue={(value) => set('url', value)}
            placeholder="https://…"
            type="url"
          />
          {kind !== 'flight' && (
            <Field
              label="Image URL"
              value={draft.image}
              setValue={(value) => set('image', value)}
              placeholder="https://…"
              type="url"
            />
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={onAdd} className="bg-black text-white">
            {editing ? 'Save changes' : 'Add to trip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  label,
  value,
  setValue,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="mt-1.5 h-10"
      />
    </label>
  );
}
function TextAreaField({
  label,
  value,
  setValue,
  placeholder,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1.5 resize-y"
      />
      {hint && (
        <span className="mt-1 block text-[11px] font-normal text-black/40">
          {hint}
        </span>
      )}
    </label>
  );
}

export function TripSettingsDialog({
  open,
  form,
  setForm,
  onClose,
  onSave,
}: {
  open: boolean;
  form: TripDetails;
  setForm: (value: TripDetails) => void;
  onClose: () => void;
  onSave: (details: TripDetails) => void;
}) {
  const [error, setError] = useState('');
  const set = (patch: Partial<TripDetails>) => setForm({ ...form, ...patch });
  function save() {
    if (
      form.dates.start &&
      form.dates.end &&
      form.dates.end < form.dates.start
    ) {
      setError('The end date is before the start date.');
      return;
    }
    setError('');
    onSave({
      ...form,
      title: form.title.trim(),
      currency: form.currency.trim().toUpperCase() || 'EUR',
      travellers: Math.max(1, Math.round(Number(form.travellers) || 1)),
    });
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trip details</DialogTitle>
          <DialogDescription>
            Everything here lives in the trip YAML. Live flight fares use the
            origin and destination airport codes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field
            label="Trip title"
            value={form.title}
            setValue={(value) => set({ title: value })}
            placeholder="Weekend in Porto"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Origin"
              value={form.origin.name}
              setValue={(value) =>
                set({ origin: { ...form.origin, name: value } })
              }
              placeholder="Madrid"
            />
            <Field
              label="Origin code (IATA)"
              value={form.origin.code ?? ''}
              setValue={(value) =>
                set({
                  origin: {
                    ...form.origin,
                    code: value.toUpperCase().slice(0, 3),
                  },
                })
              }
              placeholder="MAD"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Destination"
              value={form.destination.name}
              setValue={(value) =>
                set({ destination: { ...form.destination, name: value } })
              }
              placeholder="Seville"
            />
            <Field
              label="Destination code (IATA)"
              value={form.destination.code ?? ''}
              setValue={(value) =>
                set({
                  destination: {
                    ...form.destination,
                    code: value.toUpperCase().slice(0, 3),
                  },
                })
              }
              placeholder="SVQ"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start date"
              value={form.dates.start}
              setValue={(value) =>
                set({ dates: { ...form.dates, start: value } })
              }
              placeholder=""
              type="date"
            />
            <Field
              label="End date"
              value={form.dates.end}
              setValue={(value) =>
                set({ dates: { ...form.dates, end: value } })
              }
              placeholder=""
              type="date"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Travellers"
              value={String(form.travellers)}
              setValue={(value) => set({ travellers: Number(value) || 1 })}
              placeholder="2"
              type="number"
            />
            <Field
              label="Currency"
              value={form.currency}
              setValue={(value) =>
                set({ currency: value.toUpperCase().slice(0, 3) })
              }
              placeholder="EUR"
            />
            <Field
              label="Budget / person"
              value={
                form.budget_per_person ? String(form.budget_per_person) : ''
              }
              setValue={(value) =>
                set({ budget_per_person: Number(value) || undefined })
              }
              placeholder="300"
              type="number"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={save} className="bg-black text-white">
            Save trip details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StayDetailsDialog({
  stay,
  currency,
  onClose,
  onEdit,
}: {
  stay?: Stay;
  currency: string;
  onClose: () => void;
  onEdit: (stay: Stay) => void;
}) {
  const facts = stay
    ? ([
        stay.bedrooms
          ? {
              icon: <BedDouble />,
              label: `${stay.bedrooms} bedroom${stay.bedrooms === 1 ? '' : 's'}`,
            }
          : null,
        stay.bathrooms
          ? {
              icon: <Bath />,
              label: `${stay.bathrooms} bathroom${stay.bathrooms === 1 ? '' : 's'}`,
            }
          : null,
        stay.size_m2 ? { icon: <Expand />, label: `${stay.size_m2} m²` } : null,
      ].filter(Boolean) as { icon: React.ReactNode; label: string }[])
    : [];
  return (
    <Dialog open={Boolean(stay)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-3xl">
        {stay && (
          <>
            <div className="relative h-56 overflow-hidden rounded-t-2xl bg-[#ededeb] sm:h-72">
              {stay.image ? (
                <StayImage
                  loading="eager"
                  src={stay.image}
                  alt={stay.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-black/20">
                  <BedDouble size={34} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute inset-x-6 bottom-5 flex items-end justify-between gap-4 text-white">
                <div>
                  <p className="text-sm text-white/70">
                    {stay.neighbourhood ?? stay.type ?? 'Accommodation'}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                    {stay.name}
                  </h2>
                </div>
                <strong className="rounded-full bg-white px-4 py-2 text-sm text-black">
                  {money(stay.price_total, currency)}
                </strong>
              </div>
            </div>
            <div className="space-y-7 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-sm text-black/55">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {stay.address ?? 'Location not added'}
                </span>
                {stay.rating && (
                  <Badge variant="secondary" className="rounded-full">
                    <Star /> {stay.rating}
                  </Badge>
                )}
              </div>
              {facts.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex items-center gap-2 rounded-xl bg-[#f5f5f3] px-4 py-3 text-sm [&_svg]:size-4"
                    >
                      {fact.icon}
                      {fact.label}
                    </div>
                  ))}
                </div>
              )}
              <DetailSection title="Notes">
                <p className="whitespace-pre-wrap text-sm leading-6 text-black/65">
                  {stay.notes ||
                    'No detailed notes yet. Use Edit to add research, impressions, transport information, or questions for the host.'}
                </p>
              </DetailSection>
              {stay.amenities && stay.amenities.length > 0 && (
                <DetailSection title="Amenities">
                  <div className="flex flex-wrap gap-2">
                    {stay.amenities.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[#f2f2f0] px-3 py-1.5 text-xs text-black/65"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </DetailSection>
              )}
              {((stay.pros?.length ?? 0) > 0 ||
                (stay.cons?.length ?? 0) > 0) && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <DetailList
                    title="Pros"
                    items={stay.pros ?? []}
                    icon={<CheckCircle2 className="text-green-700" />}
                  />
                  <DetailList
                    title="Cons"
                    items={stay.cons ?? []}
                    icon={<XCircle className="text-red-600" />}
                  />
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <DetailSection title="Arrival">
                  <div className="space-y-2 text-sm text-black/60">
                    <p>
                      <span className="text-black/35">Check-in</span>
                      <br />
                      {stay.check_in || 'Not added'}
                    </p>
                    <p>
                      <span className="text-black/35">Check-out</span>
                      <br />
                      {stay.check_out || 'Not added'}
                    </p>
                  </div>
                </DetailSection>
                <DetailSection title="Cancellation">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-black/60">
                    {stay.cancellation_policy || 'Policy not added'}
                  </p>
                </DetailSection>
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4 sm:px-8">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {stay.url && (
                <Button
                  variant="outline"
                  render={
                    <a href={stay.url} target="_blank" rel="noreferrer" />
                  }
                >
                  <ExternalLink /> Listing
                </Button>
              )}
              <Button
                onClick={() => onEdit(stay)}
                className="bg-black text-white"
              >
                <Pencil /> Edit all details
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">
        {title}
      </h3>
      {children}
    </section>
  );
}
function DetailList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <DetailSection title={title}>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-black/65 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
            >
              {icon}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-black/40">Nothing added yet.</p>
      )}
    </DetailSection>
  );
}

export function DeleteEntryDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="rounded-xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {target?.name}?</DialogTitle>
          <DialogDescription>
            This removes the {target?.kind} from the trip and recalculates the
            selected total. You can still restore it from a saved YAML file.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            <Trash2 /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
