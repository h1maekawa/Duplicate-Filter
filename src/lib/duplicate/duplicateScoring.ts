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
 * 住所の番地部分（数字列）を抽出して比較する
 * 同じチェーン名でも番地が異なれば別店舗と判断する
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
  // 先頭2つの数字群（丁目・番地）が同じかどうか
  const keyA = numsA.slice(0, 2).join('-');
  const keyB = numsB.slice(0, 2).join('-');
  return keyA === keyB;
}

export function evaluateDuplicate(
  left: NormalizedStoreRecord,
  right: NormalizedStoreRecord,
  partialConfig: Partial<DuplicateScoringConfig> = {},
): DuplicateEvaluation {
  // Merge config sources: hard defaults -> scoring_config.json -> runtime overrides
  const config = {
    phoneMatchScore: defaultScoring.phoneMatchScore || 100,
    distanceMatchScore: 50,
    nameSimilarityScore: 40,
    urlMatchScore: defaultScoring.urlMatchScore || 70,
    addressSimilarityScore: 20,
    duplicateThreshold: defaultScoring.duplicateThreshold || 70,
    distanceThresholdMeters: defaultScoring.distanceThresholdMeters || 30,
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

  // Level 1: Phone match
  // ただし名前の類似度が低い場合（0.5未満）は同じビルの別テナント等の誤マッチを防ぐ
  if (phoneMatched) {
    if (nameSimilarity >= 0.5) {
      duplicate = true;
      score = config.phoneMatchScore;
      reasons.push('phone_match');
    } else {
      // 電話番号は一致するが名前が全く違う → 共有電話番号（ビル・施設の代表番号等）の可能性
      // 重複とは判断しない
      reasons.push('phone_match_rejected_name_mismatch');
    }
  }

  // Level 2: URL match
  if (!duplicate && urlMatched) {
    duplicate = true;
    score = config.urlMatchScore;
    reasons.push('url_match');
  }

  // Level 3: Name and Address Exact match
  if (!duplicate) {
    const phoneMissing = !left.normalizedPhone || !right.normalizedPhone;
    if (phoneMissing && left.normalizedName === right.normalizedName && left.normalizedAddress === right.normalizedAddress) {
      duplicate = true;
      score = defaultScoring.nameAddressExactScore || 90;
      reasons.push('name_and_address_exact_match');
    }
  }

  // Level 4: Name similarity and address similarity match
  // 同じチェーン名の別支店を誤統合しないよう、住所の番地レベルでも一致を確認
  if (!duplicate) {
    if (nameSimilarity >= config.nameSimilarityThreshold && addressSimilarity >= config.addressSimilarityThreshold) {
      // 住所の番地部分が異なる場合、同じチェーンの別支店の可能性が高い
      // その場合は重複と判定しない
      const numbersMatch = addressNumbersSimilar(left.normalizedAddress, right.normalizedAddress);
      const hasAddressNumbers = extractAddressNumbers(left.normalizedAddress).length > 0
        && extractAddressNumbers(right.normalizedAddress).length > 0;

      if (!hasAddressNumbers || numbersMatch) {
        // 番地情報がない、または番地が一致する場合のみ重複とする
        duplicate = true;
        score = defaultScoring.similarityMatchScore || 80;
        reasons.push('similarity_match');
      } else {
        // 名前は似ているが住所の番地が違う → 同チェーン別支店と判断
        reasons.push('similarity_match_rejected_different_address_numbers');
      }
    }
  }

  const distanceMeters = getDistance(left, right);

  // Level 5: 距離ベース重複判定
  // 非常に近距離（閾値以内）かつ名前の類似度が中程度以上の場合は重複とみなす
  if (!duplicate && distanceMeters != null && distanceMeters <= config.distanceThresholdMeters) {
    if (nameSimilarity >= 0.75) {
      duplicate = true;
      score = config.distanceMatchScore;
      reasons.push('distance_and_name_match');
    }
  }

  return {
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
}
