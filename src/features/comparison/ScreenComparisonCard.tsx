import { useState } from 'react'
import { screenshotUrl } from '../../api/runs.ts'
import type {
  ScreenComparison,
  ScreenMetrics,
  Step,
} from '../../domain/types.ts'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { formatPercent } from '../../shared/screenshot/boxStyle.ts'
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

interface ScreenshotPaneProps {
  title: string
  runId: string
  stepId: number | null
  stepsState: RunStepsState
}

/** 한 버전의 스크린샷과 후보 박스. 박스는 이 Run의 Step에서만 가져온다 */
function ScreenshotPane({
  title,
  runId,
  stepId,
  stepsState,
}: ScreenshotPaneProps) {
  const step: Step | undefined =
    stepId === null ? undefined : stepsState.steps.get(stepId)
  let body
  if (stepId === null) {
    body = <p className="muted">이 버전에서 방문하지 않아 화면이 없습니다</p>
  } else if (!step) {
    body = (
      <p className="muted" role="status">
        {stepsState.failed
          ? '화면 정보를 불러오지 못했습니다'
          : stepsState.loading
            ? '화면 준비 중'
            : '화면 없음'}
      </p>
    )
  } else {
    body = (
      <ScreenshotViewer
        src={screenshotUrl(runId, step.stepId)}
        alt={`${title} 화면 (${runId}, Step ${step.stepId})`}
        viewport={step.page.viewport}
        screenshotSize={step.page.screenshotSize}
        scroll={step.page.scroll}
        boxes={step.candidates.map((candidate) => ({
          id: candidate.optionId,
          bbox: candidate.bbox,
          label: candidate.label,
          probability: candidate.probability,
          highlighted: candidate.selected,
        }))}
        runInProgress={false}
      />
    )
  }
  return (
    <figure className="comparison-pane">
      <figcaption>
        {title} <span className="muted">{runId}</span>
      </figcaption>
      {body}
    </figure>
  )
}

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
        />
        <ScreenshotPane
          title="After"
          runId={afterRunId}
          stepId={screen.afterStepId}
          stepsState={afterSteps}
        />
      </div>

      {/* 스크린샷 박스의 확률 배지도 있으므로 후보 대응 표가 없어도 항상 둔다 */}
      <p className="probability-note">
        모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다
      </p>

      {screen.candidateComparisons.length > 0 ? (
        <>
          <h4>후보 대응</h4>
          <div className="comparison-table-scroll">
          <table className="comparison-candidates">
            <thead>
              <tr>
                <th scope="col">Before 후보</th>
                <th scope="col">Before 확률</th>
                <th scope="col">After 후보</th>
                <th scope="col">After 확률</th>
                <th scope="col">증감(서버 값)</th>
              </tr>
            </thead>
            <tbody>
              {screen.candidateComparisons.map((candidate) => (
                <tr key={candidate.semanticKey}>
                  <td>{candidate.beforeLabel ?? '없음'}</td>
                  <td>{probabilityText(candidate.beforeProbability)}</td>
                  <td>{candidate.afterLabel ?? '없음'}</td>
                  <td>{probabilityText(candidate.afterProbability)}</td>
                  <td>
                    {formatDelta(candidate.deltaProbability, 'probability')}
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
