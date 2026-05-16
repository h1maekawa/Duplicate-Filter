import assert from 'node:assert/strict';
import test from 'node:test';

import { createChainMatcher } from '../chain-detection';
import { evaluateDuplicate } from '../duplicate-scoring';
import { normalizeAddress, normalizeName, normalizePhone } from '../normalizers';
import { runRestaurantPipeline } from '../pipeline';
import type { NormalizedStoreRecord } from '../types';

test('normalize functions should align restaurant text', () => {
  assert.equal(normalizeName('焼肉 大将 渋谷店'), '焼肉大将');
  assert.equal(normalizePhone('03-1234-5678'), '0312345678');
  assert.equal(normalizeAddress('東京都渋谷区道玄坂一丁目2番3号 渋谷ビル 3F'), '東京都渋谷区道玄坂1-2-3');
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
    raw: {},
    logs: [],
  } satisfies NormalizedStoreRecord;

  const genericRecord = {
    ...chainRecord,
    recordIndex: 1,
    rawName: '大衆酒場 しぶや',
    normalizedName: normalizeName('大衆酒場 しぶや'),
    logs: [],
  } satisfies NormalizedStoreRecord;

  const chainDecision = matcher.detect(chainRecord);
  const genericDecision = matcher.detect(genericRecord);

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
      chainDbPath: new URL('../../../../api/masters/chains_master.csv', import.meta.url).pathname,
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
    raw: {},
    logs: [],
  };

  const evaluation = evaluateDuplicate(base, {
    ...base,
    recordIndex: 1,
    normalizedName: '鳥一郎',
    normalizedUrl: 'https://example.com/a',
  });

  assert.equal(evaluation.duplicate, true);
  assert.ok(evaluation.reasons.includes('phone_match'));
});
