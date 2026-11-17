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

/** 경로 기준이 없는 Run(`referenceBasis: null`)의 경로 기반 지표. 원인(허용 경로 없음·지도 오류)은 응답에 없어 구분하지 않는다(OI-10). 0이나 "해당 없음"이 아니라 계산하지 않은 값이다. */
export const NO_REFERENCE_PATH = '계산 불가 (경로 기준 없음)'

/** 개수. `null`(목표 미도달의 `extraSteps` 계열)은 0이 아니라 "해당 없음"이다. */
export function formatCount(value: number | null): string {
  return value === null ? NOT_APPLICABLE : String(value)
}

/** 이 기준에서 쓰지 않는 지표(예: 사이트 지도 기준의 허용 경로 이탈 횟수) */
export const NOT_USED = '사용 안 함'

/**
 * 경로 지표 값. `null`의 이유를 지표와 기준으로 구분하며 0으로 바꾸지 않는다.
 * - 기준 없음: 원인과 무관하게 `NO_REFERENCE_PATH`
 * - `detour`(`detourMoveCount`): 이동 기록에서 나오는 값이라 목표 도달과 무관하게 `null`이면 "계산 불가"
 * - `extra`(`extraSteps` 계열): 목표 미도달이면 "해당 없음", 도달했는데 `null`이면 "계산 불가"
 */
export function formatPathMetric(
  value: number | null,
  basis: Open<ReferenceBasis> | null,
  goalReached: boolean,
  kind: 'extra' | 'detour' = 'extra',
): string {
  if (basis === null) return NO_REFERENCE_PATH
  if (value === null && (kind === 'detour' || goalReached)) return '계산 불가'
  return formatCount(value)
}
