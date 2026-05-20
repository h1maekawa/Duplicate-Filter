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

function selectBestRecordForField(
  records: NormalizedStoreRecord[],
  priority: string[],
  hasValue: (record: NormalizedStoreRecord) => boolean
): NormalizedStoreRecord | null {
  for (const source of priority) {
    const matched = records.find((r) => r.source === source && hasValue(r));
    if (matched) return matched;
  }
  // 優先度リストにない場合は、richness順でフォールバック
  const ordered = [...records].sort((left, right) => richness(right) - richness(left));
  return ordered.find(hasValue) || null;
}

export function formatRegularHoliday(value: string): string {
  if (!value || !value.trim()) return 'なし';
  const val = value.trim();

  if (val.includes('不定休')) return '不定休';
  if (val.includes('無休') || val.includes('なし')) return 'なし';

  const days = ['月', '火', '水', '木', '金', '土', '日'];
  const matchedDays: string[] = [];

  for (const day of days) {
    if (val.includes(day)) {
      matchedDays.push(`${day}曜`);
    }
  }

  if (matchedDays.length > 0) {
    return matchedDays.join(', ');
  }

  return val;
}

export function formatBusinessHours(value: string): string {
  if (!value || !value.trim()) return '';
  let text = value.trim();

  // 1. 正規化 (全角コロン、スペース、チルダ等の共通化)
  text = text.replace(/：/g, ':');
  text = text.replace(/[～〜–－-]+/g, '〜');
  text = text.replace(/[\s　]+/g, ' ');

  // 2. 不要なL.O.情報（カッコ書き等）を削除
  text = text.replace(/[（\(][^）\)]*[）\)]/g, '');

  // 3. 曜日や時間帯のブロックにパースする
  const weekdayRegex = /(月〜金|土日祝|平日|土日|祝日|月〜木|金土日|月|火|水|木|金|土|日|祝前日|祝)/;
  const timeRegex = /\d{1,2}:\d{2}〜\d{1,2}:\d{2}/g;

  const allTimes = text.match(timeRegex);
  if (allTimes && !weekdayRegex.test(text)) {
    return `全日：${allTimes.join(' / ')}`;
  }

  const parts = text.split(/(?=[月土平祝金日曜])|(?=[A-Za-z]+:)/);
  const formattedBlocks: string[] = [];

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const dayMatch = trimmedPart.match(weekdayRegex);
    const dayGroup = dayMatch ? dayMatch[0] : '全日';

    const times = trimmedPart.match(timeRegex);
    if (times && times.length > 0) {
      formattedBlocks.push(`${dayGroup}：${times.join(' / ')}`);
    }
  }

  if (formattedBlocks.length > 0) {
    return formattedBlocks.join('\n');
  }

  return text;
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

  // 各項目で優先するソースからレコードを選択
  const phoneRecord = selectBestRecordForField(records, ['google', 'tabelog', 'hotpepper'], (item) => Boolean(item.rawPhone));
  const rawPhone = phoneRecord ? phoneRecord.rawPhone : '';
  const normalizedPhone = (() => {
    if (!phoneRecord) return '';
    const digits = phoneRecord.normalizedPhone;
    if (digits.length !== 10 && digits.length !== 11) return '';
    return digits;
  })();
  const phone = (() => {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) return '';
    return rawPhone;
  })();

  const bhRecord = selectBestRecordForField(records, ['tabelog', 'hotpepper', 'google'], (item) => Boolean(item.businessHours));
  const rawBusinessHours = bhRecord ? bhRecord.businessHours : '';
  const businessHours = formatBusinessHours(rawBusinessHours);

  const rhRecord = selectBestRecordForField(records, ['google', 'tabelog', 'hotpepper'], (item) => Boolean(item.regularHoliday));
  const rawRegularHoliday = rhRecord ? rhRecord.regularHoliday : '';
  const regularHoliday = formatRegularHoliday(rawRegularHoliday);

  const addrRecord = selectBestRecordForField(records, ['google', 'tabelog', 'hotpepper'], (item) => Boolean(item.rawAddress));
  const address = addrRecord ? addrRecord.rawAddress : '';
  const normalizedAddress = addrRecord ? addrRecord.normalizedAddress : '';

  const catRecord = selectBestRecordForField(records, ['tabelog', 'hotpepper', 'google'], (item) => Boolean(item.category));
  const category = catRecord ? catRecord.category : '';

  const urlRecord = selectBestRecordForField(records, ['google', 'tabelog', 'hotpepper'], (item) => Boolean(item.url));
  const url = urlRecord ? urlRecord.url : '';

  const nameRecord = selectBestRecordForField(records, ['google', 'tabelog', 'hotpepper'], (item) => Boolean(item.rawName));
  const name = nameRecord ? nameRecord.rawName : primary.rawName;
  const normalizedName = nameRecord ? nameRecord.normalizedName : primary.normalizedName;

  return {
    storeId: buildStoreId([
      normalizedName,
      normalizedPhone,
      lat == null ? '' : lat.toFixed(6),
      lng == null ? '' : lng.toFixed(6),
    ]),
    name,
    normalizedName,
    phone,
    normalizedPhone,
    address,
    normalizedAddress,
    lat,
    lng,
    url,
    sources: uniqueSources(records),
    area: chooseBestString(records, (item) => item.area),
    category,
    businessHours,
    regularHoliday,
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
      businessHours: record.businessHours,
      regularHoliday: record.regularHoliday,
      logs: record.logs,
    })),
  };
}
