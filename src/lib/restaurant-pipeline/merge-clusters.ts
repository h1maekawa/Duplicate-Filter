import { SOURCE_PRIORITY } from './constants';
import { buildStoreId } from './hash';
import { createLog } from './log';
import type { DuplicateEvaluation, NormalizedStoreRecord, SourceName, StoreOutputRecord } from './types';

function sourceRank(source: SourceName): number {
  return SOURCE_PRIORITY[String(source)] ?? 0;
}

function richness(record: NormalizedStoreRecord): number {
  return (
    (record.normalizedPhone ? 1000 : 0) +
    sourceRank(record.source) +
    (record.url ? 30 : 0) +
    (record.rawAddress.length || 0) +
    (record.rawName.length || 0)
  );
}

export function selectPrimaryRecord(records: NormalizedStoreRecord[]): NormalizedStoreRecord {
  return [...records].sort((left, right) => richness(right) - richness(left))[0];
}

function uniqueSources(records: NormalizedStoreRecord[]): SourceName[] {
  return [...new Set(records.map((record) => record.source))].sort((a, b) => sourceRank(b) - sourceRank(a));
}

function chooseBestString(records: NormalizedStoreRecord[], picker: (record: NormalizedStoreRecord) => string): string {
  const ordered = [...records].sort((left, right) => richness(right) - richness(left));
  for (const record of ordered) {
    const value = picker(record);
    if (value) return value;
  }
  return '';
}

export function mergeCluster(
  records: NormalizedStoreRecord[],
  evaluations: DuplicateEvaluation[],
): StoreOutputRecord {
  const primary = selectPrimaryRecord(records);
  const duplicateScore = evaluations.length ? Math.max(...evaluations.map((item) => item.score)) : 0;
  const logs = [
    ...records.flatMap((record) => record.logs),
    createLog('merge', 'cluster_merged', '重複クラスタを統合', {
      clusterSize: records.length,
      primaryRecordIndex: primary.recordIndex,
      sources: uniqueSources(records),
    }, duplicateScore),
  ];

  const lat = primary.lat ?? records.find((item) => item.lat != null)?.lat ?? null;
  const lng = primary.lng ?? records.find((item) => item.lng != null)?.lng ?? null;
  const normalizedName = chooseBestString(records, (item) => item.normalizedName);
  const normalizedPhone = chooseBestString(records, (item) => item.normalizedPhone);

  return {
    storeId: buildStoreId([
      normalizedName,
      normalizedPhone,
      lat == null ? '' : lat.toFixed(6),
      lng == null ? '' : lng.toFixed(6),
    ]),
    name: chooseBestString(records, (item) => item.rawName),
    normalizedName,
    phone: chooseBestString(records, (item) => item.rawPhone),
    normalizedPhone,
    address: chooseBestString(records, (item) => item.rawAddress),
    normalizedAddress: chooseBestString(records, (item) => item.normalizedAddress),
    lat,
    lng,
    url: chooseBestString(records, (item) => item.url),
    sources: uniqueSources(records),
    area: chooseBestString(records, (item) => item.area),
    category: chooseBestString(records, (item) => item.category),
    isChain: records.some((item) => item.chainDecision?.isChain),
    duplicateChecked: true,
    duplicateScore,
    logs,
    createdAt: new Date().toISOString(),
    rawRecords: records.map((record) => ({
      source: record.source,
      name: record.rawName,
      address: record.rawAddress,
      phone: record.rawPhone,
      url: record.url,
      area: record.area,
      category: record.category,
      logs: record.logs,
    })),
  };
}
