import { BUSINESS_WORDS } from './constants';
import type { NormalizeOptions } from './types';

function nfkc(value: string): string {
  return value.normalize('NFKC');
}

function collapseSpaces(value: string): string {
  return value.replace(/[\s　]+/g, ' ').trim();
}

function removeSymbols(value: string): string {
  return value.replace(/[【】\[\]()（）<>「」『』'"`’“”.,，、。!！?？:：;；~〜·・/\\|]/g, '');
}

function convertKanjiNumerals(value: string): string {
  const digits: Record<string, number> = {
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
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

function stripBranchSuffix(value: string): string {
  let current = value;
  current = current.replace(/(?:本店|支店|総本店|本館|別館|新館|駅前店|[東西南北]口店|[0-9]+号店)$/u, '');

  const branchPattern = /(?:駅前?|インター|通り?|[東西南北]口|モール)店$/u;
  current = current.replace(branchPattern, '');

  if (current.endsWith('店')) {
    const chars = Array.from(current);
    const locationHint = /(駅|口|丁目|通|町|市|区|郡|県|都|府|谷|坂|川|前|橋|丘|島|北|南|東|西|モール|プラザ|パーク)$/u;
    for (let bodyLength = 2; bodyLength <= 8; bodyLength += 1) {
      if (chars.length <= bodyLength + 1) break;
      const suffixBody = chars.slice(-(bodyLength + 1), -1).join('');
      const prefix = chars.slice(0, -(bodyLength + 1)).join('');
      if (prefix.length >= 2 && locationHint.test(suffixBody)) {
        return prefix;
      }
    }

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
  
  // スペース、全角スペース、・、-、ー を完全に除去
  normalized = normalized.replace(/[\s　・\-ー]+/g, '');
  normalized = removeSymbols(normalized);
  
  // 本店, 支店, 号店, 店, 階, F を完全に除去
  normalized = normalized.replace(/(本店|支店|号店|店|階|[Ff])/g, '');

  if (options.removeBusinessWords) {
    normalized = stripBusinessWords(normalized).replace(/[\s　]+/g, '');
  }

  return normalized.trim();
}

export function normalizePhone(value: unknown): string {
  if (value == null) return '';
  // 記号やハイフンを完全に除去し、純粋な数字のみにする
  const normalized = nfkc(String(value)).replace(/\D/g, '');
  if (normalized.length !== 10 && normalized.length !== 11) {
    return '';
  }
  return normalized;
}

function stripBuildingInfo(value: string): string {
  let stripped = value;
  // 1. 末尾の階数（〇階、〇F、地下〇階など）を除去
  stripped = stripped.replace(/(?:\s|　)*(?:[0-9一二三四五六七八九十]+F|[0-9一二三四五六七八九十]+階|B[0-9一二三四五六七八九十]+|B[0-9一二三四五六七八九十]+F|地下[0-9一二三四五六七八九十]+階|地下[0-9一二三四五六七八九十]+F?)(?:\s|　)*$/gi, '');
  // 2. 末尾のビル名・建物名（スペースあり）を除去
  stripped = stripped.replace(/(?:\s|　)+.*(?:ビル|bldg|building|マンション|ハイツ|コーポ|タワー|アパート|コート|レジデンス|メゾン|プラザ).*$/gi, '');
  // 3. 番地の直後に続くビル名（スペースなし）を除去
  stripped = stripped.replace(/(?<=[0-9])(?:\s|　)*[^\d\s\-\u30FC\uFF0D\u2212\u2010\u2015]+(?:ビル|bldg|building|マンション|ハイツ|コーポ|タワー|アパート|コート|レジデンス|メゾン|プラザ).*$/gi, '');
  return stripped;
}

export function normalizeAddress(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';

  let normalized = nfkc(value);
  normalized = convertKanjiNumerals(normalized);
  normalized = normalized.replace(/[ー－−‐―]/g, '-');
  normalized = normalized.replace(/([0-9]+)丁目/g, '$1-');
  normalized = normalized.replace(/([0-9]+)番地?/g, '$1-');
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
