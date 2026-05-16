import { GENERIC_CHAIN_WORDS } from './constants';
import { createLog } from './log';
import { normalizeName } from './normalizers';
import { jaroWinkler } from './similarity';
import type { ChainDecision, NormalizeOptions, NormalizedStoreRecord } from './types';

export interface ChainMatcher {
  detect(record: NormalizedStoreRecord): ChainDecision;
}

export function createChainMatcher(chainNames: string[], normalizeOptions: NormalizeOptions = {}): ChainMatcher {
  const normalizedChains = [...new Set(chainNames.map((name) => normalizeName(name, normalizeOptions)).filter(Boolean))];

  return {
    detect(record: NormalizedStoreRecord): ChainDecision {
      const target = record.normalizedName;
      if (!target) {
        return {
          isChain: false,
          matchedChainName: null,
          matchType: 'none',
          reasons: ['empty_name'],
        };
      }

      for (const chainName of normalizedChains) {
        if (target === chainName) {
          const decision: ChainDecision = {
            isChain: true,
            matchedChainName: chainName,
            matchType: 'exact',
            reasons: ['normalized_exact_match'],
          };
          record.logs.push(createLog('chain', 'chain_exact', 'チェーン店完全一致', { matchedChainName: chainName }));
          return decision;
        }
      }

      for (const chainName of normalizedChains) {
        if (GENERIC_CHAIN_WORDS.has(chainName)) continue;
        if ((chainName.length >= 3 && target.includes(chainName)) || (target.length >= 4 && chainName.includes(target))) {
          const decision: ChainDecision = {
            isChain: true,
            matchedChainName: chainName,
            matchType: 'partial',
            reasons: ['normalized_partial_match'],
          };
          record.logs.push(createLog('chain', 'chain_partial', 'チェーン店部分一致', { matchedChainName: chainName }));
          return decision;
        }
      }

      let best: { name: string; similarity: number } | null = null;
      for (const chainName of normalizedChains) {
        if (GENERIC_CHAIN_WORDS.has(chainName)) continue;
        const similarity = jaroWinkler(target, chainName);
        if (!best || similarity > best.similarity) {
          best = { name: chainName, similarity };
        }
      }

      if (best && best.similarity >= 0.94) {
        const decision: ChainDecision = {
          isChain: true,
          matchedChainName: best.name,
          matchType: 'similar',
          similarity: Number(best.similarity.toFixed(4)),
          reasons: ['normalized_similarity_match'],
        };
        record.logs.push(
          createLog('chain', 'chain_similar', 'チェーン店類似一致', {
            matchedChainName: best.name,
            similarity: Number(best.similarity.toFixed(4)),
          }),
        );
        return decision;
      }

      return {
        isChain: false,
        matchedChainName: null,
        matchType: 'none',
        reasons: ['no_chain_match'],
      };
    },
  };
}
