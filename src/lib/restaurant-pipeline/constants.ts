import type { DuplicateScoringConfig, SourceName } from './types';

export const DEFAULT_SCORING_CONFIG: DuplicateScoringConfig = {
  phoneMatchScore: 100,
  distanceMatchScore: 50,
  nameSimilarityScore: 40,
  urlMatchScore: 30,
  addressSimilarityScore: 20,
  duplicateThreshold: 80,
  distanceThresholdMeters: 30,
  nameSimilarityThreshold: 0.9,
  addressSimilarityThreshold: 0.88,
};

export const SOURCE_PRIORITY: Record<string, number> = {
  google: 300,
  tabelog: 200,
  hotpepper: 100,
};

export const GENERIC_CHAIN_WORDS = new Set([
  '酒場',
  '食堂',
  '居酒屋',
  '焼肉',
  '焼鳥',
  '焼き鳥',
  'cafe',
  'カフェ',
  '喫茶',
  'bar',
  'バー',
  'レストラン',
  'ダイニング',
]);

export const BUSINESS_WORDS = [
  '居酒屋',
  '焼肉',
  '焼鳥',
  '焼き鳥',
  '串焼き',
  'カフェ',
  'cafe',
  'coffee',
  '喫茶',
  'レストラン',
  'ダイニング',
  'bar',
  'バー',
  'ラーメン',
  '中華',
  '寿司',
  '鮨',
  'イタリアン',
  'フレンチ',
  'ビストロ',
];

export const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['name', '店舗名', '店名', 'restaurant_name'],
  address: ['address', '住所', '所在地'],
  phone: ['phone', '電話番号', '電話', 'tel'],
  lat: ['lat', 'latitude', '緯度'],
  lng: ['lng', 'lon', 'longitude', '経度'],
  url: ['url', 'URL', '店舗URL', 'store_url'],
  source: ['source', '媒体', '媒体名', 'site', 'platform'],
  area: ['area', 'region', 'prefecture', 'city', 'エリア', '地域', '市区町村', '都道府県'],
  category: ['category', 'genre', 'type', 'カテゴリ', 'ジャンル', '業種'],
  businessHours: ['businessHours', '営業時間', '営業日', 'opening_hours', 'open_hours', 'hours'],
  regularHoliday: ['regularHoliday', '定休日', '定期休日', 'regular_holiday', 'holiday', 'closed_days'],
};

export function normalizeSourceName(value: string): SourceName {
  const lowered = value.trim().toLowerCase();
  if (lowered.includes('google')) return 'google';
  if (lowered.includes('tabelog') || lowered.includes('食べログ')) return 'tabelog';
  if (lowered.includes('hotpepper') || lowered.includes('ホットペッパー')) return 'hotpepper';
  return lowered || 'unknown';
}
