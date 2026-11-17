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
import type { RunStepsState } from './useComparisonData.ts'

/** 서버가 준 `reason` 코드의 안내 문구. 목록에 없는 코드는 코드를 그대로 보인다 */
const REASON_TEXT: Record<string, string> = {
  NOT_VISITED_IN_BEFORE: 'Before에서 방문하지 않은 화면입니다',
  NOT_VISITED_IN_AFTER: 'After에서 방문하지 않은 화면입니다',
  GLOBAL_CONDITIONS_MISMATCH: '비교 조건이 일치하지 않아 비교할 수 없습니다',
  CANDIDATE_SET_MISMATCH: '후보 구성이 달라 비교할 수 없습니다',
  ACTION_SET_MISMATCH: '선택지 구성이 달라 비교할 수 없습니다',
}

const reasonText = (reason: string | null) =>
  reason === null ? '비교할 수 없습니다' : (REASON_TEXT[reason] ?? reason)

const METRIC_ROWS: {
  key: keyof ScreenMetrics
  label: string
  kind: MetricKind
}[] = [
  { key: 'normalizedEntropy', label: '정규화 엔트로피', kind: 'ratio' },
  {
    key: 'clickOnlyNormalizedEntropy',
    label: '클릭 후보 정규화 엔트로피',
    kind: 'ratio',
  },
  { key: 'top2Margin', label: 'Top-2 margin', kind: 'margin' },
  {
    key: 'clickOnlyTop2Margin',
    label: '클릭 후보 Top-2 margin',
    kind: 'margin',
  },
  { key: 'goBackProbability', label: 'GO_BACK 확률', kind: 'probability' },
  { key: 'goalPathProbability', label: '목표 경로 확률', kind: 'probability' },
]

function MetricsTable({ metrics }: { metrics: ScreenMetrics }) {
  return (
    <div className="comparison-table-scroll">
    <table className="comparison-metrics">
      <thead>
        <tr>
          <th scope="col">지표</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
          <th scope="col">증감(서버 값)</th>
        </tr>
      </thead>
      <tbody>
        {METRIC_ROWS.map(({ key, label, kind }) => (
          <tr key={key}>
            <th scope="row">{label}</th>
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
        {side === 'before' ? 'Before' : 'After'}
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
}

export function ScreenComparisonCard({
  screen,
  beforeRunId,
  afterRunId,
  beforeSteps,
  afterSteps,
}: ScreenComparisonCardProps) {
  // 지표 표 펼침 여부는 화면 상태다
  const [metricsOpen, setMetricsOpen] = useState(false)

  return (
    <article className="comparison-screen">
      <h3>
        화면: <code>{screen.pageKey}</code>
      </h3>
      {screen.screenComparable ? null : (
        <p role="status" className="comparison-reason">
          비교할 수 없는 화면입니다 — {reasonText(screen.reason)}
        </p>
      )}

      <div className="comparison-panes">
        <ScreenshotPane
          title="Before"
          runId={beforeRunId}
          stepId={screen.beforeStepId}
          stepsState={beforeSteps}
          screen={screen}
        />
        <ScreenshotPane
          title="After"
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
              Before
            </span>
            <span className="legend-item" data-tone="after">
              After
            </span>
          </div>
          <div className="comparison-table-scroll">
          <table className="comparison-candidates">
            <thead>
              <tr>
                <th scope="col">후보</th>
                <th scope="col">Before / After 확률</th>
                <th scope="col">증감(서버 값)</th>
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
          {metricsOpen ? <MetricsTable metrics={screen.metrics} /> : null}
        </>
      )}
    </article>
  )
}
