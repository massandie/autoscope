/**
 * Resolves the real local speed limit for a GPS position (spec: "excès de vitesse (GPS vs.
 * limitations locales)"), instead of comparing against one fixed constant everywhere.
 *
 * Uses OpenStreetMap's public Overpass API to read the `maxspeed` tag of the nearest road. This
 * is honest-but-limited: it needs network access, the public Overpass instance is rate-limited
 * and not meant for heavy production traffic, and `maxspeed` tagging is sparse in many emerging
 * markets (the exact places this app targets) — so a configurable fallback is always used when
 * the lookup fails or no tag is found. A production deployment should move this to a paid roads
 * API (HERE, TomTom, Mapbox) or a self-hosted/offline road database.
 *
 * Results are cached per ~100m grid cell to avoid hammering the API on every GPS sample.
 */

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 40;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — road speed limits rarely change
const FETCH_TIMEOUT_MS = 4000;
const GRID_PRECISION = 3; // ~111m per 0.001° of latitude

interface CacheEntry {
  limitKmh: number | null;
  fetchedAt: number;
}

/** Rounds a lat/lon pair to a stable grid cell key, so nearby samples share one cache entry. */
export function gridKey(lat: number, lon: number, precision = GRID_PRECISION): string {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
}

/**
 * Parses an OSM `maxspeed` tag into km/h. Handles plain numbers ("50"), explicit units
 * ("50 km/h", "30 mph"), and non-numeric values ("none", "signals", "walk") which have no fixed
 * limit and are treated as unknown.
 */
export function parseMaxSpeedKmh(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(km\/h|kmh|mph)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;

  return match[2] === 'mph' ? Math.round(value * 1.60934) : value;
}

export class SpeedLimitResolver {
  private cache = new Map<string, CacheEntry>();

  async getSpeedLimit(lat: number, lon: number, fallbackKmh: number): Promise<number> {
    const key = gridKey(lat, lon);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.limitKmh ?? fallbackKmh;
    }

    const limitKmh = await this.fetchFromOverpass(lat, lon);
    this.cache.set(key, { limitKmh, fetchedAt: Date.now() });
    return limitKmh ?? fallbackKmh;
  }

  private async fetchFromOverpass(lat: number, lon: number): Promise<number | null> {
    const query = `[out:json][timeout:5];way(around:${SEARCH_RADIUS_M},${lat},${lon})["highway"]["maxspeed"];out tags 1;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      if (!res.ok) return null;

      const data = await res.json();
      const tag = data?.elements?.[0]?.tags?.maxspeed;
      return parseMaxSpeedKmh(tag);
    } catch {
      return null; // offline, timeout, or API error — caller falls back to its default limit
    } finally {
      clearTimeout(timeout);
    }
  }
}
