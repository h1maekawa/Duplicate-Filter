import { BUSINESS_WORDS } from '../constants';
import type { NormalizeOptions } from '../types';

function nfkc(value: string): string {
  return value.normalize('NFKC');
}

function collapseSpaces(value: string): string {
  return value.replace(/[\s　]+/g, ' ').trim();
}

function removeSymbols(value: string): string {
  return value.replace(/[【】\[\]()（）<>「」『』'"`'"".,，、。!！?？:：;；~〜·・/\\|]/g, '');
}

function convertKanjiNumerals(value: string): string {
  const digits: Record<string, number> = {
    〇: 0, 一: 1, 二: 2, 三: 3, 四: 4,
    五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };

  const parseChunk = (chunk: string): string => {
    let rest = chunk;
    let total = 0;
    if (rest.includes('百')) {
      const [left, right] = rest.split('百');
      total += (left ? digits[left] : 1) * 100;
      rest = right ?? '';
    }
    if (rest.includes('十')) {
      const [left, right] = rest.split('十');
      total += (left ? digits[left] : 1) * 10;
      rest = right ?? '';
    }
    if (rest) {
      total += digits[rest] ?? Number(rest);
    }
    return String(total);
  };

  return value.replace(/([〇一二三四五六七八九十百]+)(丁目|番地?|号)/g, (_, chunk: string, suffix: string) => {
    return `${parseChunk(chunk)}${suffix}`;
  });
}

function stripCorporateWords(value: string): string {
  return value.replace(/(株式会社|有限会社|合同会社|（株）|\(株\)|㈱|Inc\.?|LLC|Corp\.?)/gi, '');
}

function stripBusinessWords(value: string): string {
  const joined = BUSINESS_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!joined) return value;
  return value.replace(new RegExp(joined, 'gi'), '');
}

function cleanBrackets(value: string): string {
  return value.replace(/[（(]([^）)]+店)[）)]$/, '$1');
}

/**
 * 【修正】店名の支店サフィックスを除去する。
 * - 安全ガード: 除去後に2文字未満になる場合は除去しない
 * - 誤作動防止: 元の文字列が短すぎる場合はそのまま返す
 */
function stripBranchSuffix(value: string): string {
  let current = value.trim();

  // 安全ガード: 4文字未満は支店パターン除去を試みない（「本店」「支店」等の誤削除防止）
  if (current.length < 4) return current;

  current = cleanBrackets(current);

  // 固定パターン（本店・支店等）を除去、ただし除去後2文字以上あること
  const fixedSuffixes = /(?:総本店|本店|支店|本館|別館|新館|駅前店|[東西南北]口店|[0-9]+号店)$/u;
  const afterFixed = current.replace(fixedSuffixes, '');
  if (afterFixed.length >= 2) current = afterFixed;

  const branchPattern = /(?:駅前?|インター|通り?|[東西南北]口|モール)店$/u;
  const afterBranch = current.replace(branchPattern, '');
  if (afterBranch.length >= 2) current = afterBranch;

  if (current.endsWith('店')) {
    const chars = Array.from(current);
    const locationHint = /(駅|口|丁目|通|町|市|区|郡|県|都|府|谷|坂|川|前|橋|丘|島|北|南|東|西|モール|プラザ|パーク)$/u;
    for (let bodyLength = 2; bodyLength <= 8; bodyLength += 1) {
      if (chars.length <= bodyLength + 1) break;
      const suffixBody = chars.slice(-(bodyLength + 1), -1).join('');
      const prefix = chars.slice(0, -(bodyLength + 1)).join('');
      // 安全ガード: ブランド名が2文字以上残ること
      if (prefix.length >= 2 && locationHint.test(suffixBody)) {
        return prefix;
      }
    }

    // 「〇〇店」形式: ブランド名が2文字以上残ることを確認してから除去
    const simpleCityPattern = /([一-龠ァ-ヶー]{2,4})店$/u;
    const match = current.match(simpleCityPattern);
    if (match && current.length - match[0].length >= 2) {
      current = current.slice(0, current.length - match[0].length);
    }
  }

  return current;
}

