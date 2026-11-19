import type { Open, OptimizationContext } from '../domain/types.ts'

// Optimizer 검증 Run 표시(임시, OI-12). 어느 라벨 사이트인지는 `variant`가 아니라 `optimizationContext`로만 알 수 있다.
// 일반 Run(`optimizationContext`가 없음)은 이 표시를 쓰지 않으므로 기존 표시가 그대로다.

const ROLE_LABELS: Readonly<Record<string, string>> = {
  BASELINE: '기준',
  CANDIDATE: '후보',
}

/** 역할 원문을 문구로 바꾼다. 모르는 값은 원문을 그대로 보인다 */
export const optimizerRoleLabel = (role: Open<string>): string =>
  Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role] : role

/** 예: `Optimizer 검증 · 후보 C2 주문·환불` */
export function optimizerRunText(context: OptimizationContext): string {
  return `Optimizer 검증 · ${optimizerRoleLabel(context.executionRole)} ${context.candidateId} ${context.label}`
}
