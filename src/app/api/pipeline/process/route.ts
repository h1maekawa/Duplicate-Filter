import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline, normalizeRow } from '../../../../lib';
import { parse } from 'csv-parse/sync';
import chainData from '../../../../../data/chains.json';
import type { PipelineInputRecord } from '../../../../lib/types';

// export const runtime = 'edge'; // Cloudflare用。ローカル動作優先のため一旦コメントアウト

/**
 * 【修正】ファイルのバイト列を適切なエンコーディングで文字列に変換する。
 * - UTF-8 BOM (EF BB BF) → UTF-8
 * - UTF-16 LE BOM (FF FE) → UTF-16 LE
 * - Shift-JIS 判定: 0x81-0x9F / 0xE0-0xFC の2バイト文字パターンを検出
 * - その他 → UTF-8 フォールバック
 */
function decodeFileBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // UTF-8 BOM チェック
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer);
  }

  // UTF-16 LE BOM チェック
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer);
  }

  // Shift-JIS ヒューリスティック検出
  // Shift-JIS の2バイト文字: 先行バイトが 0x81-0x9F または 0xE0-0xFC
  let shiftJisScore = 0;
  let utf8Score = 0;
  const sampleLength = Math.min(bytes.length, 1024);

  for (let i = 0; i < sampleLength - 1; i++) {
    const b = bytes[i];
    if ((b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xFC)) {
      const next = bytes[i + 1];
      if ((next >= 0x40 && next <= 0x7E) || (next >= 0x80 && next <= 0xFC)) {
        shiftJisScore++;
        i++; // 2バイト文字として次バイトをスキップ
      }
    }
    // UTF-8 マルチバイトシーケンス検出
    if ((b & 0xE0) === 0xC0 && (bytes[i + 1] & 0xC0) === 0x80) {
      utf8Score++;
      i++;
    }
  }

  if (shiftJisScore > utf8Score && shiftJisScore > 2) {
    try {
      return new TextDecoder('shift_jis').decode(buffer);
    } catch {
      // Shift-JIS デコード失敗時は UTF-8 にフォールバック
    }
  }

  return new TextDecoder('utf-8').decode(buffer);
}

export async function POST(request: NextRequest) {
  console.log('[API] Request received');
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const records: PipelineInputRecord[] = [];
    const chainNames = Array.isArray(chainData) ? (chainData as string[]) : [];
    console.log(`[API] Loaded chainNames count: ${chainNames.length}`);

    for (const file of files) {
      // 【修正】ArrayBuffer で読み込み、エンコーディングを自動判定
      const buffer = await file.arrayBuffer();
      const text = decodeFileBuffer(buffer);

      let parsedRecords: Record<string, unknown>[];
      try {
        parsedRecords = parse(text, {
          bom: true,
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }) as Record<string, unknown>[];
      } catch (parseErr) {
        const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.warn(`[API] CSV parse error in ${file.name}: ${errMsg}`);
        // パースエラーが発生したファイルはスキップし、処理を継続
        continue;
      }

      if (parsedRecords.length === 0) {
        console.warn(`[API] No records parsed from ${file.name} (empty or header-only)`);
        continue;
      }

      console.log(`[API] Parsed ${parsedRecords.length} records from ${file.name}`);

      for (const record of parsedRecords) {
        const normalized = normalizeRow(record, file.name);
        // 店名が空のレコードはスキップ
        if (!normalized.name || !String(normalized.name).trim()) {
          continue;
        }
        records.push(normalized);
      }
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: '有効なレコードが見つかりませんでした。CSVのフォーマットと文字コードを確認してください。' },
        { status: 400 },
      );
    }

    const excludeCommercialFacilities = formData.get('excludeCommercialFacilities') === 'true';
    const removeBusinessWords = formData.get('removeBusinessWords') === 'true';
    console.log(`[API] excludeCommercialFacilities: ${excludeCommercialFacilities}`);
    console.log(`[API] removeBusinessWords: ${removeBusinessWords}`);
    console.log(`[API] Total records to process: ${records.length}`);

    const result = await runRestaurantPipeline(records, {
      normalize: { removeBusinessWords },
      chainNames,
      excludeCommercialFacilities,
    });

    console.log('[API] Pipeline result summary:', JSON.stringify(result.summary, null, 2));

    return NextResponse.json(result);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] Error in route:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}