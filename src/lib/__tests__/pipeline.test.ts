import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChainMatcher,
  evaluateDuplicate,
  normalizeAddress,
  normalizeName,
  normalizePhone,
  runRestaurantPipeline,
} from '../index';
import type { NormalizedStoreRecord } from '../types';

test('normalize functions should align restaurant text', () => {
  // stripBranchSuffix is now enabled, so '渋谷店' is stripped completely
  assert.equal(normalizeName('焼肉 大将 渋谷店'), '焼肉大将');
  assert.equal(normalizePhone('03-1234-5678'), '0312345678');
  assert.equal(normalizeAddress('東京都渋谷区道玄坂一丁目2番3号 渋谷ビル 3F'), '東京都渋谷区道玄坂1-2-3');
  assert.equal(normalizeAddress('東京都渋谷区道玄坂一丁目2番3号 渋谷ビル 3F', { stripPrefecture: true }), '渋谷区道玄坂1-2-3');
});

test('chain matcher should avoid generic words and match known chain', () => {
  const matcher = createChainMatcher(['鳥貴族', '日高屋', 'ガスト', '酒場']);

  const chainRecord = {
    recordIndex: 0,
    rawName: '鳥貴族 渋谷店',
    normalizedName: normalizeName('鳥貴族 渋谷店'),
    rawPhone: '',
    normalizedPhone: '',
    rawAddress: '',
    normalizedAddress: '',
    lat: null,
    lng: null,
    url: '',
    normalizedUrl: '',
    source: 'google',
    area: '',
    category: '',
    businessHours: '',
    regularHoliday: '',
    sourceColumns: [],
    raw: {},
    logs: [],
    chainScore: 0,
    chain_flag: false,
    mall_flag: false,
    exclude_reason: [],
  } satisfies NormalizedStoreRecord;

  const genericRecord = {
    ...chainRecord,
    recordIndex: 1,
    rawName: '大衆酒場 しぶや',
    normalizedName: normalizeName('大衆酒場 しぶや'),
    logs: [],
  } satisfies NormalizedStoreRecord;

  const chainDecision = matcher.detect(chainRecord, new Set());
  const genericDecision = matcher.detect(genericRecord, new Set());

  // Since '渋谷店' is stripped, the normalized name matches '鳥貴族' exactly.
  assert.equal(chainDecision.isChain, true);
  assert.equal(chainDecision.matchType, 'exact');
  assert.equal(genericDecision.isChain, false);
});

test('duplicate scoring should prioritize phone number and merge by score', async () => {
  const result = await runRestaurantPipeline(
    [
      {
        name: '焼鳥 鳥一郎',
        address: '東京都新宿区歌舞伎町1-2-3',
        phone: '03-1234-5678',
        lat: 35.694,
        lng: 139.704,
        url: 'https://example.com/a',
        source: 'google',
      },
      {
        name: '鳥一郎 新宿店',
        address: '東京都新宿区歌舞伎町一丁目2番3号',
        phone: '0312345678',
        lat: 35.69402,
        lng: 139.70401,
        url: 'https://example.com/b',
        source: 'tabelog',
      },
      {
        name: '鮨 さとう',
        address: '東京都中央区銀座1-1-1',
        phone: '03-0000-0001',
        lat: 35.674,
        lng: 139.765,
        url: 'https://example.com/c',
        source: 'hotpepper',
      },
      {
        name: '鳥貴族 渋谷店',
        address: '東京都渋谷区道玄坂1-1-1',
        phone: '03-9999-9999',
        source: 'google',
      },
    ],
    {
      scoring: {
        duplicateThreshold: 80,
      },
      chainDbPath: new URL('../../../data/chains.json', import.meta.url).pathname,
    },
  );

  assert.equal(result.summary.inputCount, 4);
  assert.equal(result.summary.chainExcludedCount, 1);
  assert.equal(result.summary.outputCount, 2);
  assert.equal(result.duplicateMatches.length, 1);
  assert.ok(result.stores[0].duplicateScore >= 100 || result.stores[1].duplicateScore >= 100);
});

