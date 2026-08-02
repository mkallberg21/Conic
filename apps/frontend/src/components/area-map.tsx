'use client';

import { MapPin } from 'lucide-react';

interface AreaMapProps {
  /** Privacy-blurred coordinates (~city level). Never exact. */
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  /** Half-size of the shown box in degrees (~0.2° ≈ 22 km). */
  spread?: number;
  height?: number;
  className?: string;
}

/**
 * Shows a GENERAL AREA on a map — a bounding-box view around blurred coordinates
 * with no marker, so an exact location is never revealed. Falls back to a labeled
 * placeholder when there are no coordinates. Uses OpenStreetMap's embed (only a
 * bounding box is sent; no user data).
 */
export function AreaMap({ lat, lng, label, spread = 0.2, height = 200, className }: AreaMapProps) {
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';

  if (!hasCoords) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground ${className ?? ''}`}
        style={{ height }}
      >
        <MapPin className="h-4 w-4" />
        {label ? `${label} — general area` : 'Location not set'}
      </div>
    );
  }

  const minLon = (lng! - spread).toFixed(4);
  const minLat = (lat! - spread).toFixed(4);
  const maxLon = (lng! + spread).toFixed(4);
  const maxLat = (lat! + spread).toFixed(4);
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik`;

  return (
    <div className={`overflow-hidden rounded-lg border ${className ?? ''}`}>
      <iframe
        title={label ? `General area: ${label}` : 'General area'}
        src={src}
        width="100%"
        height={height}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ border: 0, display: 'block' }}
      />
      <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {label ? `${label} · approximate area only` : 'Approximate area only'}
      </div>
    </div>
  );
}
