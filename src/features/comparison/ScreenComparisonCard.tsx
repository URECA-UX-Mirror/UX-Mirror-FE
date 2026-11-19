import { useState } from 'react'
import type { ScreenComparison, ScreenMetrics } from '../../domain/types.ts'
import { ProbabilityGauge } from '../../shared/ProbabilityGauge.tsx'
import { formatPercent } from '../../shared/screenshot/boxStyle.ts'
import { ScreenshotPane } from './ScreenshotPane.tsx'
import {
  formatDelta,
  formatMetric,
  NULL_TEXT,
  type MetricKind,
} from './format.ts'
import { goalPathProbabilityHint, referenceBasisLabel } from '../../domain/referenceBasis.ts'
import type { RunBasis, RunStepsState } from './useComparisonData.ts'
import { pageName, SIDE_NAMES } from './labels.ts'

/** 서버가 준 `reason` 코드의 안내 문구. 목록에 없는 코드는 코드 대신 일반 안내를 보인다 */
const REASON_TEXT: Record<string, string> = {
  NOT_VISITED_IN_BEFORE: `${SIDE_NAMES.before}에서는 들르지 않은 화면입니다`,
  NOT_VISITED_IN_AFTER: `${SIDE_NAMES.after}에서는 들르지 않은 화면입니다`,
  GLOBAL_CONDITIONS_MISMATCH: '비교 조건이 일치하지 않아 비교할 수 없습니다',
  CANDIDATE_SET_MISMATCH: '후보 구성이 달라 비교할 수 없습니다',
  ACTION_SET_MISMATCH: '선택지 구성이 달라 비교할 수 없습니다',
}

const reasonText = (reason: string | null) =>
  reason === null ? '비교할 수 없습니다' : (REASON_TEXT[reason] ?? '비교할 수 없는 이유를 확인하지 못했습니다')

const METRIC_ROWS: {
  key: keyof ScreenMetrics
  label: string
  kind: MetricKind
}[] = [
  { key: 'normalizedEntropy', label: '고르기 어려운 정도', kind: 'ratio' },
  {
    key: 'clickOnlyNormalizedEntropy',
    label: '버튼 고르기 어려운 정도',
    kind: 'ratio',
  },
  { key: 'top2Margin', label: '1·2위 확률 차이', kind: 'margin' },
  {
    key: 'clickOnlyTop2Margin',
    label: '클릭 후보 1·2위 확률 차이',
    kind: 'margin',
  },
  { key: 'goBackProbability', label: '뒤로 가기 확률', kind: 'probability' },
  { key: 'goalPathProbability', label: '목표 경로 확률', kind: 'probability' },
]

/** 기준 설명. 두 Run의 기준이 같으면 한 문장, 다르면 버전별로 보인다. 기준을 모르면(`undefined`) 붙이지 않는다 */
function goalPathHint(before: RunBasis, after: RunBasis): string | null {
  if (before === undefined || after === undefined) return null
  if (before === after) return goalPathProbabilityHint(before)
  return `${SIDE_NAMES.before}(${referenceBasisLabel(before)}): ${goalPathProbabilityHint(before)} / ${SIDE_NAMES.after}(${referenceBasisLabel(after)}): ${goalPathProbabilityHint(after)}`
}

