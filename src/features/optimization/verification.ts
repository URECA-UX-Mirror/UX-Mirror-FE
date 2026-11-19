import type { Optimization } from '../../domain/types.ts'

/** 검증 단계에서 멈춘 `FAILED`인지. 평가 단계 실패는 검증 Run과 관계가 없다 */
export function isVerificationFailure(optimization: Optimization): boolean {
  return optimization.status === 'FAILED' && optimization.error?.failedPhase === 'VERIFYING'
}
