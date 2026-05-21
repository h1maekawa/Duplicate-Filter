import chainBrandsConfig from '../config/chain_brands.json';
import { createLog } from '../utils/log';
import { normalizeName } from '../normalize/normalizers';
import { jaroWinkler } from '../utils/similarity';
import type { ChainDecision, NormalizeOptions, NormalizedStoreRecord } from '../types';

export interface ChainMatcher {
  detect(record: NormalizedStoreRecord, heavyBrands: Set<string>): ChainDecision;
}

const CHAIN_URL_PATTERNS = ['/company/', '/shop/', '/brand/', '/store/', '/chain/'];

function hasChainUrlPattern(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return CHAIN_URL_PATTERNS.some((pat) => lowerUrl.includes(pat));
}

function hasBranchSuffixPattern(rawName: string): boolean {
  if (!rawName) return false;
  const clean = rawName.trim();
  if (/(?:本店|支店|総本店|本館|別館|新館|駅前店|[東西南北]口店|[0-9]+号店)$/u.test(clean)) {
    return true;
  }
  const branchPattern = /(?:駅前?|インター|通り?|[東西南北]口|モール)店$/u;
  if (branchPattern.test(clean)) {
    return true;
  }
  if (clean.endsWith('店')) {
    const locationHint = /(駅|口|丁目|通|町|市|区|郡|県|都|府|谷|坂|川|前|橋|丘|島|北|南|東|西|モール|プラザ|パーク)$/u;
    if (locationHint.test(clean.slice(0, -1))) {
      return true;
    }
  }
  return false;
}

function getReviewCount(raw: Record<string, unknown>): number {
  if (!raw) return 0;
  const keys = ['review_count', 'reviews', 'reviews_count', 'rating_count', '口コミ数', 'クチコミ数', 'reviewCount'];
  for (const key of keys) {
    const foundKey = Object.keys(raw).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase());
    if (foundKey) {
      const val = Number(raw[foundKey]);
      if (Number.isFinite(val)) {
        return val;
      }
    }
  }
  return 0;
}

export function countBrandOccurrences(
  records: NormalizedStoreRecord[],
  threshold = 5,
): Set<string> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const name = r.normalizedName;
    if (name) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  const heavyBrands = new Set<string>();
  for (const [name, count] of counts.entries()) {
    if (count >= threshold) {
      heavyBrands.add(name);
    }
  }
  return heavyBrands;
}

export function createChainMatcher(
  chainNames: string[] = [],
  normalizeOptions: NormalizeOptions = {},
): ChainMatcher {
  // Combine config brands and optionally passed brand names
  const masterBrands = [...new Set([...chainBrandsConfig.brands, ...chainNames])];
  const normalizedChains = [...new Set(masterBrands.map((name) => normalizeName(name, normalizeOptions)).filter(Boolean))];
  const genericChainWords = new Set(chainBrandsConfig.genericWords);

  return {
    detect(record: NormalizedStoreRecord, heavyBrands: Set<string>): ChainDecision {
      const target = record.normalizedName;
      if (!target) {
        record.chainScore = 0;
        record.chain_flag = false;
        return {
          isChain: false,
          matchedChainName: null,
          matchType: 'none',
          reasons: ['empty_name'],
        };
      }

      let chainScore = 0;
      const reasons: string[] = [];
      let matchedChainName: string | null = null;
      let matchType: ChainDecision['matchType'] = 'none';
      let maxSimilarity = 0;

      // 1. Exact Match
      let isExact = false;
      for (const chainName of normalizedChains) {
        if (target === chainName) {
          isExact = true;
          matchedChainName = chainName;
          break;
        }
      }

      if (isExact) {
        chainScore += 70;
        matchType = 'exact';
        reasons.push('exact_brand_match');
      } else {
        // 2. Partial Match
        let isPartial = false;
        for (const chainName of normalizedChains) {
          if (genericChainWords.has(chainName)) continue;
          if ((chainName.length >= 3 && target.includes(chainName)) || (target.length >= 4 && chainName.includes(target))) {
            isPartial = true;
            matchedChainName = chainName;
            break;
          }
        }

        if (isPartial) {
          // 公式チェーンDBへの部分一致は確度が高い → しきい値(60)を単独で超えるスコアを付与
          chainScore += 65;
          matchType = 'partial';
          reasons.push('partial_brand_match');
        } else {
          // 3. Similarity Match
          let bestSimilar: string | null = null;
          for (const chainName of normalizedChains) {
            if (genericChainWords.has(chainName)) continue;
            const similarity = jaroWinkler(target, chainName);
            if (similarity > maxSimilarity) {
              maxSimilarity = similarity;
              bestSimilar = chainName;
            }
          }
          if (maxSimilarity >= 0.94 && bestSimilar) {
            matchType = 'similar';
            matchedChainName = bestSimilar;
            chainScore += 40;
            reasons.push(`similar_brand_match (${maxSimilarity.toFixed(2)})`);
          }
        }
      }

      // 4. URL Pattern Match
      if (record.url && hasChainUrlPattern(record.url)) {
        chainScore += 20;
        reasons.push('chain_url_pattern');
      }

      // 5. Heavy brand frequency occurrence
      if (heavyBrands.has(target)) {
        chainScore += 30;
        reasons.push('high_frequency_name');
      }

      // 6. Suffix location patterns
      if (hasBranchSuffixPattern(record.rawName)) {
        chainScore += 10;
        reasons.push('branch_suffix_pattern');
      }

      // 7. Review score check
      const reviews = getReviewCount(record.raw);
      if (reviews >= 500) {
        chainScore += 20;
        reasons.push('reviews_500_plus');
      } else if (reviews >= 200) {
        chainScore += 10;
        reasons.push('reviews_200_plus');
      }

      const chain_flag = chainScore >= 60;
      record.chainScore = chainScore;
      record.chain_flag = chain_flag;

      if (chain_flag) {
        record.logs.push(
          createLog('chain', 'chain_detected', `チェーン店判定 (Score: ${chainScore})`, {
            chainScore,
            matchedChainName,
            matchType,
            reasons,
          }),
        );
      }

      return {
        isChain: chain_flag,
        matchedChainName,
        matchType,
        similarity: maxSimilarity > 0 ? Number(maxSimilarity.toFixed(4)) : undefined,
        reasons,
      };
    },
  };
}