function MetricsTable({
  metrics,
  beforeBasis,
  afterBasis,
}: {
  metrics: ScreenMetrics
  beforeBasis: RunBasis
  afterBasis: RunBasis
}) {
  const hint = goalPathHint(beforeBasis, afterBasis)
  return (
    <div className="comparison-table-scroll">
    <table className="comparison-metrics">
      <thead>
        <tr>
          <th scope="col">지표</th>
          <th scope="col">{SIDE_NAMES.before}</th>
          <th scope="col">{SIDE_NAMES.after}</th>
          <th scope="col">변화</th>
        </tr>
      </thead>
      <tbody>
        {METRIC_ROWS.map(({ key, label, kind }) => (
          <tr key={key}>
            <th scope="row">
              {label}
              {key === 'goalPathProbability' && hint ? (
                <span className="muted metric-hint">{hint}</span>
              ) : null}
            </th>
            <td>{formatMetric(metrics[key].before, kind)}</td>
            <td>{formatMetric(metrics[key].after, kind)}</td>
            <td>{formatDelta(metrics[key].delta, kind)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

const probabilityText = (value: number | null) =>
  value === null ? NULL_TEXT : formatPercent(value)

function GaugeRow({
  side,
  value,
}: {
  side: 'before' | 'after'
  value: number | null
}) {
  return (
    <div className="pair-row">
      <span className="pair-side" data-side={side}>
        {SIDE_NAMES[side]}
      </span>
      {value === null ? (
        <span className="gauge" aria-hidden="true" />
      ) : (
        <ProbabilityGauge value={value} tone={side} />
      )}
      <span className="pair-value">{probabilityText(value)}</span>
    </div>
  )
}

/** 같은 눈금(0~100%)으로 Before·After 막대를 위아래에 놓아 길이를 바로 비교한다 */
export function PairedGauge({
  before,
  after,
}: {
  before: number | null
  after: number | null
}) {
  return (
    <div className="pair">
      <GaugeRow side="before" value={before} />
      <GaugeRow side="after" value={after} />
    </div>
  )
}

interface ScreenComparisonCardProps {
  screen: ScreenComparison
  beforeRunId: string
  afterRunId: string
  beforeSteps: RunStepsState
  afterSteps: RunStepsState
  beforeBasis?: RunBasis
  afterBasis?: RunBasis
}

export function ScreenComparisonCard({
  screen,
  beforeRunId,
  afterRunId,
  beforeSteps,
  afterSteps,
  beforeBasis,
  afterBasis,
}: ScreenComparisonCardProps) {
  // 지표 표 펼침 여부는 화면 상태다
  const [metricsOpen, setMetricsOpen] = useState(false)

  return (
    <article className="comparison-screen">
      <h3>
        화면: {pageName(screen.pageKey)}
      </h3>
      {screen.screenComparable ? null : (
        <p role="status" className="comparison-reason">
          비교할 수 없는 화면입니다 — {reasonText(screen.reason)}
        </p>
      )}

      <div className="comparison-panes">
        <ScreenshotPane
          side="before"
          runId={beforeRunId}
          stepId={screen.beforeStepId}
          stepsState={beforeSteps}
          screen={screen}
        />
        <ScreenshotPane
          side="after"
          runId={afterRunId}
          stepId={screen.afterStepId}
          stepsState={afterSteps}
          screen={screen}
        />
      </div>

      {/* 스크린샷 위에는 번호 태그만 있으므로 확률 문구는 후보 대응 표가 없어도 항상 둔다 */}
      <p className="probability-note">
        모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다
      </p>

      {screen.candidateComparisons.length > 0 ? (
        <>
          <div className="comparison-legend">
            <h4>후보별 확률 비교</h4>
            <span className="legend-item" data-tone="before">
              {SIDE_NAMES.before}
            </span>
            <span className="legend-item" data-tone="after">
              {SIDE_NAMES.after}
            </span>
          </div>
          <div className="comparison-table-scroll">
          <table className="comparison-candidates">
            <thead>
              <tr>
                <th scope="col">후보</th>
                <th scope="col">{SIDE_NAMES.before} / {SIDE_NAMES.after} 확률</th>
                <th scope="col">변화</th>
              </tr>
            </thead>
            <tbody>
              {screen.candidateComparisons.map((candidate, index) => (
                <tr key={candidate.semanticKey}>
                  <td>
                    <span className="candidate-no">{index + 1}</span>
                    {candidate.beforeLabel === candidate.afterLabel
                      ? (candidate.beforeLabel ?? '없음')
                      : `${candidate.beforeLabel ?? '없음'} → ${candidate.afterLabel ?? '없음'}`}
                  </td>
                  <td>
                    <PairedGauge
                      before={candidate.beforeProbability}
                      after={candidate.afterProbability}
                    />
                  </td>
                  <td>
                    <span className="delta-chip">
                      {formatDelta(candidate.deltaProbability, 'probability')}
                    </span>
                    {candidate.comparable ? null : (
                      <span className="muted">
                        {' '}
                        ({reasonText(candidate.reason)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : null}

      {screen.metrics === null ? (
        <p className="muted">
          지표 비교가 없습니다. 한쪽 버전에서 방문하지 않은 화면입니다.
        </p>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={metricsOpen}
            onClick={() => setMetricsOpen((open) => !open)}
          >
            {metricsOpen ? '지표 표 접기' : '지표 표 펼치기'}
          </button>
          {metricsOpen ? (
            <MetricsTable
              metrics={screen.metrics}
              beforeBasis={beforeBasis}
              afterBasis={afterBasis}
            />
          ) : null}
        </>
      )}
    </article>
  )
}
