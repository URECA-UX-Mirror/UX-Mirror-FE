// 자동 개선 점수 표시 규칙. 0~1 점수를 `%`로, 변화량을 `%p`로 바꾸는 변환은 이 파일 한 곳에만 둔다.

/** 값이 없을 때(`null`)의 표시. 0%나 빈 칸으로 바꾸지 않는다 */
export const SCORE_NULL_TEXT = '값 없음'

const roundTenth = (value: number) => Math.round(value * 1000) / 10

/** 0~1 점수를 `%`로. 소수 첫째 자리까지 보인다(`0.385` → `38.5%`) */
export function formatScore(value: number | null): string {
  if (value === null) return SCORE_NULL_TEXT
  return `${roundTenth(value).toFixed(1)}%`
}

/** 변화량을 `%p`로. 양수에는 `+`를 붙이고 0은 부호 없이 `0.0%p`다(`-0.008` → `-0.8%p`) */
export function formatScoreDelta(value: number | null): string {
  if (value === null) return SCORE_NULL_TEXT
  const tenths = roundTenth(value)
  // 반올림하면 0인 작은 음수가 `-0.0`으로 보이지 않게 한다
  if (tenths === 0) return '0.0%p'
  return `${tenths > 0 ? '+' : ''}${tenths.toFixed(1)}%p`
}

/** 방향이 없는 차이의 크기를 `%p`로. 부호를 붙이지 않는다(`0.006` → `0.6%p`) */
export function formatScoreMagnitude(value: number | null): string {
  if (value === null) return SCORE_NULL_TEXT
  return `${Math.abs(roundTenth(value)).toFixed(1)}%p`
}
