'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_TRIP,
  stringifyTrip,
  validateTrip,
  type TripDocument,
  type TripIssue,
} from '@/packages/core/trip-schema';

export type TripSource =
  | { kind: 'browser' }
  | { kind: 'local'; session: string };
const STORAGE_KEY = 'roamwise-trip-v2';
export function useTripDocument(input: TripSource) {
  const readOnly = input.kind === 'local';
  const session = input.kind === 'local' ? input.session : '';
  const [trip, setTrip] = useState<TripDocument>(EMPTY_TRIP);
  const [source, setSource] = useState(() => stringifyTrip(EMPTY_TRIP));
  const [status, setStatus] = useState('Connecting');
  const [fileName, setFileName] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [warnings, setWarnings] = useState<TripIssue[]>([]);
  const apply = useCallback((yaml: string) => {
    setSource(yaml);
    const result = validateTrip(yaml);
    if (!result.trip) {
      setDocumentError(
        result.errors
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n'),
      );
      return false;
    }
    setTrip(result.trip);
    setWarnings(result.warnings);
    setDocumentError('');
    return true;
  }, []);
  useEffect(() => {
    if (!readOnly) {
      // Browser-only storage must be restored after server hydration.
      // oxlint-disable-next-line react/react-compiler
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) apply(stored);
      } catch {
        setDocumentError(
          'Browser storage is unavailable. You can still load and download trip files.',
        );
      }
      return;
    }
    let stream: EventSource | undefined;
    const connect = () => {
      stream?.close();
      if (document.hidden) {
        setStatus('Paused while hidden');
        return;
      }
      stream = new EventSource(
        `/api/trip/events?session=${encodeURIComponent(session)}`,
      );
      stream.addEventListener('trip', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            source?: string;
            fileName: string;
            error?: string;
          };
          setFileName(data.fileName);
          if (data.error) {
            setDocumentError(data.error);
            setStatus('File unavailable · showing last valid trip');
          } else if (data.source !== undefined)
            setStatus(
              apply(data.source)
                ? 'Live preview'
                : 'Invalid YAML · showing last valid trip',
            );
        } catch {
          setDocumentError('Could not read the local trip update.');
        }
      });
      stream.onerror = () =>
        setStatus(
          'Disconnected · reopen the trip with roamwise open if the server has stopped',
        );
    };
    connect();
    document.addEventListener('visibilitychange', connect);
    return () => {
      stream?.close();
      document.removeEventListener('visibilitychange', connect);
    };
  }, [apply, readOnly, session]);
  const commit = useCallback(
    (next: TripDocument) => {
      if (readOnly) return;
      const yaml = stringifyTrip(next);
      if (!apply(yaml)) return;
      try {
        localStorage.setItem(STORAGE_KEY, yaml);
      } catch {
        setDocumentError(
          'Your trip is visible but could not be saved in this browser. Download a copy to keep it.',
        );
      }
    },
    [apply, readOnly],
  );
  return {
    trip,
    source,
    setSource,
    commit,
    readOnly,
    status,
    fileName,
    documentError,
    warnings,
  };
}
