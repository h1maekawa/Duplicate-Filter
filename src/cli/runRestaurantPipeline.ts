import path from 'node:path';
import fs from 'node:fs/promises';

import { loadInputFiles, runRestaurantPipeline, generateCsvContent } from '../lib';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    // Convert string "true"/"false" to actual booleans
    if (next === 'true') {
      parsed[key] = true;
    } else if (next === 'false') {
      parsed[key] = false;
    } else {
      parsed[key] = next;
    }
    i += 1;
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const input = String(args.input ?? '');
  const output = String(args.output ?? 'output/restaurant-dedup-result.json');
  const chainDb = String(args.chainDb ?? 'api/masters/chains_master.csv');

  // Boolean flags, handling both kebab-case and camelCase
  const removeBusinessWords = Boolean(args.removeBusinessWords || args['remove-business-words']);
  const stripPrefecture = Boolean(args.stripPrefecture || args['strip-prefecture']);
  const excludeCommercialFacilities = Boolean(
    args.excludeCommercialFacilities ||
    args['exclude-commercial-facilities'] ||
    args.excludeCommercial ||
    args['exclude-commercial']
  );
  const includeExcluded = Boolean(args.includeExcluded || args['include-excluded']);

  // Detect output format
  const formatArg = args.format ? String(args.format).toLowerCase() : '';
  const format = formatArg === 'csv' || formatArg === 'json'
    ? formatArg
    : (output.endsWith('.csv') ? 'csv' : 'json');

  if (!input) {
    throw new Error('入力ファイルを --input で指定してください。複数ファイルはカンマ区切りです。');
  }

  const inputPaths = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(process.cwd(), item));

  const resolvedOutputPath = path.resolve(process.cwd(), output);
  const resolvedChainDbPath = path.resolve(process.cwd(), chainDb);

  console.log(`[Pipeline] 入力ファイルパース中: ${inputPaths.join(', ')}`);
  const records = await loadInputFiles(inputPaths);
  console.log(`[Pipeline] 読み込み件数: ${records.length}件`);

  console.log(`[Pipeline] 重複排除パイプライン開始...`);
  // If format is JSON, pass outputPath to pipeline.ts to write JSON.
  // If format is CSV, don't pass it so pipeline doesn't overwrite it with JSON.
  const pipelineResult = await runRestaurantPipeline(records, {
    inputPaths,
    outputPath: format === 'json' ? resolvedOutputPath : undefined,
    chainDbPath: resolvedChainDbPath,
    excludeCommercialFacilities,
    normalize: {
      removeBusinessWords,
      stripPrefecture,
    },
  });

  // Ensure directory exists
  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });

  if (format === 'csv') {
    console.log(`[Pipeline] CSV出力作成中 (includeExcluded: ${includeExcluded})...`);
    const csvContent = generateCsvContent(pipelineResult, { includeExcluded });
    await fs.writeFile(resolvedOutputPath, csvContent, 'utf8');
    console.log(`[Pipeline] CSV出力を保存しました: ${resolvedOutputPath}`);
  } else {
    console.log(`[Pipeline] JSON出力を保存しました: ${resolvedOutputPath}`);
  }

  console.log('[Pipeline] 実行統計結果:');
  console.log(JSON.stringify(pipelineResult.summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
