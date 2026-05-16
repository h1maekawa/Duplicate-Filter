import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { runRestaurantPipeline } from '../../../../lib/restaurant-pipeline/pipeline';
import type { PipelineInputRecord } from '../../../../lib/restaurant-pipeline/types';
import fs from 'node:fs/promises';
import path from 'node:path';

// Cloudflareデプロイ時は 'edge' に変更しますが、ローカル開発用に一旦コメントアウトします
// export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const removeBusinessWords = formData.get('removeBusinessWords') === 'true';

    if (files.length === 0) {
      return NextResponse.json({ error: 'ファイルが選択されていません。' }, { status: 400 });
    }

    // チェーン店リストのロード
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const allRecords: any[] = [];

    for (const file of files) {
      const text = await file.text();
      const rows = text.split('\n').filter(line => line.trim());
      const headers = rows[0].split(',').map(h => h.trim());

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        allRecords.push(record);
      }
    }

    // パイプライン実行（内蔵の chainNames を使用）
    const result = await runRestaurantPipeline(allRecords, {
      normalize: { removeBusinessWords },
      chainNames: defaultChains as string[],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
