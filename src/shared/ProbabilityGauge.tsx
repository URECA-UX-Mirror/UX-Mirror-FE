interface ProbabilityGaugeProps {
  /** 0~1. 막대 길이로만 보이고, 숫자는 옆에 따로 적는다 */
  value: number
  /** `before`·`after`는 비교 막대 색, 기본은 accent */
  tone?: 'default' | 'selected' | 'before' | 'after'
}

/**
 * 확률 게이지. 눈금은 항상 0~100%로 고정하고 구간별로 색을 바꾸지 않는다
 * (좋고 나쁨의 판정처럼 보이지 않게). 값은 접근성 트리에 중복해서 읽히지 않도록 숨긴다.
 */
export function ProbabilityGauge({ value, tone = 'default' }: ProbabilityGaugeProps) {
  const percent = Math.min(100, Math.max(0, value * 100))
  return (
    <span className="gauge" data-tone={tone} aria-hidden="true">
      <span className="gauge-fill" style={{ width: `${percent}%` }} />
    </span>
  )
}
