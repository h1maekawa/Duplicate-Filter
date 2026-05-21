import scoringConfig from '../config/scoring_config.json';
import { haversineDistanceMeters } from '../utils/geo';
import { jaroWinkler } from '../utils/similarity';
import type { DuplicateEvaluation, DuplicateScoringConfig, NormalizedStoreRecord } from '../types';

const defaultScoring = scoringConfig.duplicate;

function getDistance(a: NormalizedStoreRecord, b: NormalizedStoreRecord): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng);
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
  if (phoneMatched) {
    duplicate = true;
    score = config.phoneMatchScore;
    reasons.push('phone_match');
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
  if (!duplicate) {
    if (nameSimilarity >= config.nameSimilarityThreshold && addressSimilarity >= config.addressSimilarityThreshold) {
      duplicate = true;
      score = defaultScoring.similarityMatchScore || 80;
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
      name: nameSimilarity >= config.nameSimilarityThreshold,
      url: urlMatched,
      address: addressSimilarity >= config.addressSimilarityThreshold,
    },
  };
}
