export type SourceName = 'google' | 'tabelog' | 'hotpepper' | 'unknown' | string;

export interface PipelineInputRecord {
  name?: string;
  address?: string;
  phone?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  url?: string;
  source?: SourceName;
  area?: string;
  category?: string;
  [key: string]: unknown;
}

export interface NormalizeOptions {
  removeBusinessWords?: boolean;
}

export interface DecisionLog {
  stage:
    | 'input'
    | 'normalize'
    | 'chain'
    | 'duplicate'
    | 'merge'
    | 'exclude'
    | 'output';
  code: string;
  message: string;
  score?: number;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface NormalizedStoreRecord {
  recordIndex: number;
  rawName: string;
  normalizedName: string;
  rawPhone: string;
  normalizedPhone: string;
  rawAddress: string;
  normalizedAddress: string;
  lat: number | null;
  lng: number | null;
  url: string;
  normalizedUrl: string;
  source: SourceName;
  area: string;
  category: string;
  raw: Record<string, unknown>;
  logs: DecisionLog[];
  chainDecision?: ChainDecision;
}

export interface ChainDecision {
  isChain: boolean;
  matchedChainName: string | null;
  matchType: 'exact' | 'partial' | 'similar' | 'none';
  similarity?: number;
  reasons: string[];
}

export interface DuplicateEvaluation {
  pairKey: string;
  duplicate: boolean;
  score: number;
  reasons: string[];
  nameSimilarity: number;
  addressSimilarity: number;
  distanceMeters: number | null;
  matchedOn: {
    phone: boolean;
    distance: boolean;
    name: boolean;
    url: boolean;
    address: boolean;
  };
  hardBlockReason?: string;
}

export interface StoreOutputRecord {
  storeId: string;
  name: string;
  normalizedName: string;
  phone: string;
  normalizedPhone: string;
  address: string;
  normalizedAddress: string;
  lat: number | null;
  lng: number | null;
  url: string;
  sources: SourceName[];
  area?: string;
  category?: string;
  isChain: boolean;
  duplicateChecked: boolean;
  duplicateScore: number;
  logs: DecisionLog[];
  createdAt: string;
  rawRecords: Array<{
    source: SourceName;
    name: string;
    address: string;
    phone: string;
    url: string;
  }>;
}

export interface PipelineSummary {
  inputCount: number;
  normalizedCount: number;
  chainExcludedCount: number;
  duplicateClusterCount: number;
  mergedCount: number;
  outputCount: number;
}

export interface PipelineResult {
  summary: PipelineSummary;
  stores: StoreOutputRecord[];
  chainExcluded: NormalizedStoreRecord[];
  duplicateMatches: Array<{
    leftIndex: number;
    rightIndex: number;
    evaluation: DuplicateEvaluation;
  }>;
}

export interface DuplicateScoringConfig {
  phoneMatchScore: number;
  distanceMatchScore: number;
  nameSimilarityScore: number;
  urlMatchScore: number;
  addressSimilarityScore: number;
  duplicateThreshold: number;
  distanceThresholdMeters: number;
  nameSimilarityThreshold: number;
  addressSimilarityThreshold: number;
}

export interface PipelineOptions {
  normalize?: NormalizeOptions;
  scoring?: Partial<DuplicateScoringConfig>;
  chainDbPath?: string;
  chainNames?: string[];
  outputPath?: string;
  inputPaths?: string[];
}