test('evaluateDuplicate should return score log details', () => {
  const base: NormalizedStoreRecord = {
    recordIndex: 0,
    rawName: 'A',
    normalizedName: '鳥一郎',
    rawPhone: '03-1234-5678',
    normalizedPhone: '0312345678',
    rawAddress: '東京都新宿区1-2-3',
    normalizedAddress: '東京都新宿区1-2-3',
    lat: 35.0,
    lng: 139.0,
    url: 'https://example.com/a',
    normalizedUrl: 'https://example.com/a',
    source: 'google',
    area: '',
    category: '',
    businessHours: '',
    regularHoliday: '',
    sourceColumns: [],
    raw: {},
    logs: [],
    chainScore: 0,
    chain_flag: false,
    mall_flag: false,
    exclude_reason: [],
  };

  const evaluation = evaluateDuplicate(base, {
    ...base,
    recordIndex: 1,
    normalizedName: '鳥一郎',
    normalizedUrl: 'https://example.com/a',
  }, {
    phoneMatchScore: 100,
    distanceMatchScore: 50,
    nameSimilarityScore: 40,
    urlMatchScore: 70,
    addressSimilarityScore: 20,
    duplicateThreshold: 70,
    distanceThresholdMeters: 30,
    nameSimilarityThreshold: 0.85,
    addressSimilarityThreshold: 0.80,
  });

  assert.equal(evaluation.duplicate, true);
  assert.ok(evaluation.reasons.includes('phone_match'));
});

test('pipeline should exclude Aeon Mall restaurants ONLY for rocketnow and menu projects', async () => {
  const result = await runRestaurantPipeline([
    {
      name: '個人レストラン イオンモール店',
      address: '千葉県千葉市美浜区豊砂1-1',
      phone: '043-306-7101',
      source: 'rocketnow',
    },
    {
      name: 'カフェ メニューテスト',
      address: '千葉県木更津市築地1-4 イオンモール内',
      phone: '0438-30-7111',
      source: 'menu',
    },
    {
      name: '個人レストラン イオンモール店',
      address: '千葉県船橋市山手1-1-8',
      phone: '047-495-5020',
      source: 'google',
    },
    {
      name: 'カフェ ららぽーと店',
      address: 'ららぽーと若松2-1-1',
      phone: '047-433-9800',
      source: 'menu',
    }
  ], {
    chainNames: [],
  });

  // Out of 4 items:
  // - Item 1: Aeon Mall + rocketnow -> Excluded (1)
  // - Item 2: Aeon Mall + menu -> Excluded (2)
  // - Item 3: Aeon Mall + google -> Not excluded (kept in candidates/output)
  // - Item 4: Lalaport (non-Aeon Mall) + menu -> Not excluded (kept in candidates/output)

  assert.equal(result.summary.inputCount, 4);
  assert.equal(result.mallExcluded.length, 2);
  assert.equal(result.stores.length, 2);

  // Check that the excluded records are the correct ones
  const isAeonExcluded1 = result.mallExcluded.some(
    r => r.rawName === '個人レストラン イオンモール店' && r.source === 'rocketnow'
  );
  const isAeonExcluded2 = result.mallExcluded.some(
    r => r.rawName === 'カフェ メニューテスト' && r.source === 'menu'
  );

  assert.ok(isAeonExcluded1);
  assert.ok(isAeonExcluded2);
  
  // Verify that the logs record the exclusion reason
  const aeonLog = result.mallExcluded[0].logs.find(l => l.code === 'excluded_aeon_mall');
  assert.ok(aeonLog);
  assert.equal(aeonLog.message, 'イオンモール除外（ロケットナウ・メニュー案件）');
});

test('pipeline should completely exclude commercial facilities when option is enabled', async () => {
  const result = await runRestaurantPipeline([
    {
      name: 'スターバックスコーヒー イオンモールつくば店',
      address: '茨城県つくば市稲岡66-1',
      phone: '029-836-8101',
      source: 'google',
    },
    {
      name: 'タリーズコーヒー ららぽーと和泉店',
      address: '大阪府和泉市あゆみ野4-4-7',
      phone: '0725-51-3101',
      source: 'tabelog',
    },
    {
      name: '一般店舗',
      address: '東京都渋谷区神南1-1-1',
      phone: '03-1111-2222',
      source: 'google',
    }
  ], {
    excludeCommercialFacilities: true,
    chainDbPath: new URL('../../../data/chains.json', import.meta.url).pathname,
  });

  assert.equal(result.summary.inputCount, 3);
  assert.equal(result.mallExcluded.length, 2);
  assert.equal(result.stores.length, 1);
  assert.equal(result.stores[0].name, '一般店舗');

  const commLog = result.mallExcluded[0].logs.find(l => l.code === 'excluded_commercial_facility');
  assert.ok(commLog);
  assert.equal(commLog.message, '商業施設内店舗除外');
});
