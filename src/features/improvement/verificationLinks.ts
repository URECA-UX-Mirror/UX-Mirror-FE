import type { VerificationPair, VerificationRun } from '../../domain/improvement.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'

// 프로토콜 상대 주소, 역슬래시, 제어 문자는 브라우저가 외부 주소로 해석할 수 있다.
export function internalPath(path: string | null): path is string {
  return path !== null && /^\/(?!\/)[^\\\s]*$/.test(path)
}

export function canReplay(run: VerificationRun | null): run is VerificationRun {
  return run !== null && run.validity === 'VALID' && run.status !== null && isTerminalStatus(run.status)
}

/** 비교 화면으로 연결할 수 있는 쌍: 내부 경로가 있고 양쪽 Run이 종료된 `VALID` Run이다 */
export function comparablePair(pair: VerificationPair): boolean {
  return internalPath(pair.comparisonPath) && canReplay(pair.before) && canReplay(pair.after)
}
