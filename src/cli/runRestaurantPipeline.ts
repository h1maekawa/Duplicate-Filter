import path from 'node:path';

import { loadInputFiles } from '../lib/restaurant-pipeline/io';
import { runRestaurantPipeline } from '../lib/restaurant-pipeline/pipeline';

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

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const input = String(args.input ?? '');
  const output = String(args.output ?? 'output/restaurant-dedup-result.json');
  const chainDb = String(args.chainDb ?? 'api/masters/chains_master.csv');
  const removeBusinessWords = Boolean(args.removeBusinessWords);

  if (!input) {
    throw new Error('入力ファイルを --input で指定してください。複数ファイルはカンマ区切りです。');
  }

  const inputPaths = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(process.cwd(), item));

  const records = await loadInputFiles(inputPaths);
  const result = await runRestaurantPipeline(records, {
    inputPaths,
    outputPath: path.resolve(process.cwd(), output),
    chainDbPath: path.resolve(process.cwd(), chainDb),
    normalize: {
      removeBusinessWords,
    },
  });

  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
