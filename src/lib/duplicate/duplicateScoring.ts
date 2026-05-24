import scoringConfig from '../config/scoring_config.json';
import { haversineDistanceMeters } from '../utils/geo';
import { jaroWinkler } from '../utils/similarity';
import type { DuplicateEvaluation, DuplicateScoringConfig, NormalizedStoreRecord } from '../types';

const defaultScoring = scoringConfig.duplicate;

function getDistance(a: NormalizedStoreRecord, b: NormalizedStoreRecord): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
}

/**
 * 【修正】住所の番地部分（数字列）を抽出して比較する。
 * - 先頭3つの数字群（丁目・番地・号レベル）を比較
 * - 3つとも一致した場合のみ "同じ番地" とみなす
 * - 例: "1-2-3" と "1-2-4" → 不一致（3つ目が違う）
 * - 例: "1-2-3" と "1-2" → 先頭2つが一致し、片方のみ3つ目がない場合は一致とみなす
 */
function extractAddressNumbers(address: string): string[] {
  const matches = address.match(/\d+/g);
  return matches ?? [];
}

function addressNumbersSimilar(addrA: string, addrB: string): boolean {
  if (!addrA || !addrB) return false;
  const numsA = extractAddressNumbers(addrA);
  const numsB = extractAddressNumbers(addrB);
  if (numsA.length === 0 || numsB.length === 0) return false;

  // 比較対象は先頭3つまで（丁目・番・号）
  const compareLength = Math.min(3, numsA.length, numsB.length);

  for (let i = 0; i < compareLength; i++) {
    if (numsA[i] !== numsB[i]) return false;
  }

  return true;
}

export function evaluateDuplicate(
  left: NormalizedStoreRecord,
  right: NormalizedStoreRecord,
  partialConfig: Partial<DuplicateScoringConfig> = {},
): DuplicateEvaluation {
  const config: DuplicateScoringConfig = {
    phoneMatchScore: defaultScoring.phoneMatchScore || 100,
    distanceMatchScore: 50,
    nameSimilarityScore: 40,
    urlMatchScore: defaultScoring.urlMatchScore || 70,
    addressSimilarityScore: 20,
    duplicateThreshold: defaultScoring.duplicateThreshold || 70,
    // GPS誤差(媒体間ズレ平均50〜100m)を吸収するため80mに設定
    distanceThresholdMeters: defaultScoring.distanceThresholdMeters || 80,
    nameSimilarityThreshold: defaultScoring.nameSimilarityThreshold || 0.85,
    addressSimilarityThreshold: defaultScoring.addressSimilarityThreshold || 0.80,
    ...partialConfig,
  };

  const reasons: string[] = [];
  let duplicate = false;
  let score = 0;

  const phoneMatched = Boolean(
    left.normalizedPhone && right.normalizedPhone && left.normalizedPhone === right.normalizedPhone,
  );

  const urlMatched = Boolean(
    left.normalizedUrl && right.normalizedUrl && left.normalizedUrl === right.normalizedUrl,
  );

  const nameSimilarity = jaroWinkler(left.normalizedName, right.normalizedName);
  const addressSimilarity = jaroWinkler(left.normalizedAddress, right.normalizedAddress);

  // Level 1: 電話番号一致
  // ただし名前の類似度が低い場合（0.5未満）は共有電話番号の誤マッチを防ぐ
  if (phoneMatched) {
    if (nameSimilarity >= 0.5) {
      duplicate = true;
      score = config.phoneMatchScore;
      reasons.push('phone_match');
    } else {
      reasons.push('phone_match_rejected_name_mismatch');
    }
  }

  // Level 2: URL一致
  if (!duplicate && urlMatched) {
    duplicate = true;
    score = config.urlMatchScore;
    reasons.push('url_match');
  }

  // Level 3: 名前・住所の完全一致（電話番号なし店舗の救済）
  if (!duplicate) {
    const phoneMissing = !left.normalizedPhone || !right.normalizedPhone;
    if (
      phoneMissing &&
      left.normalizedName === right.normalizedName &&
      left.normalizedAddress === right.normalizedAddress
    ) {
      duplicate = true;
      score = defaultScoring.nameAddressExactScore || 90;
      reasons.push('name_and_address_exact_match');
    }
  }

  // Level 4: 名前・住所の類似度マッチ
  // 【修正】住所番地比較を先頭3つに強化
  if (!duplicate) {
    if (
      nameSimilarity >= config.nameSimilarityThreshold &&
      addressSimilarity >= config.addressSimilarityThreshold
    ) {
      const numsA = extractAddressNumbers(left.normalizedAddress);
      const numsB = extractAddressNumbers(right.normalizedAddress);
      const hasAddressNumbers = numsA.length > 0 && numsB.length > 0;
      const numbersMatch = addressNumbersSimilar(left.normalizedAddress, right.normalizedAddress);

      if (!hasAddressNumbers || numbersMatch) {
        duplicate = true;
        score = defaultScoring.similarityMatchScore || 80;
        reasons.push('similarity_match');
      } else {
        // 住所番地が異なる → 同チェーン別支店の可能性
        reasons.push('similarity_match_rejected_different_address_numbers');
      }
    }
  }

  const distanceMeters = getDistance(left, right);

  // Level 5: 距離ベース重複判定
  // 【修正】閾値を80mに緩和（旧: 30m）、名前類似度0.75以上
  if (!duplicate && distanceMeters != null && distanceMeters <= config.distanceThresholdMeters) {
    if (nameSimilarity >= 0.75) {
      duplicate = true;
      score = config.distanceMatchScore;
      reasons.push('distance_and_name_match');
    }
  }

  const evaluation = {
    pairKey: `${Math.min(left.recordIndex, right.recordIndex)}:${Math.max(left.recordIndex, right.recordIndex)}`,
    duplicate,
    score,
    reasons,
    nameSimilarity: Number(nameSimilarity.toFixed(4)),
    addressSimilarity: Number(addressSimilarity.toFixed(4)),
    distanceMeters: distanceMeters == null ? null : Number(distanceMeters.toFixed(2)),
    matchedOn: {
      phone: phoneMatched,
      distance: distanceMeters != null && distanceMeters <= config.distanceThresholdMeters,
      name: nameSimilarity >= config.nameSimilarityThreshold,
      url: urlMatched,
      address: addressSimilarity >= config.addressSimilarityThreshold,
    },
  };

  // デバッグログ: 重複ペアの詳細
  if (process.env.DEBUG_PIPELINE === 'true' && duplicate) {
    console.log('[DUPLICATE DEBUG]', {
      normalizedName: `${left.normalizedName} ↔ ${right.normalizedName}`,
      duplicateKey: evaluation.pairKey,
      distance: evaluation.distanceMeters,
      nameSimilarity: evaluation.nameSimilarity,
      reasons: evaluation.reasons,
    });
  }

  return evaluation;
}