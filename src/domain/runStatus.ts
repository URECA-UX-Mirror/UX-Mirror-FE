const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'SUCCESS',
  'BLOCKED',
  'MAX_STEPS',
  'TIMEOUT',
  'ERROR',
])

/**
 * Run이 종료 상태인지 판정한다. 종료 판정은 이 함수에서만 한다.
 * 모르는 상태값은 진행 중으로 본다(오류로 만들지 않는다). `docs/contracts/run-lifecycle.md`
 */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}
