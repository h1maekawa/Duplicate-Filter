import { createHash } from 'node:crypto';

export function buildStoreId(parts: Array<string | number | null | undefined>): string {
  const key = parts
    .map((part) => (part == null ? '' : String(part)))
    .join('|');

  return createHash('sha1').update(key).digest('hex').slice(0, 20);
}
