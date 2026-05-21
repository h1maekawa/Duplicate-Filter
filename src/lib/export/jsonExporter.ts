import type { PipelineResult } from '../types';

/**
 * パイプライン結果を綺麗なJSON形式に変換する
 */
export function generateJsonContent(result: PipelineResult): string {
  return JSON.stringify(result, null, 2);
}
