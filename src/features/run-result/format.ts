import type { ReferenceBasis } from '../../api/dto/run.ts'
import type { Open } from '../../domain/types.ts'
import { formatPercent } from '../../shared/screenshot/boxStyle.ts'

/** 값이 없을 때(`null`)의 표시. 0으로 바꾸지 않는다. */
export const NOT_APPLICABLE = '해당 없음'

/** 단위 없는 비율(엔트로피 등). 소수 둘째 자리까지 반올림해 보이며 `bit` 같은 단위를 붙이지 않는다. */
export function formatRatio(value: number | null): string {
  return value === null ? '계산 불가' : value.toFixed(2)
}

/** Top-2 margin 계열. `0.12` → `12.0%p` */
export function formatMargin(value: number | null): string {
  return value === null ? '계산 불가' : `${(value * 100).toFixed(1)}%p`
}

export function formatProbability(value: number | null): string {
  return value === null ? '계산 불가' : formatPercent(value)
}

/** 허용 경로가 없는 Run(직접 입력한 목표)의 경로 기반 지표. 0이나 "해당 없음"이 아니라 계산하지 않은 값이다. */
export const NO_REFERENCE_PATH = '계산 불가 (허용 경로 없음)'

/** 개수. `null`(목표 미도달의 `extraSteps` 계열)은 0이 아니라 "해당 없음"이다. */
export function formatCount(value: number | null): string {
  return value === null ? NOT_APPLICABLE : String(value)
}

/** 사이트 지도 오류로 기준이 없는 Run의 경로 지표. 실행은 했지만 계산하지 않은 값이다. */
export const MAP_ERROR_NOT_COMPUTED = '계산하지 않음 (사이트 지도 오류)'

/** 이 기준에서 쓰지 않는 지표(예: 사이트 지도 기준의 허용 경로 이탈 횟수) */
export const NOT_USED = '사용 안 함'

/**
 * 경로 지표 값. `null`의 이유를 기준으로 구분하며 0으로 바꾸지 않는다.
 * - 기준 없음 + 직접 입력한 목표: 허용 경로가 없다(`NO_REFERENCE_PATH`)
 * - 기준 없음 + preset 목표: 사이트 지도 오류로 계산하지 않았다(임시 구분, OI-10)
 * - 기준 있음: 목표 미도달이면 "해당 없음"
 */
export function formatPathMetric(
  value: number | null,
  basis: Open<ReferenceBasis> | null,
  directGoal: boolean,
): string {
  if (basis === null) return directGoal ? NO_REFERENCE_PATH : MAP_ERROR_NOT_COMPUTED
  return formatCount(value)
}
