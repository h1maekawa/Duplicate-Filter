import { PipelineResult } from './types';

/**
 * パイプライン結果をCSV文字列に変換する（統合データのみ）
 */
export function generateCsvContent(result: PipelineResult): string {
  const stores = result?.stores || [];
  if (stores.length === 0) return '';

  const headers = [
    'name',
    'phone',
    'category',
    'address',
    'businessHours',
    'regularHoliday',
    'url',
    'source',
    'storeId',
    'lat',
    'lng',
    'duplicateScore',
    'isChain',
    'createdAt'
  ];

  const rows = stores.map((store) => {
    return [
      store.name,
      store.phone,
      store.category ?? '',
      store.address,
      store.businessHours ?? '',
      store.regularHoliday ?? '',
      store.url,
      store.sources.join('|'),
      store.storeId,
      store.lat ?? '',
      store.lng ?? '',
      store.duplicateScore,
      store.isChain ? 'true' : 'false',
      store.createdAt
    ].map((val) => {
      // カンマや改行を含む場合にクォートで囲む
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
