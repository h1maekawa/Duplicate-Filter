import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline } from '../../../../lib/restaurant-pipeline/pipeline';
import defaultChains from '../../../../../data/chains.json';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const removeBusinessWords = formData.get('removeBusinessWords') === 'true';

    if (files.length === 0) {
      return NextResponse.json({ error: 'ファイルが選択されていません。' }, { status: 400 });
    }

    const allRecords: any[] = [];

    for (const file of files) {
      const text = await file.text();
      const rows = text.split('\n').filter(line => line.trim());
      if (rows.length < 1) continue;

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
