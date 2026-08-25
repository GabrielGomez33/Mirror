// components/intake/shared/astrology/resolveLocation.ts
// ----------------------------------------------------------------------------
// Client-only birthplace resolution shared by the Core AstroLogicalStep and the
// Entry intake. Given a free-text place, it geocodes via public Nominatim and
// returns normalized { label, lat, lon } candidates — the coordinates that make
// a REAL Rising sign + Whole-Sign houses computable (see computeAstrology's
// latitude/longitude path).
//
// PROVENANCE: lifted verbatim from components/intake/AstroLogicalStep.tsx so the
// two intake paths resolve locations identically. AstroLogicalStep imports these
// from here (single source of truth) — do not fork the resolver.
// ----------------------------------------------------------------------------

export interface ResolvedLocation {
  label: string;
  lat: number;
  lon: number;
}

/** How a resolved location is serialized for storage alongside the intake. */
export type LocationFormat = 'label' | 'latlon' | 'pipe' | 'json';

export function formatLocation(loc: ResolvedLocation, fmt: LocationFormat): string {
  const lat = loc.lat.toFixed(6);
  const lon = loc.lon.toFixed(6);
  switch (fmt) {
    case 'label': return loc.label;
    case 'latlon': return `${lat},${lon}`;
    case 'pipe': return `${loc.label}|${lat}|${lon}`;
    case 'json':
    default: return JSON.stringify(loc);
  }
}

/**
 * Resolve a free-text place to up to 5 normalized candidates, most-relevant
 * first (Nominatim's own relevance order). Returns null for a too-short query,
 * a non-OK response, a timeout (3s), or zero usable results — callers treat
 * null as "couldn't resolve" and prompt the user to refine. Never throws.
 */
export async function resolveLocationPublic(query: string): Promise<ResolvedLocation[] | null> {
  const q = (query || '').trim();
  if (q.length < 3) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const raw = await res.json();

    const picks: ResolvedLocation[] = (raw || []).map((r: any) => {
      const a = r.address || {};
      const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || '';
      const region = a.state || a.region || a.province || a.county || '';
      const country = a.country || '';
      const label = [city, region, country].filter(Boolean).join(', ') || r.display_name || q;
      return {
        label,
        lat: Number(r.lat),
        lon: Number(r.lon),
      };
    }).filter((p: ResolvedLocation) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    return picks.length ? picks : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
