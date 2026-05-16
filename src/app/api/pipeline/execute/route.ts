import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline } from '../../../../lib/restaurant-pipeline/pipeline';
import chainData from '../../../../../data/chains.json';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const records: any[] = [];
    const chainNames = Array.isArray(chainData) ? chainData : [];

    for (const file of files) {
      const text = await file.text();
      const rows = text.split('\n').filter(l => l.trim());
      if (rows.length < 1) continue;
      const headers = rows[0].split(',').map(h => h.trim());
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((h, idx) => { record[h] = values[idx]; });
        records.push(record);
      }
    }

    const result = await runRestaurantPipeline(records, {
      normalize: { removeBusinessWords: true },
      chainNames: chainNames as string[],
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
