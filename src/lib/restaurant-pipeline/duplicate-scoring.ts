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
  let score = 0;

  const phoneMatched = Boolean(
    left.normalizedPhone && right.normalizedPhone && left.normalizedPhone === right.normalizedPhone,
  );
  if (phoneMatched) {
    score += config.phoneMatchScore;
    reasons.push('phone_match');
  }

  const distanceMeters = getDistance(left, right);
  const distanceMatched = distanceMeters != null && distanceMeters <= config.distanceThresholdMeters;
  if (distanceMatched) {
    score += config.distanceMatchScore;
    reasons.push(`distance_${Math.round(distanceMeters)}m`);
  }

  const nameSimilarity = bestNameSimilarity(left.normalizedName, right.normalizedName);
  const nameMatched = nameSimilarity >= config.nameSimilarityThreshold;
  if (nameMatched) {
    score += config.nameSimilarityScore;
    reasons.push(`name_similarity_${Math.round(nameSimilarity * 100)}`);
  }

  const urlMatched = Boolean(left.normalizedUrl && right.normalizedUrl && left.normalizedUrl === right.normalizedUrl);
  if (urlMatched) {
    score += config.urlMatchScore;
    reasons.push('url_match');
  }

  const addressSimilarity = jaroWinkler(left.normalizedAddress, right.normalizedAddress);
  const addressMatched = addressSimilarity >= config.addressSimilarityThreshold;
  if (addressMatched) {
    score += config.addressSimilarityScore;
    reasons.push(`address_similarity_${Math.round(addressSimilarity * 100)}`);
  }

  let hardBlockReason: string | undefined;
  const bothPhonesPresent = Boolean(left.normalizedPhone && right.normalizedPhone);
  if (!phoneMatched && bothPhonesPresent && distanceMeters != null && distanceMeters > 300 && nameSimilarity < 0.97) {
    hardBlockReason = 'different_phone_far_distance';
  }

  const duplicate = !hardBlockReason && score >= config.duplicateThreshold;

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
      distance: Boolean(distanceMatched),
      name: Boolean(nameMatched),
      url: urlMatched,
      address: Boolean(addressMatched),
    },
    hardBlockReason,
  };
}
