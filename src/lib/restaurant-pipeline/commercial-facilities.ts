import { normalizeName } from './normalizers';

/**
 * ユーザーから指定された商業施設・駅ビル・アウトレットの具体名リスト
 */
export const LISTED_COMMERCIAL_FACILITIES = [
  // --- 前回のショッピングモールリスト ---
  "Maker's Pier",
  "三井ショッピングパーク ららぽーと和泉",
  "三井ショッピングパーク ららぽーと立川立飛",
  "錦ケ丘ヒルサイドモール",
  "トレッサ横浜",
  "アーバンドック ららぽーと豊洲",
  "テラスモール湘南",
  "三井ショッピングパーク ららぽーと柏の葉",
  "mozo ワンダーシティ",
  "三井ショッピングパーク ららぽーと名古屋みなとアクルス",
  "イオンモール橿原",
  "アリオ亀有",
  "三井ショッピングパーク ららぽーと富士見",
  "三井ショッピングパーク ららぽーとEXPOCITY",
  "イオンモール堺鉄砲町",
  "天保山マーケットプレース",
  "有明ガーデン",
  "三井ショッピングパーク ららぽーと横浜",
  "三井ショッピングパーク ららぽーと安城",
  "イオンモールつくば",
  "イオンモール太田",
  "ヒルズウォーク徳重ガーデンズ",
  "サンシャインワーフ神戸",
  "ラグーナフェスティバルマーケット",
  "三井ショッピングパーク ららぽーと湘南平塚",
  "イオンモール新利府",
  "三井ショッピングパーク ららぽーと海老名",
  "イオンモール四條畷",
  "モレラ岐阜",
  "三井ショッピングパーク ららぽーと新三郷",
  "イオンモール幕張新都心",
  "イオンモール福岡",
  "三井ショッピングパーク ららぽーとTOKYO-BAY",
  "BINO栄(ビーノサカエ)",
  "光が丘IMA",
  "パークプレイス大分",
  "イオンモールKAGOSHIMA BAY",
  "モザイクモール港北",
  "イオンモール神戸南",
  "イオンモール岡崎",
  "イオンモール岡山",
  "ピオニウォーク東松山",
  "イクスピアリ",
  "イオンモール大和郡山",
  "イオンモール水戸内原",
  "ゆめタウン高松",
  "イオンモール堺北花田",
  "岸和田カンカンベイサイドモール",
  "イオンモール日の出",
  "イオンモール茨木",
  "イオンモール和歌山",
  "イオンモール川口前川",
  "クラソ・プレイス北上",
  "アリオ蘇我",
  "あべのキューズモール",
  "三井ショッピングパークららぽーと甲子園",
  "イオンモールりんくう泉南",
  "リバーウォーク北九州",
  "イオンモール筑紫野",
  "イオンモール",

  // --- 主要アウトレットモール ---
  "三井アウトレットパーク",
  "プレミアム・アウトレット",
  "軽井沢プリンスショッピングプラザ",
  "那須ガーデンアウトレット",
  "沖縄アウトレットモールあしびなー",
  "千歳アウトレットモール・レラ",
  "レイクタウンアウトレット"
];

/**
 * 商業施設・駅ビル・アウトレットを特定するための正規化キーワード（表記揺れや部分一致に対応）
 */
