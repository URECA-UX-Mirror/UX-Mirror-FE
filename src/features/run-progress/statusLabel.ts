import type { Run } from '../../domain/types.ts'

const LABELS: Record<string, string> = {
  READY: '실행 대기 중',
  RUNNING: 'AI 탐색 진행 중',
  SUCCESS: '목표 화면 도달',
  BLOCKED: '탐색을 계속할 수 없음',
  MAX_STEPS: '최대 탐색 횟수 도달',
  TIMEOUT: '시간 초과',
  ERROR: '실행 오류',
}

/**
 * 상태 표시 문구(docs/contracts/run-lifecycle.md의 상태 표).
 * 모르는 상태값은 코드 문자열을 그대로 보인다. `ERROR`는 `error.message`를 덧붙인다.
 */
export function statusLabel(run: Pick<Run, 'status' | 'error'>): string {
  const label = LABELS[run.status] ?? run.status
  if (run.status === 'ERROR' && run.error) return `${label}: ${run.error.message}`
  return label
}
