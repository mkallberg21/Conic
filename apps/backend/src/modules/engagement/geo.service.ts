import { Injectable } from '@nestjs/common';

export interface ApproxCoord {
  lat: number;
  lng: number;
}

// Coarse centroids for common US metros + a state-centroid fallback. This keeps
// the general-area map dependency-free; a real geocoder can be layered in later
// behind the same resolve() contract. Coordinates are deliberately city-level.
const CITY: Record<string, ApproxCoord> = {
  'new york': { lat: 40.71, lng: -74.01 }, 'los angeles': { lat: 34.05, lng: -118.24 },
  chicago: { lat: 41.88, lng: -87.63 }, houston: { lat: 29.76, lng: -95.37 },
  phoenix: { lat: 33.45, lng: -112.07 }, philadelphia: { lat: 39.95, lng: -75.17 },
  'san antonio': { lat: 29.42, lng: -98.49 }, 'san diego': { lat: 32.72, lng: -117.16 },
  dallas: { lat: 32.78, lng: -96.8 }, austin: { lat: 30.27, lng: -97.74 },
  'san jose': { lat: 37.34, lng: -121.89 }, 'san francisco': { lat: 37.77, lng: -122.42 },
  seattle: { lat: 47.61, lng: -122.33 }, denver: { lat: 39.74, lng: -104.99 },
  boston: { lat: 42.36, lng: -71.06 }, nashville: { lat: 36.16, lng: -86.78 },
  atlanta: { lat: 33.75, lng: -84.39 }, miami: { lat: 25.76, lng: -80.19 },
  portland: { lat: 45.52, lng: -122.68 }, 'las vegas': { lat: 36.17, lng: -115.14 },
  detroit: { lat: 42.33, lng: -83.05 }, minneapolis: { lat: 44.98, lng: -93.27 },
  charlotte: { lat: 35.23, lng: -80.84 }, columbus: { lat: 39.96, lng: -83.0 },
  orlando: { lat: 28.54, lng: -81.38 }, 'kansas city': { lat: 39.1, lng: -94.58 },
  'salt lake city': { lat: 40.76, lng: -111.89 }, pittsburgh: { lat: 40.44, lng: -79.996 },
};

const STATE: Record<string, ApproxCoord> = {
  CA: { lat: 36.78, lng: -119.42 }, TX: { lat: 31.97, lng: -99.9 }, FL: { lat: 27.77, lng: -81.69 },
  NY: { lat: 42.17, lng: -74.95 }, IL: { lat: 40.35, lng: -88.99 }, PA: { lat: 40.59, lng: -77.21 },
  OH: { lat: 40.39, lng: -82.76 }, GA: { lat: 33.04, lng: -83.64 }, NC: { lat: 35.63, lng: -79.81 },
  MI: { lat: 43.33, lng: -84.54 }, WA: { lat: 47.4, lng: -121.49 }, AZ: { lat: 33.73, lng: -111.43 },
  MA: { lat: 42.23, lng: -71.53 }, TN: { lat: 35.75, lng: -86.69 }, CO: { lat: 39.06, lng: -105.31 },
  MN: { lat: 45.69, lng: -93.9 }, NV: { lat: 38.31, lng: -117.05 }, OR: { lat: 44.57, lng: -122.07 },
  UT: { lat: 40.15, lng: -111.86 },
};

@Injectable()
export class GeoService {
  /**
   * Resolve a self-provided location to a PRIVACY-BLURRED coordinate (~city level,
   * rounded to ~11 km). Returns null when the location can't be placed — the map
   * then simply shows nothing rather than guessing.
   */
  resolveApprox(city?: string | null, region?: string | null): ApproxCoord | null {
    const key = (city ?? '').trim().toLowerCase();
    const hit = CITY[key] ?? (region ? STATE[region.trim().toUpperCase()] : undefined);
    if (!hit) return null;
    return { lat: blur(hit.lat), lng: blur(hit.lng) };
  }
}

/** Round to 1 decimal place (~11 km) so the point is a general area, never exact. */
function blur(n: number): number {
  return Math.round(n * 10) / 10;
}
