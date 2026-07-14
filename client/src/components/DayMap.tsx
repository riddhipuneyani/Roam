import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActivitySlot, ItineraryDay } from '../lib/types';

/**
 * A small field map for one day's spread: espresso pins for the morning/
 * afternoon/evening activities, terracotta pins for the grounded
 * restaurants. CartoDB Positron tiles keep it muted and editorial.
 */

const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const SLOT_LETTER: Record<ActivitySlot, string> = { morning: 'M', afternoon: 'A', evening: 'E' };
const SLOT_LABEL: Record<ActivitySlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

interface Pin {
  lat: number;
  lon: number;
  kind: 'activity' | 'restaurant';
  glyph: string;
  title: string;
  meta: string;
}

function dayPins(day: ItineraryDay): Pin[] {
  const pins: Pin[] = [];
  for (const slot of ['morning', 'afternoon', 'evening'] as const) {
    const block = day[slot];
    if (typeof block.lat === 'number' && typeof block.lon === 'number') {
      pins.push({
        lat: block.lat,
        lon: block.lon,
        kind: 'activity',
        glyph: SLOT_LETTER[slot],
        title: block.activity,
        meta: `${SLOT_LABEL[slot]} · ${block.location}`,
      });
    }
  }
  for (const restaurant of day.restaurants) {
    if (typeof restaurant.lat === 'number' && typeof restaurant.lon === 'number') {
      pins.push({
        lat: restaurant.lat,
        lon: restaurant.lon,
        kind: 'restaurant',
        glyph: '•',
        title: restaurant.name,
        meta: `${restaurant.mealType} · ${restaurant.cuisine}`,
      });
    }
  }
  return pins;
}

function pinIcon(pin: Pin): L.DivIcon {
  return L.divIcon({
    className: 'roam-div-icon',
    html: `<span class="roam-pin roam-pin-${pin.kind}">${pin.glyph}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function DayMap({ day }: { day: ItineraryDay }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const pins = dayPins(day);

  useEffect(() => {
    if (pins.length === 0 || !containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = layerRef.current!;
    layer.clearLayers();
    for (const pin of pins) {
      L.marker([pin.lat, pin.lon], { icon: pinIcon(pin) })
        .bindPopup(
          `<p class="roam-popup-title">${escapeHtml(pin.title)}</p><p class="roam-popup-meta">${escapeHtml(pin.meta)}</p>`,
          { className: 'roam-popup', closeButton: false },
        )
        .addTo(layer);
    }
    mapRef.current.fitBounds(
      L.latLngBounds(pins.map((p) => [p.lat, p.lon])),
      { padding: [28, 28], maxZoom: 15 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pins)]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  if (pins.length === 0) return null;

  // The legend only advertises marker types that are actually on this map —
  // a day whose restaurants couldn't be located shouldn't promise "tables".
  const hasActivities = pins.some((p) => p.kind === 'activity');
  const hasRestaurants = pins.some((p) => p.kind === 'restaurant');

  return (
    <div className="mt-5 border-t border-border/70 pt-4">
      <p className="kicker">On the map</p>
      <div
        ref={containerRef}
        className="mt-3 h-64 w-full border border-border"
        aria-label={`Map of day ${day.dayNumber} places`}
      />
      <p className="mt-2 font-body text-caption text-text-muted">
        {hasActivities && (
          <>
            <span className="roam-pin roam-pin-activity mr-1 !inline-flex !h-4 !w-4 text-[8px]">M</span>
            activities
          </>
        )}
        {hasActivities && hasRestaurants && ' · '}
        {hasRestaurants && (
          <>
            <span className="roam-pin roam-pin-restaurant mx-1 !inline-flex !h-4 !w-4 text-[8px]">•</span>
            tables
          </>
        )}
      </p>
    </div>
  );
}
