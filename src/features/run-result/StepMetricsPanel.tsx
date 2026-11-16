import { useState } from 'react'
import type { StepDecision } from '../../domain/types.ts'
import {
  formatMargin,
  formatProbability,
  formatRatio,
} from './format.ts'

interface StepMetricsPanelProps {
  decision: StepDecision
}

/** Step의 `decision` 값을 그대로 표시한다. `null`은 0이 아니라 "계산 불가"다. 펼침 여부는 화면 상태다. */
export function StepMetricsPanel({ decision }: StepMetricsPanelProps) {
  const [open, setOpen] = useState(false)
  return (
    <section className="metrics-panel" aria-label="지표">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        지표 {open ? '접기' : '펼치기'}
      </button>
      {open ? (
        <>
          <dl className="summary-grid">
            <dt>정규화 엔트로피</dt>
            <dd>{formatRatio(decision.normalizedEntropy)}</dd>
            <dt>클릭 후보 엔트로피</dt>
            <dd>{formatRatio(decision.clickOnlyNormalizedEntropy)}</dd>
            <dt>Top-2 margin</dt>
            <dd>{formatMargin(decision.top2Margin)}</dd>
            <dt>클릭 후보 Top-2 margin</dt>
            <dd>{formatMargin(decision.clickOnlyTop2Margin)}</dd>
            <dt>GO_BACK 확률</dt>
            <dd>{formatProbability(decision.goBackProbability)}</dd>
            <dt>목표 경로 확률</dt>
            <dd>{formatProbability(decision.goalPathProbability)}</dd>
            <dt>모델 판단 시간</dt>
            <dd>
              {decision.modelLatencyMs === null
                ? '값 없음'
                : `${decision.modelLatencyMs}ms`}
            </dd>
          </dl>
          {decision.metricWarnings.length > 0 ? (
            <ul className="metric-warnings">
              {decision.metricWarnings.map((warning) => (
                <li key={warning.code}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
