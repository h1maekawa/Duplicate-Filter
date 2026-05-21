import mallKeywords from '../config/mall_keywords.json';

/**
 * 店名または住所から商業施設・駅ビル・アウトレットに含まれるか判定する
 */
export function isCommercialFacility(
  name: string,
  address: string,
): { isMatch: boolean; matchedPattern: string | null } {
  const rawText = `${name} ${address}`.toLowerCase();
  const normalizedText = rawText.normalize('NFKC');

  // 1. 厳格判定ワード（最優先除外ワード）
  for (const word of mallKeywords.strictWords) {
    const normWord = word.normalize('NFKC').toLowerCase();
    if (normalizedText.includes(normWord)) {
      return { isMatch: true, matchedPattern: word };
    }
  }

  // 2. 階数表現 + 施設特徴ワード
  const floorRegex = new RegExp(mallKeywords.floorIndicatorPattern, 'i');
  const hasFloor = floorRegex.test(normalizedText);

  if (hasFloor) {
    for (const fac of mallKeywords.floorFacilityWords) {
      const normFac = fac.normalize('NFKC').toLowerCase();
      if (normalizedText.includes(normFac)) {
        return { isMatch: true, matchedPattern: `floor_with_${fac}` };
      }
    }
  }

  // 3. 基本商業施設キーワード
  for (const keyword of mallKeywords.keywords) {
    const normKeyword = keyword.normalize('NFKC').toLowerCase();
    if (normalizedText.includes(normKeyword)) {
      return { isMatch: true, matchedPattern: keyword };
    }
  }

  // 4. 個別施設リストの部分一致
  for (const facility of mallKeywords.listedFacilities) {
    const normFacility = facility.normalize('NFKC').toLowerCase();
    if (normalizedText.includes(normFacility)) {
      return { isMatch: true, matchedPattern: facility };
    }
  }

  return { isMatch: false, matchedPattern: null };
}
