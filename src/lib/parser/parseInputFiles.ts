import { parse } from 'csv-parse/sync';
import { SOURCE_COLUMN_MAPPINGS } from '../constants';
import { safeNumber } from '../normalize/normalizers';
import { detectSource } from './detectSource';
import type { PipelineInputRecord, PipelineOptions, PipelineResult } from '../types';

const isEdge = process.env.NEXT_RUNTIME === 'edge';

const DEFAULT_MAPPING: Record<string, string[]> = {
  name: ['name', '店舗名', '店名', 'restaurant_name'],
  address: ['address', '住所', '所在地'],
  phone: ['phone', '電話番号', '電話', 'tel'],
  lat: ['lat', 'latitude', '緯度'],
  lng: ['lng', 'lon', 'longitude', '経度'],
  url: ['url', 'URL', '店舗URL', 'store_url'],
  area: ['area', 'region', 'prefecture', 'city', 'エリア', '地域', '市区町村', '都道府県'],
  category: ['category', 'genre', 'type', 'カテゴリ', 'ジャンル', '業種'],
  businessHours: ['businessHours', '営業時間', '営業日', 'opening_hours', 'open_hours', 'hours'],
  regularHoliday: ['regularHoliday', '定休日', '定期休日', 'regular_holiday', 'holiday', 'closed_days'],
};

function findValueByMapping(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
    if (foundKey) return row[foundKey];
  }
  return undefined;
}

export function normalizeRow(row: Record<string, unknown>, filenameFallback: string): PipelineInputRecord {
  const normalizedSource = detectSource(row, filenameFallback);
  const mapping = SOURCE_COLUMN_MAPPINGS[normalizedSource] ?? {};

  const nameKeys = [...(mapping.name ?? []), ...DEFAULT_MAPPING.name];
  const addressKeys = [...(mapping.address ?? []), ...DEFAULT_MAPPING.address];
  const phoneKeys = [...(mapping.phone ?? []), ...DEFAULT_MAPPING.phone];
  const urlKeys = [...(mapping.url ?? []), ...DEFAULT_MAPPING.url];
  const categoryKeys = [...(mapping.category ?? []), ...DEFAULT_MAPPING.category];
  const businessHoursKeys = [...(mapping.businessHours ?? []), ...DEFAULT_MAPPING.businessHours];
  const regularHolidayKeys = [...(mapping.regularHoliday ?? []), ...DEFAULT_MAPPING.regularHoliday];

  const latKeys = [...(mapping.lat ?? []), ...DEFAULT_MAPPING.lat];
  const lngKeys = [...(mapping.lng ?? []), ...DEFAULT_MAPPING.lng];
  const areaKeys = [...(mapping.area ?? []), ...DEFAULT_MAPPING.area];

  const sourceColumns = Object.keys(row);

  return {
    ...row,
    name: String(findValueByMapping(row, nameKeys) ?? '').trim(),
    address: String(findValueByMapping(row, addressKeys) ?? '').trim(),
    phone: String(findValueByMapping(row, phoneKeys) ?? '').trim(),
    lat: safeNumber(findValueByMapping(row, latKeys)),
    lng: safeNumber(findValueByMapping(row, lngKeys)),
    url: String(findValueByMapping(row, urlKeys) ?? '').trim(),
    source: normalizedSource,
    area: String(findValueByMapping(row, areaKeys) ?? '').trim(),
    category: String(findValueByMapping(row, categoryKeys) ?? '').trim(),
    businessHours: String(findValueByMapping(row, businessHoursKeys) ?? '').trim(),
    regularHoliday: String(findValueByMapping(row, regularHolidayKeys) ?? '').trim(),
    sourceColumns,
    raw: { ...row },
  };
}

export async function loadInputFile(filePath: string): Promise<PipelineInputRecord[]> {
  if (isEdge) throw new Error('File system access is not supported in Edge Runtime.');
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const rawText = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  if (ext === '.json') {
    const parsed = JSON.parse(rawText);
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [];
    return items.map((row: unknown) => normalizeRow(row as Record<string, unknown>, filename));
  }

  if (ext === '.csv') {
    const records = parse(rawText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, unknown>[];

    return records.map((row) => normalizeRow(row, filename));
  }

  throw new Error(`Unsupported input format: ${filePath}`);
}

export async function loadInputFiles(filePaths: string[]): Promise<PipelineInputRecord[]> {
  const chunks = await Promise.all(filePaths.map((filePath) => loadInputFile(filePath)));
  return chunks.flat();
}

export async function loadChainDatabase(filePath: string): Promise<string[]> {
  if (isEdge) return [];
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');

  const rawText = await readFile(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) return parsed.map((item: unknown) => String(item));
    if (Array.isArray(parsed.chains)) return parsed.chains.map((item: unknown) => String(item));
    return [];
  }

  if (ext === '.csv') {
    const records = parse(rawText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true,
    }) as Record<string, unknown>[];

    return records
      .map((row) => {
        const firstKey = Object.keys(row)[0];
        return firstKey ? String(row[firstKey] ?? '').trim() : '';
      })
      .filter(Boolean);
  }

  throw new Error(`Unsupported chain DB format: ${filePath}`);
}

export async function writePipelineResult(result: PipelineResult, options: PipelineOptions): Promise<void> {
  if (isEdge || !options.outputPath) return;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
