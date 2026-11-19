import type { Run } from '../../domain/types.ts'

const LABELS: Record<string, string> = {
  READY: '시작 준비 중',
  RUNNING: 'AI 고객이 둘러보는 중',
  SUCCESS: '도착함',
  BLOCKED: '찾지 못하고 멈춤',
  MAX_STEPS: '클릭 수를 다 씀',
  TIMEOUT: '시간 초과',
  ERROR: '진단 오류',
}

/**
 * 상태 표시 문구(docs/contracts/run-lifecycle.md의 상태 표).
 * 모르는 상태값은 코드 문자열을 그대로 보인다. `ERROR`는 `error.message`를 덧붙인다.
 */
export function statusLabel(run: Pick<Run, 'status' | 'error'>): string {
  const label = LABELS[run.status] ?? '확인 필요'
  if (run.status === 'ERROR' && run.error) return `${label}: ${run.error.message}`
  return label
}
