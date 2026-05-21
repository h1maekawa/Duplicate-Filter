import { DEFAULT_SCORING_CONFIG } from './constants';
import { createLog } from './utils/log';
import { normalizeName, normalizePhone, normalizeAddress, normalizeUrl, safeNumber } from './normalize/normalizers';
import { isCommercialFacility } from './mall/mallDetection';
import { createChainMatcher, countBrandOccurrences } from './chain/chainDetection';
import { evaluateDuplicate } from './duplicate/duplicateScoring';
import { UnionFind } from './duplicate/unionFind';
import { mergeCluster } from './merge-clusters';
import { loadChainDatabase, writePipelineResult } from './parser/parseInputFiles';
import { buildGeoCellKey } from './utils/geo';
import scoringConfig from './config/scoring_config.json';
import type {
  PipelineInputRecord,
  PipelineOptions,
  NormalizedStoreRecord,
  DuplicateEvaluation,
  PipelineResult,
} from './types';

function buildNormalizedRecord(
  record: PipelineInputRecord,
  index: number,
  options: PipelineOptions,
): NormalizedStoreRecord {
  const normalizedName = normalizeName(record.name ?? '', options.normalize);
  const normalizedPhone = normalizePhone(record.phone ?? '');
  const normalizedAddress = normalizeAddress(record.address ?? '', options.normalize);
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
    businessHours: String(record.businessHours ?? ''),
    regularHoliday: String(record.regularHoliday ?? ''),
    sourceColumns: (record.sourceColumns as string[]) || Object.keys(record),
    raw: (record.raw as Record<string, unknown>) || { ...record },
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
    chainScore: 0,
    chain_flag: false,
    mall_flag: false,
    exclude_reason: [],
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

function toPairRecords(
  pairKey: string,
  indexMap: Map<number, NormalizedStoreRecord>,
): [NormalizedStoreRecord, NormalizedStoreRecord] {
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

  // Compute brand occurrence counts on the whole dataset
  const heavyBrands = countBrandOccurrences(normalizedRecords, scoringConfig.chain?.occurrenceThreshold || 5);

  const chainExcluded: NormalizedStoreRecord[] = [];
  const mallExcluded: NormalizedStoreRecord[] = [];
  const candidates: NormalizedStoreRecord[] = [];

  for (const record of normalizedRecords) {
    let excluded = false;

    // 1. Mall/Commercial facility check
    let isMall = false;
    if (options.excludeCommercialFacilities) {
      const commCheck = isCommercialFacility(record.rawName, record.rawAddress);
      if (commCheck.isMatch) {
        isMall = true;
        record.mall_flag = true;
        record.exclude_reason.push('mall_tenant');
        record.logs.push(
          createLog('mall', 'excluded_commercial_facility', '商業施設内店舗除外', {
            matchedFacility: commCheck.matchedPattern,
            rawName: record.rawName,
            rawAddress: record.rawAddress,
          }),
        );
      }
    } else if (isRocketNowOrMenu(record.source) && isAeonMall(record.rawName, record.rawAddress)) {
      isMall = true;
      record.mall_flag = true;
      record.exclude_reason.push('mall_tenant');
      record.logs.push(
        createLog('mall', 'excluded_aeon_mall', 'イオンモール除外（ロケットナウ・メニュー案件）', {
          source: record.source,
          rawName: record.rawName,
          rawAddress: record.rawAddress,
        }),
      );
    }

    // 2. Chain detection check
    const chainDecision = chainMatcher.detect(record, heavyBrands);
    record.chainDecision = chainDecision;

    if (chainDecision.isChain) {
      record.chain_flag = true;
      record.exclude_reason.push('chain_store');
      record.logs.push(
        createLog('exclude', 'excluded_chain', 'チェーン店として除外', {
          matchedChainName: chainDecision.matchedChainName,
          matchType: chainDecision.matchType,
          chainScore: record.chainScore,
        }),
      );
    }

    if (isMall) {
      mallExcluded.push(record);
      excluded = true;
    }
    if (record.chain_flag) {
      chainExcluded.push(record);
      excluded = true;
    }

    if (!excluded) {
      candidates.push(record);
    }
  }

  const indexMap = new Map(candidates.map((record) => [record.recordIndex, record]));
  const pairKeys = buildCandidatePairKeys(candidates);
  
  // Merge default config with config JSON and options
  const defaultScoring = scoringConfig.duplicate;
  const scoringParams = {
    phoneMatchScore: defaultScoring.phoneMatchScore || 100,
    distanceMatchScore: 50,
    nameSimilarityScore: 40,
    urlMatchScore: defaultScoring.urlMatchScore || 70,
    addressSimilarityScore: 20,
    duplicateThreshold: defaultScoring.duplicateThreshold || 70,
    distanceThresholdMeters: defaultScoring.distanceThresholdMeters || 30,
    nameSimilarityThreshold: defaultScoring.nameSimilarityThreshold || 0.85,
    addressSimilarityThreshold: defaultScoring.addressSimilarityThreshold || 0.80,
    ...options.scoring,
  };

  const duplicateMatches: Array<{ leftIndex: number; rightIndex: number; evaluation: DuplicateEvaluation }> = [];
  const uf = new UnionFind(normalizedRecords.length);

  for (const pairKey of pairKeys) {
    const [left, right] = toPairRecords(pairKey, indexMap);
    const evaluation = evaluateDuplicate(left, right, scoringParams);

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

  const duplicateExcludedCount = candidates.length - stores.length;

  const excludeReasonsStats: Record<string, number> = {
    chain_store: chainExcluded.length,
    mall_tenant: mallExcluded.length,
    duplicate: duplicateExcludedCount,
  };

  const result: PipelineResult = {
    summary: {
      inputCount: inputRecords.length,
      normalizedCount: normalizedRecords.length,
      chainExcludedCount: chainExcluded.length,
      mallExcludedCount: mallExcluded.length,
      duplicateExcludedCount,
      duplicateClusterCount: [...clusterMap.values()].filter((cluster) => cluster.length > 1).length,
      mergedCount: duplicateMatches.length,
      outputCount: stores.length,
      excludeReasonsStats,
    },
    stores,
    chainExcluded,
    mallExcluded,
    duplicateMatches,
  };

  await writePipelineResult(result, options);
  return result;
}
