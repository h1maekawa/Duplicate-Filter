import { DEFAULT_SCORING_CONFIG } from './constants';
import { haversineDistanceMeters } from './geo';
import { bestNameSimilarity, jaroWinkler } from './similarity';
import type { DuplicateEvaluation, DuplicateScoringConfig, NormalizedStoreRecord } from './types';

function getDistance(a: NormalizedStoreRecord, b: NormalizedStoreRecord): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
}

export function evaluateDuplicate(
  left: NormalizedStoreRecord,
  right: NormalizedStoreRecord,
  partialConfig: Partial<DuplicateScoringConfig> = {},
): DuplicateEvaluation {
  const config = { ...DEFAULT_SCORING_CONFIG, ...partialConfig };
  const reasons: string[] = [];
  let duplicate = false;
  let score = 0;

  const phoneMatched = Boolean(
    left.normalizedPhone && right.normalizedPhone && left.normalizedPhone === right.normalizedPhone,
  );

  const nameSimilarity = jaroWinkler(left.normalizedName, right.normalizedName);
  const addressSimilarity = jaroWinkler(left.normalizedAddress, right.normalizedAddress);

  // Level 1: normalizedPhone が双方に存在し、かつ完全に一致した場合は無条件で重複（duplicate: true）とする。
  if (phoneMatched) {
    duplicate = true;
    score = 100;
    reasons.push('phone_match');
  }

  // Level 2: 電話番号が無くても、normalizedName と normalizedAddress が完全一致した場合は重複とする。
  if (!duplicate) {
    const phoneMissing = !left.normalizedPhone || !right.normalizedPhone;
    if (phoneMissing && left.normalizedName === right.normalizedName && left.normalizedAddress === right.normalizedAddress) {
      duplicate = true;
      score = 90;
      reasons.push('name_and_address_exact_match');
    }
  }

  // Level 3: 店舗名のJaro-Winkler類似度が 0.85 以上、かつ住所の類似度が 0.80 以上を満たす場合は重複とする。
  if (!duplicate) {
    if (nameSimilarity >= 0.85 && addressSimilarity >= 0.80) {
      duplicate = true;
      score = 80;
      reasons.push('similarity_match');
    }
  }

  const distanceMeters = getDistance(left, right);

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
      name: nameSimilarity >= 0.85,
      url: Boolean(left.normalizedUrl && right.normalizedUrl && left.normalizedUrl === right.normalizedUrl),
      address: addressSimilarity >= 0.80,
    },
  };
}