export const COMMERCIAL_KEYWORDS = [
  // --- 基本モール系 ---
  "イオンモール",
  "aeonmall",
  "ららぽーと",
  "lalaport",
  "アリオ",
  "ario",
  "テラスモール",
  "terracemall",
  "ゆめタウン",
  "youmetown",
  "メイカーズピア",
  "makerspier",
  "ヒルサイドモール",
  "hillsidemall",
  "トレッサ",
  "tressa",
  "ワンダーシティ",
  "wondercity",
  "mozo",
  "モゾ",
  "マーケットプレース",
  "marketplace",
  "有明ガーデン",
  "ariakegarden",
  "ヒルズウォーク",
  "hillswalk",
  "サンシャインワーフ",
  "sunshinewharf",
  "フェスティバルマーケット",
  "festivalmarket",
  "ラグーナ",
  "laguna",
  "モレラ",
  "malera",
  "bino",
  "ビーノ",
  "光が丘ima",
  "hikarigaokaima",
  "パークプレイス",
  "parkplace",
  "モザイクモール",
  "mosaicmall",
  "ピオニウォーク",
  "peonywalk",
  "イクスピアリ",
  "ikspiari",
  "カンカンベイサイドモール",
  "cancanbayside",
  "岸和田カンカン",
  "クラソプレイス",
  "crasoplace",
  "キューズモール",
  "qsmall",
  "リバーウォーク",
  "riverwalk",

  // --- 駅ビル・電鉄系商業施設 ---
  "ルミネ",
  "lumine",
  "アトレ",
  "atre",
  "アトレヴィ",
  "atrevie",
  "シャポー",
  "shapo",
  "ペリエ",
  "perie",
  "ミロード",
  "myload",
  "ラスカ",
  "lusca",
  "シァル",
  "cial",
  "モアーズ",
  "mores",
  "ポルタ",
  "porta",
  "ジョイナス",
  "joinus",
  "エキュート",
  "ecute",
  "グランスタ",
  "gransta",
  "セレオ",
  "celeo",
  "エスパル",
  "s-pal",
  "フェザン",
  "fesan",
  "アミュプラザ",
  "amuplaza",
  "ルクア",
  "lucua",
  "なんばパークス",
  "nambaparks",
  "パルコ",
  "parco",
  "駅ビル",
  "ekibiru",
  "メトロピア",
  "metropia",
  "エチカ",
  "echika",
  "グランベリーパーク",
  "grandberrypark",
  "東急スクエア",
  "tokyusquare",
  "たまプラーザテラス",
  "tamaplazaterrace",
  "なんばcity",
  "nambacity",
  "阪急三番街",
  "ホワイティうめだ",
  "なんばウォーク",

  // --- アウトレットモール系 ---
  "アウトレット",
  "outlet",
  "プレミアムアウトレット",
  "premiumoutlet",
  "プレミアム・アウトレット",
  "三井アウトレット",
  "mitsuilet"
];

/**
 * 店名または住所から商業施設・駅ビル・アウトレットに含まれるか判定する
 */
export function isCommercialFacility(
  name: string,
  address: string
): { isMatch: boolean; matchedPattern: string | null } {
  const rawText = `${name} ${address}`.toLowerCase();
  
  // 表記揺れやスペース、記号の差異を吸収するためにNFKC正規化を行い、不要な文字を除去
  const normalizedText = rawText
    .normalize('NFKC')
    .replace(/[\s　\-_/\\|:：;；.．,，、。!！?？(（)）'"“”]+/g, '');

  // 1. 主要キーワードによる判定
  for (const keyword of COMMERCIAL_KEYWORDS) {
    const normalizedKeyword = keyword
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　\-_/\\|:：;；.．,，、。!！?？(（)）'"“”]+/g, '');
    if (normalizedText.includes(normalizedKeyword)) {
      return { isMatch: true, matchedPattern: keyword };
    }
  }

  // 2. 特殊な複数語パターンの判定
  if (normalizedText.includes('イオン') && normalizedText.includes('モール')) {
    return { isMatch: true, matchedPattern: 'イオン & モール' };
  }
  if (normalizedText.includes('aeon') && normalizedText.includes('mall')) {
    return { isMatch: true, matchedPattern: 'aeon & mall' };
  }
  if (normalizedText.includes('三井') && normalizedText.includes('ショッピング')) {
    return { isMatch: true, matchedPattern: '三井 & ショッピングパーク' };
  }

  // 3. リスト全体の完全・部分一致による個別判定（念のため）
  for (const facility of LISTED_COMMERCIAL_FACILITIES) {
    const normalizedFacility = facility
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　\-_/\\|:：;；.．,，、。!！?？(（)）'"“”]+/g, '');
    if (normalizedText.includes(normalizedFacility)) {
      return { isMatch: true, matchedPattern: facility };
    }
  }

  return { isMatch: false, matchedPattern: null };
}
