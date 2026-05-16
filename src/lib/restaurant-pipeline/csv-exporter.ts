import { PipelineResult } from './types';

/**
 * パイプライン結果をCSV文字列に変換する（統合データのみ）
 */
export function generateCsvContent(result: PipelineResult): string {
  const stores = result?.stores || [];
  if (stores.length === 0) return '';

  const headers = [
    'storeId',
    'name',
    'phone',
    'address',
    'lat',
    'lng',
    'url',
    'sources',
    'duplicateScore',
    'isChain',
    'createdAt'
  ];

  const rows = stores.map((store) => {
    return [
      store.storeId,
      store.name,
      store.phone,
      store.address,
      store.lat ?? '',
      store.lng ?? '',
      store.url,
      store.sources.join('|'),
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
