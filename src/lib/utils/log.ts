import type { DecisionLog } from '../types';

export function createLog(
  stage: DecisionLog['stage'],
  code: string,
  message: string,
  meta?: Record<string, unknown>,
  score?: number,
): DecisionLog {
  return {
    stage,
    code,
    message,
    meta,
    score,
    timestamp: new Date().toISOString(),
  };
}
