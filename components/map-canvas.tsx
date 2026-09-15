'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import type { Coordinates } from '@/packages/core/trip-schema';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MAP_STYLE_URL } from '@/lib/maps';

export type MapPoint = {
  id: string;
  label: string;
  detail?: string;
  kind: 'stay' | 'activity' | 'highlight';
  coordinates: Coordinates;
  selected?: boolean;
};

export function MapCanvas({
  points,
  center,
  compact = false,
  snapshot = false,
}: {
  points: MapPoint[];
  center?: Coordinates;
  compact?: boolean;
  snapshot?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [visible, setVisible] = useState(snapshot);
  const release = useRef<(() => void) | null>(null);
  const dataSignature = useRef('');
  const [ready, setReady] = useState(0);
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const fitSignature = useRef('');

  useEffect(() => {
    if (snapshot || visible) return;
    const element = container.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [snapshot, visible]);

  useEffect(() => {
    if (!visible) return;
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let map: LibreMap | undefined;
    const resize = new ResizeObserver(() => map?.resize());
    resize.observe(element);
    release.current = () => {
      resize.disconnect();
      map?.remove();
      map = undefined;
      mapRef.current = null;
    };
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([lib]) => {
        if (disposed) return;
        lib.setWorkerUrl(mapWorkerUrl);
        map = new lib.Map({
          container: element,
          style: MAP_STYLE_URL,
          center: [0, 20],
          zoom: 2,
          interactive: !snapshot,
          canvasContextAttributes: { preserveDrawingBuffer: snapshot },
          attributionControl: { compact: false },
        });
        mapRef.current = map;
        if (!compact && !snapshot)
          map.addControl(
            new lib.NavigationControl({ showCompass: false }),
            'top-right',
          );
        map.on('error', () => {
          if (!disposed)
            setError(
              'The map could not load. Check your connection and try again.',
            );
        });
        map.on('load', () => {
          if (disposed || !map) return;
          map.addSource('trip-points', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'trip-points',
            type: 'circle',
            source: 'trip-points',
            paint: {
              'circle-radius': ['case', ['get', 'selected'], 9, 6],
              'circle-color': [
                'match',
                ['get', 'kind'],
                'stay',
                '#2563eb',
                'activity',
                '#d97706',
                '#171717',
              ],
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2,
            },
          });
          if (!snapshot) {
            const popup = new lib.Popup({
              closeButton: false,
              closeOnClick: false,
            });
            map.on('mouseenter', 'trip-points', (event) => {
              const feature = event.features?.[0];
              if (!map || !feature || feature.geometry.type !== 'Point') return;
              map.getCanvas().style.cursor = 'pointer';
              const content = document.createElement('div');
              const title = document.createElement('strong');
              title.textContent = String(feature.properties.label ?? '');
              content.appendChild(title);
              if (feature.properties.detail) {
                const detail = document.createElement('div');
                detail.textContent = String(feature.properties.detail);
                content.appendChild(detail);
              }
              popup
                .setLngLat(feature.geometry.coordinates as [number, number])
                .setDOMContent(content)
                .addTo(map);
            });
            map.on('mouseleave', 'trip-points', () => {
              if (map) map.getCanvas().style.cursor = '';
              popup.remove();
            });
          }
          setError('');
          setReady((value) => value + 1);
        });
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        console.error('Map initialization failed:', cause);
        const message =
          cause instanceof Error
            ? cause.message
            : 'Unknown initialization error';
        setError(`The map could not start: ${message}`);
      });
    return () => {
      disposed = true;
      release.current?.();
      release.current = null;
      fitSignature.current = '';
      dataSignature.current = '';
    };
  }, [compact, snapshot, visible]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource<GeoJSONSource>('trip-points');
    if (!map || !source) return;
    const data = {
      type: 'FeatureCollection',
      features: points.map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.coordinates.lng, point.coordinates.lat],
        },
        properties: {
          label: point.label,
          detail: point.detail ?? '',
          kind: point.kind,
          selected: !!point.selected,
        },
      })),
    };
    const nextDataSignature = JSON.stringify(data);
    if (nextDataSignature !== dataSignature.current) {
      dataSignature.current = nextDataSignature;
      void source.setData(data as Parameters<GeoJSONSource['setData']>[0]);
    }
    const signature = JSON.stringify([
      points.map((p) => [p.id, p.coordinates.lng, p.coordinates.lat]),
      center,
    ]);
    if (fitSignature.current !== signature) {
      fitSignature.current = signature;
      if (points.length) {
        const lngs = points.map((p) => p.coordinates.lng);
        const lats = points.map((p) => p.coordinates.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          {
            padding: snapshot ? 24 : 36,
            maxZoom: snapshot ? 14 : 13,
            duration: 0,
          },
        );
      } else
        map.jumpTo({
          center: center ? [center.lng, center.lat] : [0, 20],
          zoom: center ? 13 : 2,
        });
    }
    if (!snapshot) return;
    // Keep a raster copy for printing, independent of the WebGL drawing buffer.
    const capture = () => {
      try {
        setImage(map.getCanvas().toDataURL('image/png'));
        release.current?.();
      } catch {
        setError('The map preview could not be prepared for printing.');
      }
    };
    void map.once('idle', capture);
    return () => {
      map.off('idle', capture);
    };
  }, [points, center, ready, snapshot]);

  return (
    <div
      data-map-state={
        image ? 'captured' : error ? 'error' : ready ? 'ready' : 'loading'
      }
      className="relative h-full w-full overflow-hidden bg-[#e9e9e9]"
    >
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {/* The image is a local canvas data URL; no image optimization is needed. */}
      {/* oxlint-disable-next-line next/no-img-element */}
      {snapshot && image && (
        <img
          src={image}
          alt="Map of the stay and surrounding neighbourhood"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {error && (
        <output className="absolute inset-x-0 top-0 z-10 bg-white/95 px-3 py-2 text-xs text-red-600">
          {error}
        </output>
      )}
    </div>
  );
}
