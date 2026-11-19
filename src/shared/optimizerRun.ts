import type { Open, OptimizationContext } from '../domain/types.ts'
import { PAGE_NAMES } from './pageNames.ts'

// 후보 비교 확인 실행 표시(임시, OI-12). 어느 메뉴 이름 화면인지는 `variant`가 아니라 `optimizationContext`로만 알 수 있다.
// 일반 Run(`optimizationContext`가 없음)은 이 표시를 쓰지 않으므로 기존 표시가 그대로다.

const ROLE_LABELS: Readonly<Record<string, string>> = {
  BASELINE: '기준',
  CANDIDATE: '후보',
}

/** 역할 원문을 문구로 바꾼다. 모르는 값은 "확인 필요"다 */
export const optimizerRoleLabel = (role: Open<string>): string =>
  Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role] : '확인 필요'

/** 예: `메뉴 이름 후보 비교 · 후보 "주문·환불"`. 후보 ID는 보이지 않는다 */
export function optimizerRunText(context: OptimizationContext): string {
  return `${PAGE_NAMES.optimizer} · ${optimizerRoleLabel(context.executionRole)} "${context.label}"`
}
