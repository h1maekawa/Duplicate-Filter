import { loadInputFiles } from '../lib/parser/parseInputFiles';
import { runRestaurantPipeline } from '../lib/pipeline';
import chainData from '../../data/chains.json';

async function main() {
  const records = await loadInputFiles([
    '/Users/maekawahiroyuki/Downloads/さいたま市大宮区でおすすめの美味しいカフェ・喫茶店をご紹介！___食べログ_20260521_2131.csv',
  ]);

  const result = await runRestaurantPipeline(records, {
    excludeCommercialFacilities: true,
    chainNames: Array.isArray(chainData) ? chainData : [],
  });

  console.log('=== サマリ ===');
  console.log(JSON.stringify(result.summary, null, 2));

  // 商業施設除外サンプル
  console.log('\n=== 商業施設除外サンプル (上位10件) ===');
  result.mallExcluded.slice(0, 10).forEach((r) => {
    console.log(`店名: ${r.rawName}`);
    console.log(`住所: ${r.rawAddress}`);
    console.log(`除外理由: ${r.exclude_reason.join(', ')}`);
    console.log('---');
  });

  // 商業施設除外に含まれてはいけない例（ルミネ等は除外でいいが、普通の個人店は？）
  console.log('\n=== 出力に残った店舗 (ルミネ・コクーン含む店を確認) ===');
  const suspicious = result.stores.filter(
    (s) =>
      s.name.includes('ルミネ') ||
      s.name.includes('コクーン') ||
      (s.address || '').includes('ルミネ') ||
      (s.address || '').includes('コクーン'),
  );
  suspicious.slice(0, 10).forEach((s) => {
    console.log(`店名: ${s.name}`);
    console.log(`住所: ${s.address}`);
    console.log(`chain_flag: ${s.chain_flag}, mall_flag: ${s.mall_flag}`);
    console.log('---');
  });

  // チェーン除外サンプル
  console.log('\n=== チェーン除外サンプル (上位15件) ===');
  result.chainExcluded.slice(0, 15).forEach((r) => {
    console.log(`店名: ${r.rawName}`);
    console.log(`チェーンスコア: ${r.chainScore}`);
    console.log(`除外理由: ${r.exclude_reason.join(', ')}`);
    console.log('---');
  });

  // 重複判定サンプル
  console.log('\n=== 重複マッチ (上位10件) ===');
  result.duplicateMatches.slice(0, 10).forEach((m) => {
    const left = records[m.leftIndex];
    const right = records[m.rightIndex];
    console.log(`左: ${left?.name} | 右: ${right?.name}`);
    console.log(`スコア: ${m.evaluation.score} | 理由: ${m.evaluation.reasons.join(', ')}`);
    console.log(`名前類似度: ${m.evaluation.nameSimilarity} | 住所類似度: ${m.evaluation.addressSimilarity}`);
    console.log('---');
  });
}

main().catch(console.error);
