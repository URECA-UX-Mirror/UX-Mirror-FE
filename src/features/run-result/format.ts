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

/** 개수. `null`(목표 미도달의 `extraSteps` 계열)은 0이 아니라 "해당 없음"이다. */
export function formatCount(value: number | null): string {
  return value === null ? NOT_APPLICABLE : String(value)
}
