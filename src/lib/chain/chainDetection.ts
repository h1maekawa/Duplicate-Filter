import chainBrandsConfig from '../config/chain_brands.json';
import scoringConfig from '../config/scoring_config.json';
import { createLog } from '../utils/log';
import { normalizeName } from '../normalize/normalizers';
import { jaroWinkler } from '../utils/similarity';
import type { ChainDecision, NormalizeOptions, NormalizedStoreRecord } from '../types';

export interface ChainMatcher {
  detect(record: NormalizedStoreRecord, heavyBrands: Set<string>): ChainDecision;
}

const chainConfig = scoringConfig.chain;

const CHAIN_URL_PATTERNS = ['/company/', '/shop/', '/brand/', '/store/', '/chain/'];

function hasChainUrlPattern(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return CHAIN_URL_PATTERNS.some((pat) => lowerUrl.includes(pat));
}

function hasBranchSuffixPattern(rawName: string): boolean {
  if (!rawName) return false;
  const clean = rawName.trim();
  if (/(?:本店|支店|総本店|本館|別館|新館|駅前店|[東西南北]口店|[0-9]+号店)$/u.test(clean)) return true;
  if (/(?:駅前?|インター|通り?|[東西南北]口|モール)店$/u.test(clean)) return true;
  if (clean.endsWith('店')) {
    const locationHint = /(駅|口|丁目|通|町|市|区|郡|県|都|府|谷|坂|川|前|橋|丘|島|北|南|東|西|モール|プラザ|パーク)$/u;
    if (locationHint.test(clean.slice(0, -1))) return true;
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
      if (Number.isFinite(val)) return val;
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
  const masterBrands = [...new Set([...chainBrandsConfig.brands, ...chainNames])];
  const normalizedChains = [...new Set(masterBrands.map((name) => normalizeName(name, normalizeOptions)).filter(Boolean))];
  const genericChainWords = new Set(chainBrandsConfig.genericWords);

  // スコア閾値 (JSON から参照)
  const threshold = chainConfig.chainScoreThreshold || 60;

  return {
    detect(record: NormalizedStoreRecord, heavyBrands: Set<string>): ChainDecision {
      const target = record.normalizedName;
      if (!target) {
        record.chainScore = 0;
        record.chain_flag = false;
        return { isChain: false, matchedChainName: null, matchType: 'none', reasons: ['empty_name'] };
      }

      let chainScore = 0;
      const reasons: string[] = [];
      let matchedChainName: string | null = null;
      let matchType: ChainDecision['matchType'] = 'none';
      let maxSimilarity = 0;

      // 1. 完全一致: スコア 70（単独で閾値 60 を超え、チェーン確定）
      let isExact = false;
      for (const chainName of normalizedChains) {
        if (target === chainName) {
          isExact = true;
          matchedChainName = chainName;
          break;
        }
      }

      if (isExact) {
        chainScore += chainConfig.exactMatchScore || 70;
        matchType = 'exact';
        reasons.push('exact_brand_match');
      } else {
        // 2. 部分一致
        // 【修正】スコアを JSON 参照値 (45) に変更（旧: ハードコード 65）
        // 単独では閾値 60 を超えないので、他のシグナル（高出現頻度・URL等）と組み合わせて判定
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
          chainScore += chainConfig.partialMatchScore || 45;
          matchType = 'partial';
          reasons.push('partial_brand_match');
        } else {
          // 3. 類似度マッチ
          let bestSimilar: string | null = null;
          for (const chainName of normalizedChains) {
            if (genericChainWords.has(chainName)) continue;
            const similarity = jaroWinkler(target, chainName);
            if (similarity > maxSimilarity) {
              maxSimilarity = similarity;
              bestSimilar = chainName;
            }
          }
          const simThreshold = chainConfig.similarityThreshold || 0.94;
          if (maxSimilarity >= simThreshold && bestSimilar) {
            matchType = 'similar';
            matchedChainName = bestSimilar;
            chainScore += chainConfig.similarityMatchScore || 40;
            reasons.push(`similar_brand_match (${maxSimilarity.toFixed(2)})`);
          }
        }
      }

      // 4. URL パターン
      if (record.url && hasChainUrlPattern(record.url)) {
        chainScore += chainConfig.urlPatternScore || 20;
        reasons.push('chain_url_pattern');
      }

      // 5. 高頻度出現ブランド
      if (heavyBrands.has(target)) {
        chainScore += chainConfig.occurrenceScore || 30;
        reasons.push('high_frequency_name');
      }

      // 6. 支店サフィックスパターン
      if (hasBranchSuffixPattern(record.rawName)) {
        chainScore += chainConfig.nameSuffixScore || 10;
        reasons.push('branch_suffix_pattern');
      }

      // 7. 口コミ数
      const reviews = getReviewCount(record.raw);
      if (reviews >= (chainConfig.highReviewThreshold || 500)) {
        chainScore += chainConfig.highReviewScore || 20;
        reasons.push('reviews_500_plus');
      } else if (reviews >= (chainConfig.mediumReviewThreshold || 200)) {
        chainScore += chainConfig.mediumReviewScore || 10;
        reasons.push('reviews_200_plus');
      }

      const chain_flag = chainScore >= threshold;
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