export function normalizeName(value: unknown, options: NormalizeOptions = {}): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  let normalized = nfkc(value).toLowerCase();
  normalized = stripCorporateWords(normalized);
  normalized = stripBranchSuffix(normalized);

  // スペース・全角スペース・記号類を除去
  normalized = normalized.replace(/[\s　・\-ー]+/g, '');
  normalized = removeSymbols(normalized);

  // 本店, 支店, 号店, 店, 階, F を除去（残存分）
  // ただし2文字以上残る場合のみ
  const afterStoreSuffix = normalized.replace(/(本店|支店|号店|店|階|[Ff])/g, '');
  if (afterStoreSuffix.length >= 2) {
    normalized = afterStoreSuffix;
  }

  if (options.removeBusinessWords) {
    normalized = stripBusinessWords(normalized).replace(/[\s　]+/g, '');
  }

  return normalized.trim();
}

/**
 * 【修正】電話番号を正規化する。
 * - +81 (国際表記) を先頭の 0 に変換してから処理
 * - 10桁・11桁のみ有効とする
 */
export function normalizePhone(value: unknown): string {
  if (value == null) return '';

  let raw = nfkc(String(value)).trim();

  // +81 国際表記 → 先頭 0 に変換（例: +81-3-1234-5678 → 0312345678）
  // +81 または 0081 で始まる場合
  raw = raw.replace(/^\+81[-\s]?/, '0');
  raw = raw.replace(/^0081[-\s]?/, '0');

  // 数字のみ抽出
  const digits = raw.replace(/\D/g, '');

  if (digits.length !== 10 && digits.length !== 11) {
    return '';
  }

  return digits;
}

function stripBuildingInfo(value: string): string {
  let stripped = value;
  // 末尾の階数表現を除去
  stripped = stripped.replace(/(?:\s|　)*(?:[0-9一二三四五六七八九十]+F|[0-9一二三四五六七八九十]+階|B[0-9一二三四五六七八九十]+|B[0-9一二三四五六七八九十]+F|地下[0-9一二三四五六七八九十]+階|地下[0-9一二三四五六七八九十]+F?)(?:\s|　)*$/gi, '');
  // 末尾のビル名（スペースあり）を除去
  stripped = stripped.replace(/(?:\s|　)+.*(?:ビル|bldg|building|マンション|ハイツ|コーポ|タワー|アパート|コート|レジデンス|メゾン|プラザ).*$/gi, '');
  // 番地直後のビル名（スペースなし）を除去
  stripped = stripped.replace(/(?<=[0-9])(?:\s|　)*[^\d\s\-\u30FC\uFF0D\u2212\u2010\u2015]+(?:ビル|bldg|building|マンション|ハイツ|コーポ|タワー|アパート|コート|レジデンス|メゾン|プラザ).*$/gi, '');
  return stripped;
}

export function normalizeAddress(value: unknown, options: { stripPrefecture?: boolean } = {}): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  let normalized = nfkc(value);

  if (options.stripPrefecture) {
    normalized = normalized.replace(/^(東京都|北海道|京都府|大阪府|[一-龠]{2,3}県)/, '');
  }

  normalized = convertKanjiNumerals(normalized);
  normalized = normalized.replace(/[ー－−‐―]/g, '-');
  normalized = normalized.replace(/([0-9]+)丁目/g, '$1-');
  normalized = normalized.replace(/([0-9]+)番地?の?/g, '$1-');
  normalized = normalized.replace(/([0-9]+)の([0-9]+)/g, '$1-$2');
  normalized = normalized.replace(/([0-9]+)号/g, '$1');
  normalized = normalized.replace(/-+/g, '-');
  normalized = stripBuildingInfo(normalized);
  normalized = collapseSpaces(normalized).replace(/[\s　]/g, '');
  normalized = removeSymbols(normalized);
  normalized = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');

  return normalized.toLowerCase();
}

export function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  try {
    const url = new URL(value.trim());
    url.hash = '';
    url.search = '';
    const path = url.pathname.replace(/\/$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${path}`;
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
}

export function safeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}