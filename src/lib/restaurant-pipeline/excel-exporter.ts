import * as XLSX from 'xlsx';
import { PipelineResult } from './types';

/**
 * 統合結果をマルチシートの Excel ファイル (.xlsx) として出力するための Blob を生成する
 */
export function generateExcelBlob(result: PipelineResult): Blob {
  const wb = XLSX.utils.book_new();

  // 1. 統合済み店舗リスト
  const stores = result?.stores || [];
  const integratedData = stores.map(store => {
    return {
      '店舗ID': store.storeId,
      '店名': store.name,
      'エリア': store.area || '',
      'ジャンル': store.category || '',
      '電話番号': store.phone,
      '住所': store.address,
      '重複': (store.rawRecords?.length || 1) > 1 ? 'あり' : 'なし',
      '統合された店舗数': (store.rawRecords?.length || 1),
      '緯度': store.lat,
      '経度': store.lng,
      'URL': store.url,
      'ソース': (store.sources || []).join(' | '),
      '最高重複スコア': store.duplicateScore
    };
  });
  const wsIntegrated = XLSX.utils.json_to_sheet(integratedData);
  XLSX.utils.book_append_sheet(wb, wsIntegrated, '統合データ');

  // 2. 重複排除(統合元)リスト
  const duplicatedData: any[] = [];
  stores.forEach(store => {
    if (store.rawRecords && store.rawRecords.length > 1) {
      store.rawRecords.slice(1).forEach(r => {
        // 重複判定のログから理由とスコアを探す
        const dupLog = r.logs?.find(l => l.code === 'duplicate_match');
        duplicatedData.push({
          '店名': r.name,
          'エリア': r.area || '',
          'ジャンル': r.category || '',
          '電話番号': r.phone,
          '住所': r.address,
          'URL': r.url,
          'ソース': r.source,
          '判定スコア': dupLog?.score || '',
          '判定理由': (dupLog?.meta?.reasons as string[])?.join(', ') || '',
          '統合先店舗ID': store.storeId,
          '統合先店名': store.name
        });
      });
    }
  });
  const wsDuplicated = XLSX.utils.json_to_sheet(duplicatedData);
  XLSX.utils.book_append_sheet(wb, wsDuplicated, '重複排除済み');

  // 3. チェーン店除外リスト
  const excluded = result?.chainExcluded || [];
  const chainExcludedData = excluded.map(r => {
    const chainLog = r.logs?.find(l => l.code === 'excluded_chain');
    const aeonLog = r.logs?.find(l => l.code === 'excluded_aeon_mall');
    const commLog = r.logs?.find(l => l.code === 'excluded_commercial_facility');
    return {
      '店名(生)': r.rawName,
      'エリア': r.area || '',
      'ジャンル': r.category || '',
      '正規化店名': r.normalizedName,
      '電話番号': r.rawPhone,
      '住所': r.rawAddress,
      'URL': r.url,
      'ソース': r.source,
      '該当チェーン名': chainLog?.meta?.matchedChainName || (aeonLog ? 'イオンモール' : '') || (commLog?.meta?.matchedFacility as string || ''),
      '判定タイプ': chainLog?.meta?.matchType || (aeonLog ? 'イオンモール除外' : '') || (commLog ? '商業施設除外' : '')
    };
  });
  const wsChain = XLSX.utils.json_to_sheet(chainExcludedData);
  XLSX.utils.book_append_sheet(wb, wsChain, 'チェーン店除外');

  // Excelファイルのバイナリを生成
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
