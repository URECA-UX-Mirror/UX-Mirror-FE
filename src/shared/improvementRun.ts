import type { ImprovementContext } from '../domain/types.ts'
import { optimizerRoleLabel } from './optimizerRun.ts'

// 자동 개선 검증 Run 표시(임시, OI-14). 어느 라벨 사이트인지는 `variant`가 아니라 `improvementContext`로만 알 수 있다.
// 일반 Run(`improvementContext`가 없음)은 이 표시를 쓰지 않으므로 기존 표시가 그대로다.

/** 예: `자동 개선 검증 · 후보 주문 환불` */
export function improvementRunText(context: ImprovementContext): string {
  return `자동 개선 검증 · ${optimizerRoleLabel(context.executionRole)} ${context.label}`
}
