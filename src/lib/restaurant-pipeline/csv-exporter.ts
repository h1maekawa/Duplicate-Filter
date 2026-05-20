import { PipelineResult } from './types';

/**
 * パイプライン結果をCSV文字列に変換する（統合データのみ）
 */
export function generateCsvContent(result: PipelineResult): string {
  const stores = result?.stores || [];
  if (stores.length === 0) return '';

  const headers = [
    'name',
    'category',
    'phone',
    'address',
    'regularHoliday',
    'businessHours',
    'url',
    'source',
    'storeId',
    'lat',
    'lng',
    'duplicateScore',
    'isChain',
    'createdAt'
  ];

  // 電話番号がある店舗を上に、空白の店舗を下にソート
  const sortedStores = [...stores].sort((a, b) => {
    const hasPhoneA = Boolean(a.phone && a.phone.trim() !== '');
    const hasPhoneB = Boolean(b.phone && b.phone.trim() !== '');
    if (hasPhoneA && !hasPhoneB) return -1;
    if (!hasPhoneA && hasPhoneB) return 1;
    return 0;
  });

  const rows = sortedStores.map((store) => {
    return [
      store.name,
      store.category ?? '',
      store.phone,
      store.address,
      store.regularHoliday ?? '',
      store.businessHours ?? '',
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

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
