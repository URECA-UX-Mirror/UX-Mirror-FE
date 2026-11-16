import { formatPercent } from '../../shared/screenshot/boxStyle.ts'

/** 값이 없을 때(`null`)의 표시. 0이나 빈 칸으로 바꾸지 않는다 */
export const NULL_TEXT = '계산 불가'

export type MetricKind = 'ratio' | 'margin' | 'probability'

const sign = (value: number) => (value > 0 ? '+' : '')

/** 값 표시. 비율은 소수 둘째 자리(단위 없음), margin은 `%p`, 확률은 `%` */
export function formatMetric(value: number | null, kind: MetricKind): string {
  if (value === null) return NULL_TEXT
  if (kind === 'ratio') return value.toFixed(2)
  if (kind === 'margin') return `${(value * 100).toFixed(1)}%p`
  return formatPercent(value)
}

/** 서버가 준 증감 표시. 부호만 붙이고 판정 문구나 화살표는 만들지 않는다 */
export function formatDelta(value: number | null, kind: MetricKind): string {
  if (value === null) return NULL_TEXT
  if (kind === 'ratio') return `${sign(value)}${value.toFixed(2)}`
  // 확률·margin의 증감은 비율 차이라서 %p로 표시한다
  return `${sign(value)}${(value * 100).toFixed(1)}%p`
}
