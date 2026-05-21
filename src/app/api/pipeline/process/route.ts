import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline, normalizeRow } from '../../../../lib';
import { parse } from 'csv-parse/sync';
import chainData from '../../../../../data/chains.json';

// export const runtime = 'edge'; // Cloudflare用。ローカル動作優先のため一旦コメントアウト

export async function POST(request: NextRequest) {
  console.log('API Request received');
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const records: any[] = [];
    const chainNames = Array.isArray(chainData) ? chainData : [];

    for (const file of files) {
      const text = await file.text();
      const parsedRecords = parse(text, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      for (const record of parsedRecords) {
        const normalized = normalizeRow(record as Record<string, unknown>, file.name);
        records.push(normalized);
      }
    }

    const excludeCommercialFacilities = formData.get('excludeCommercialFacilities') === 'true';

    const result = await runRestaurantPipeline(records, {
      normalize: { removeBusinessWords: true },
      chainNames: chainNames as string[],
      excludeCommercialFacilities,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
