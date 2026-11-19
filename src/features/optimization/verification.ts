import type { Optimization } from '../../domain/types.ts'
import { verificationPhaseLabel } from './labels.ts'

/** 검증 단계에서 멈춘 `FAILED`인지. 평가 단계 실패는 검증 Run과 관계가 없다 */
export function isVerificationFailure(optimization: Optimization): boolean {
  return optimization.status === 'FAILED' && optimization.error?.failedPhase === 'VERIFYING'
}

/**
 * `VERIFYING`에서 지금 하는 일. 서버는 시작하자마자 `verificationPhase=BASELINE`을 넣지만 Run을 만들기 전에 사이트 재확인을 먼저 하므로,
 * 기준 Run이 아직 없으면 "사이트 확인 중"이다. 모르는 phase는 원문, phase가 없으면 `null`이다.
 */
export function verificationStepLabel(optimization: Optimization): string | null {
  if (optimization.status !== 'VERIFYING') return null
  if (optimization.baselineRunId === null) return '사이트 확인 중'
  return optimization.verificationPhase ? verificationPhaseLabel(optimization.verificationPhase) : null
}
