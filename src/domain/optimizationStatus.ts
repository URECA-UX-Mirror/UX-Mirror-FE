const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['COMPLETED', 'FAILED'])

/**
 * Optimization이 종료 상태인지 판정한다. 종료 판정은 이 함수에서만 한다(임시, OI-12).
 * `EVALUATING`·`VERIFYING`처럼 진행 중인 상태와 모르는 상태값은 종료로 보지 않는다.
 * `EVALUATED`는 사용자가 검증을 시작하길 기다리는 상태일 뿐 종료가 아니므로 폴링은 이어진다.
 */
export function isTerminalOptimizationStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}
