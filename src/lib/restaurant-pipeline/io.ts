import { parse } from 'csv-parse/sync';
import { COLUMN_ALIASES, normalizeSourceName } from './constants';
import { safeNumber } from './normalizers';
import type { PipelineInputRecord, PipelineOptions, PipelineResult, SourceName } from './types';

// Edge Runtime かどうかを判定
const isEdge = process.env.NEXT_RUNTIME === 'edge';

function findValue(row: Record<string, unknown>, field: keyof typeof COLUMN_ALIASES): unknown {
  const aliases = COLUMN_ALIASES[field];
  for (const alias of aliases) {
    const foundKey = Object.keys(row).find((key) => key.trim().toLowerCase() === alias.trim().toLowerCase());
    if (foundKey) return row[foundKey];
  }
  return undefined;
}

function normalizeRow(row: Record<string, unknown>, sourceName: string): PipelineInputRecord {
  return {
    ...row,
    name: String(findValue(row, 'name') ?? '').trim(),
    address: String(findValue(row, 'address') ?? '').trim(),
    phone: String(findValue(row, 'phone') ?? '').trim(),
    lat: safeNumber(findValue(row, 'lat')),
    lng: safeNumber(findValue(row, 'lng')),
    url: String(findValue(row, 'url') ?? '').trim(),
    source: normalizeSourceName(String(findValue(row, 'source') ?? sourceName)),
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
  if (isEdge) return []; // Edge ではパス指定でのロードは行わない（インポートを使用）
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
