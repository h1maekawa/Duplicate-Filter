import { NextRequest, NextResponse } from 'next/server';
import { runRestaurantPipeline } from '../../../../lib/restaurant-pipeline/pipeline';
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
      const rows = text.split('\n').filter(l => l.trim());
      if (rows.length <= 1) continue;
      
      const headers = rows[0].split(',').map(h => h.trim());
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const record: any = {};
        headers.forEach((h, idx) => { record[h] = values[idx]; });
        
        // Find if a source column exists in headers, otherwise fallback to file name
        const sourceKey = Object.keys(record).find(k => 
          ['source', '媒体', '媒体名', 'site', 'platform'].includes(k.trim().toLowerCase())
        );
        if (sourceKey && record[sourceKey]) {
          record.source = record[sourceKey];
        } else {
          record.source = file.name;
        }
        
        records.push(record);
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
