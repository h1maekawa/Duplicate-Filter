import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline } from '../../../../lib/restaurant-pipeline/pipeline';
import chainData from '../../../../../data/chains.json';

// Cloudflare Edge Runtime を指定
// Deployment Trigger: Build Refresh v2
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const removeBusinessWords = formData.get('removeBusinessWords') === 'true';

    if (files.length === 0) {
      return NextResponse.json({ error: 'ファイルが選択されていません。' }, { status: 400 });
    }

    const allRecords: Record<string, any>[] = [];

    // チェーン店リストを確実に配列として取得
    const chainNames = Array.isArray(chainData) ? chainData : (chainData as any).chains || [];

    for (const file of files) {
      const text = await file.text();
      const rows = text.split('\n').filter(line => line.trim());
      if (rows.length < 1) continue;

      const headers = rows[0].split(',').map(h => h.trim());

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const record: Record<string, any> = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });
        allRecords.push(record);
      }
    }

    const result = await runRestaurantPipeline(allRecords as any, {
      normalize: { removeBusinessWords },
      chainNames: chainNames as string[],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pipeline error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
