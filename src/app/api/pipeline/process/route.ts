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
    console.log(`[API] Loaded chainNames count: ${chainNames.length}`);

    for (const file of files) {
      const text = await file.text();
      const parsedRecords = parse(text, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
      console.log(`[API] Parsed ${parsedRecords.length} records from ${file.name}`);

      for (const record of parsedRecords) {
        const normalized = normalizeRow(record as Record<string, unknown>, file.name);
        records.push(normalized);
      }
    }

    const excludeCommercialFacilities = formData.get('excludeCommercialFacilities') === 'true';
    const removeBusinessWords = formData.get('removeBusinessWords') === 'true';
    console.log(`[API] excludeCommercialFacilities option: ${excludeCommercialFacilities}`);
    console.log(`[API] removeBusinessWords option: ${removeBusinessWords}`);

    const result = await runRestaurantPipeline(records, {
      normalize: { removeBusinessWords },
      chainNames: chainNames as string[],
      excludeCommercialFacilities,
    });

    console.log('[API] Pipeline result summary:', JSON.stringify(result.summary, null, 2));

    // Log sample excluded records or search for Aloha Table
    const alohaInMall = result.mallExcluded.filter(r => r.rawName.includes('アロハテーブル'));
    console.log(`[API] Aloha Table in mallExcluded: ${alohaInMall.length}`);
    if (alohaInMall.length > 0) {
      console.log('[API] Aloha Table flags in mallExcluded:', {
        chain_flag: alohaInMall[0].chain_flag,
        mall_flag: alohaInMall[0].mall_flag,
        exclude_reason: alohaInMall[0].exclude_reason,
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API] Error in route:', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}

