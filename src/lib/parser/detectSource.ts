import type { SourceName } from '../types';
import { normalizeSourceName } from '../constants';

export function detectSource(row: Record<string, unknown>, filenameFallback?: string): SourceName {
  const keys = Object.keys(row).map((k) => k.trim().toLowerCase());

  // 1. Column "map_url" or "google_map_url" -> "google"
  if (keys.includes('map_url') || keys.includes('google_map_url')) {
    return 'google';
  }
  // 2. Column "tabelog_url" or "食べログurl" -> "tabelog"
  if (keys.includes('tabelog_url') || keys.includes('食べログurl') || keys.some((k) => k.includes('食べログurl') || k.includes('tabelog_url'))) {
    return 'tabelog';
  }
  // 3. Column "coupon" or "クーポン" or "hotpepper_url" -> "hotpepper"
  if (keys.includes('coupon') || keys.includes('クーポン') || keys.includes('ホットペッパーurl') || keys.includes('hotpepper_url')) {
    return 'hotpepper';
  }

  // Find any URL value in the row to inspect its content
  let urlVal = '';
  for (const [k, v] of Object.entries(row)) {
    const lk = k.trim().toLowerCase();
    if (lk.includes('url')) {
      if (typeof v === 'string') {
        urlVal = v;
        break;
      }
    }
  }

  if (urlVal) {
    if (urlVal.includes('tabelog.com')) {
      return 'tabelog';
    }
    if (urlVal.includes('hotpepper.jp')) {
      return 'hotpepper';
    }
    if (urlVal.includes('google.com/maps') || urlVal.includes('maps.google')) {
      return 'google';
    }
  }

  // 7. Filename fallback -> existing logic (row.source etc.)
  const rawSource = row.source || row['媒体'] || row['媒体名'] || row['site'] || row['platform'];
  const finalSource = String(rawSource ?? filenameFallback ?? '');
  return normalizeSourceName(finalSource);
}
