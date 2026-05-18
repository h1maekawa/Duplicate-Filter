import { DEFAULT_SCORING_CONFIG } from './constants';
import { createChainMatcher } from './chain-detection';
import { buildGeoCellKey } from './geo';
import { loadChainDatabase, writePipelineResult } from './io';
import { createLog } from './log';
import { mergeCluster } from './merge-clusters';
import { evaluateDuplicate } from './duplicate-scoring';
import { normalizeAddress, normalizeName, normalizePhone, normalizeUrl, safeNumber } from './normalizers';
import type {
  DuplicateEvaluation,
  NormalizedStoreRecord,
  PipelineInputRecord,
  PipelineOptions,
  PipelineResult,
} from './types';

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    if (this.parent[index] !== index) {
      this.parent[index] = this.find(this.parent[index]);
    }
    return this.parent[index];
  }

  union(left: number, right: number): void {
    const rootLeft = this.find(left);
    const rootRight = this.find(right);
    if (rootLeft !== rootRight) {
      this.parent[rootRight] = rootLeft;
    }
  }
}

function buildNormalizedRecord(record: PipelineInputRecord, index: number, options: PipelineOptions): NormalizedStoreRecord {
  const normalizedName = normalizeName(record.name ?? '', options.normalize);
  const normalizedPhone = normalizePhone(record.phone ?? '');
  const normalizedAddress = normalizeAddress(record.address ?? '');
  const normalizedUrl = normalizeUrl(record.url ?? '');

  return {
    recordIndex: index,
    rawName: String(record.name ?? ''),
    normalizedName,
    rawPhone: String(record.phone ?? ''),
    normalizedPhone,
    rawAddress: String(record.address ?? ''),
    normalizedAddress,
    lat: safeNumber(record.lat),
    lng: safeNumber(record.lng),
    url: String(record.url ?? ''),
    normalizedUrl,
    source: String(record.source ?? 'unknown').toLowerCase(),
    area: String(record.area ?? ''),
    category: String(record.category ?? ''),
    raw: { ...record },
    logs: [
      createLog('normalize', 'normalized_record', '正規化を実行', {
        rawName: String(record.name ?? ''),
        normalizedName,
        rawPhone: String(record.phone ?? ''),
        normalizedPhone,
        rawAddress: String(record.address ?? ''),
        normalizedAddress,
      }),
    ],
  };
}

function addPairsFromBlocks(
  blocks: Map<string, number[]>,
  candidatePairs: Set<string>,
  indicesToRecords: Map<number, NormalizedStoreRecord>,
): void {
  for (const indices of blocks.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const left = indicesToRecords.get(indices[i]);
        const right = indicesToRecords.get(indices[j]);
        if (!left || !right) continue;
        candidatePairs.add(`${Math.min(left.recordIndex, right.recordIndex)}:${Math.max(left.recordIndex, right.recordIndex)}`);
      }
    }
  }
}

function buildCandidatePairKeys(records: NormalizedStoreRecord[]): string[] {
  if (records.length <= 500) {
    const allPairs: string[] = [];
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        allPairs.push(`${records[i].recordIndex}:${records[j].recordIndex}`);
      }
    }
    return allPairs;
  }

  const candidatePairs = new Set<string>();
  const phoneBlocks = new Map<string, number[]>();
  const nameBlocks = new Map<string, number[]>();
  const addressBlocks = new Map<string, number[]>();
  const urlBlocks = new Map<string, number[]>();
  const geoBlocks = new Map<string, number[]>();
  const indexMap = new Map(records.map((record) => [record.recordIndex, record]));

  for (const record of records) {
    if (record.normalizedPhone) {
      const key = `phone:${record.normalizedPhone}`;
      phoneBlocks.set(key, [...(phoneBlocks.get(key) ?? []), record.recordIndex]);
    }

    if (record.normalizedName.length >= 4) {
      const key = `name:${record.normalizedName.slice(0, 6)}`;
      nameBlocks.set(key, [...(nameBlocks.get(key) ?? []), record.recordIndex]);
    }

    if (record.normalizedAddress.length >= 6) {
      const key = `address:${record.normalizedAddress.slice(0, 10)}`;
      addressBlocks.set(key, [...(addressBlocks.get(key) ?? []), record.recordIndex]);
    }

    if (record.normalizedUrl) {
      const key = `url:${record.normalizedUrl}`;
      urlBlocks.set(key, [...(urlBlocks.get(key) ?? []), record.recordIndex]);
    }

    if (record.lat != null && record.lng != null) {
      const key = `geo:${buildGeoCellKey(record.lat, record.lng)}`;
      geoBlocks.set(key, [...(geoBlocks.get(key) ?? []), record.recordIndex]);
    }
  }

  addPairsFromBlocks(phoneBlocks, candidatePairs, indexMap);
  addPairsFromBlocks(nameBlocks, candidatePairs, indexMap);
  addPairsFromBlocks(addressBlocks, candidatePairs, indexMap);
  addPairsFromBlocks(urlBlocks, candidatePairs, indexMap);
  addPairsFromBlocks(geoBlocks, candidatePairs, indexMap);

  return [...candidatePairs];
}

