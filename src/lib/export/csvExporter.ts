import type { PipelineResult, StoreOutputRecord, NormalizedStoreRecord } from '../types';

function convertNormalizedToOutput(record: NormalizedStoreRecord): StoreOutputRecord {
  return {
    storeId: record.normalizedUrl || `rec_${record.recordIndex}`,
    name: record.rawName,
    normalizedName: record.normalizedName,
    phone: record.rawPhone,
    normalizedPhone: record.normalizedPhone,
    address: record.rawAddress,
    normalizedAddress: record.normalizedAddress,
    lat: record.lat,
    lng: record.lng,
    url: record.url,
    sources: [record.source],
    area: record.area,
    category: record.category,
    businessHours: record.businessHours,
    regularHoliday: record.regularHoliday,
    isChain: record.chain_flag,
    duplicateChecked: false,
    duplicateScore: record.chainScore || 0,
    logs: record.logs,
    createdAt: new Date().toISOString(),
    rawRecords: [],
    chain_flag: record.chain_flag,
    mall_flag: record.mall_flag,
    exclude_reason: record.exclude_reason || [],
    raw: record.raw || {},
  };
}

/**
 * パイプライン結果をCSV文字列に変換する（元カラムを保持）
 */
export function generateCsvContent(result: PipelineResult, options: { includeExcluded?: boolean } = {}): string {
  let stores = [...(result.stores || [])];

  if (options.includeExcluded) {
    if (result.chainExcluded) {
      for (const r of result.chainExcluded) {
        stores.push(convertNormalizedToOutput(r));
      }
    }
    if (result.mallExcluded) {
      for (const r of result.mallExcluded) {
        stores.push(convertNormalizedToOutput(r));
      }
    }
  } else {
    // Default: filter out records with active exclude reasons or flags
    stores = stores.filter(
      (s) => !s.chain_flag && !s.mall_flag && (!s.exclude_reason || s.exclude_reason.length === 0),
    );
  }

  if (stores.length === 0) return '';

  // Get the list of all unique columns present in any raw record, preserving order of first appearance
  const orderedHeaders: string[] = [];
  const seen = new Set<string>();
  
  for (const store of stores) {
    if (store.raw) {
      for (const key of Object.keys(store.raw)) {
        // Skip keys that conflict with our added extra properties
        const lk = key.trim().toLowerCase();
        if (['normalized_name', 'normalized_address', 'duplicate_score', 'chain_flag', 'mall_flag', 'exclude_reason'].includes(lk)) {
          continue;
        }
        if (!seen.has(key)) {
          seen.add(key);
          orderedHeaders.push(key);
        }
      }
    }
  }

  const extraHeaders = [
    'normalized_name',
    'normalized_address',
    'duplicate_score',
    'chain_flag',
    'mall_flag',
    'exclude_reason',
  ];

  const headers = [...orderedHeaders, ...extraHeaders];

  // 電話番号がある店舗を上に、空白の店舗を下にソート
  const sortedStores = [...stores].sort((a, b) => {
    const hasPhoneA = Boolean(a.phone && a.phone.trim() !== '');
    const hasPhoneB = Boolean(b.phone && b.phone.trim() !== '');
    if (hasPhoneA && !hasPhoneB) return -1;
    if (!hasPhoneA && hasPhoneB) return 1;
    return 0;
  });

  const rows = sortedStores.map((store) => {
    const rowValues: string[] = [];

    // 1. Add all raw columns
    for (const header of orderedHeaders) {
      const val = store.raw ? store.raw[header] : undefined;
      rowValues.push(val == null ? '' : String(val));
    }

    // 2. Add extra analysis columns
    rowValues.push(store.normalizedName || '');
    rowValues.push(store.normalizedAddress || '');
    rowValues.push(store.duplicateScore != null ? String(store.duplicateScore) : '0');
    rowValues.push(store.chain_flag ? 'true' : 'false');
    rowValues.push(store.mall_flag ? 'true' : 'false');
    rowValues.push(store.exclude_reason && store.exclude_reason.length > 0 ? store.exclude_reason.join('|') : '');

    return rowValues.map((val) => {
      // Escape commas, quotes, and newlines
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