function toPairRecords(pairKey: string, indexMap: Map<number, NormalizedStoreRecord>): [NormalizedStoreRecord, NormalizedStoreRecord] {
  const [leftIndex, rightIndex] = pairKey.split(':').map(Number);
  const left = indexMap.get(leftIndex);
  const right = indexMap.get(rightIndex);
  if (!left || !right) {
    throw new Error(`Invalid pair key: ${pairKey}`);
  }
  return [left, right];
}

function isRocketNowOrMenu(source: string): boolean {
  const s = source.toLowerCase();
  return (
    s.includes('rocket') ||
    s.includes('ロケット') ||
    s.includes('menu') ||
    s.includes('メニュー')
  );
}

function isAeonMall(name: string, address: string): boolean {
  const normalizedText = (name + ' ' + address).toLowerCase();
  return (
    normalizedText.includes('イオンモール') ||
    normalizedText.includes('aeonmall') ||
    (normalizedText.includes('aeon') && normalizedText.includes('mall')) ||
    (normalizedText.includes('イオン') && normalizedText.includes('モール'))
  );
}

export async function runRestaurantPipeline(
  inputRecords: PipelineInputRecord[],
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const normalizedRecords = inputRecords.map((record, index) => buildNormalizedRecord(record, index, options));
  const chainNames = options.chainNames ?? (options.chainDbPath ? await loadChainDatabase(options.chainDbPath) : []);
  const chainMatcher = createChainMatcher(chainNames, options.normalize);

  const chainExcluded: NormalizedStoreRecord[] = [];
  const candidates: NormalizedStoreRecord[] = [];

  for (const record of normalizedRecords) {
    // ロケットナウとメニューの案件に関してはイオンモールを省く
    if (isRocketNowOrMenu(record.source) && isAeonMall(record.rawName, record.rawAddress)) {
      record.logs.push(
        createLog('exclude', 'excluded_aeon_mall', 'イオンモール除外（ロケットナウ・メニュー案件）', {
          source: record.source,
          rawName: record.rawName,
          rawAddress: record.rawAddress,
        }),
      );
      chainExcluded.push(record);
      continue;
    }

    const chainDecision = chainMatcher.detect(record);
    record.chainDecision = chainDecision;

    if (chainDecision.isChain) {
      record.logs.push(
        createLog('exclude', 'excluded_chain', 'チェーン店として除外', {
          matchedChainName: chainDecision.matchedChainName,
          matchType: chainDecision.matchType,
        }),
      );
      chainExcluded.push(record);
      continue;
    }

    candidates.push(record);
  }

  const indexMap = new Map(candidates.map((record) => [record.recordIndex, record]));
  const pairKeys = buildCandidatePairKeys(candidates);
  const scoringConfig = { ...DEFAULT_SCORING_CONFIG, ...options.scoring };
  const duplicateMatches: Array<{ leftIndex: number; rightIndex: number; evaluation: DuplicateEvaluation }> = [];
  const uf = new UnionFind(normalizedRecords.length);

  for (const pairKey of pairKeys) {
    const [left, right] = toPairRecords(pairKey, indexMap);
    const evaluation = evaluateDuplicate(left, right, scoringConfig);

    if (!evaluation.duplicate) continue;

    left.logs.push(
      createLog('duplicate', 'duplicate_match', '重複候補として採用', {
        againstRecordIndex: right.recordIndex,
        reasons: evaluation.reasons,
      }, evaluation.score),
    );
    right.logs.push(
      createLog('duplicate', 'duplicate_match', '重複候補として採用', {
        againstRecordIndex: left.recordIndex,
        reasons: evaluation.reasons,
      }, evaluation.score),
    );

    uf.union(left.recordIndex, right.recordIndex);
    duplicateMatches.push({
      leftIndex: left.recordIndex,
      rightIndex: right.recordIndex,
      evaluation,
    });
  }

  const clusterMap = new Map<number, NormalizedStoreRecord[]>();
  for (const record of candidates) {
    const root = uf.find(record.recordIndex);
    clusterMap.set(root, [...(clusterMap.get(root) ?? []), record]);
  }

  const stores = [...clusterMap.values()].map((clusterRecords) => {
    const clusterEvaluations = duplicateMatches
      .filter(
        (item) =>
          clusterRecords.some((record) => record.recordIndex === item.leftIndex) &&
          clusterRecords.some((record) => record.recordIndex === item.rightIndex),
      )
      .map((item) => item.evaluation);

    const store = mergeCluster(clusterRecords, clusterEvaluations);
    store.logs.push(createLog('output', 'output_ready', 'JSON出力レコード生成完了', { storeId: store.storeId }));
    return store;
  });

  const result: PipelineResult = {
    summary: {
      inputCount: inputRecords.length,
      normalizedCount: normalizedRecords.length,
      chainExcludedCount: chainExcluded.length,
      duplicateClusterCount: [...clusterMap.values()].filter((cluster) => cluster.length > 1).length,
      mergedCount: duplicateMatches.length,
      outputCount: stores.length,
    },
    stores,
    chainExcluded,
    duplicateMatches,
  };

  await writePipelineResult(result, options);
  return result;
}
