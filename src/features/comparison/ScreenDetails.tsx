import { useState } from 'react'
import type { Comparison, ScreenComparison } from '../../domain/types.ts'
import { ProbabilityGauge } from '../../shared/ProbabilityGauge.tsx'
import { formatPercent } from '../../shared/screenshot/boxStyle.ts'
import { ScreenshotPane } from './ScreenshotPane.tsx'
import { useRunSteps, type RunStepsState } from './useComparisonData.ts'
import { pageName, reasonText, SIDE_NAMES, type Side } from './labels.ts'

function GaugeRow({ side, value }: { side: Side; value: number | null }) {
  return (
    <div className="pair-row">
      <span className="side-tag" data-side={side}>
        {SIDE_NAMES[side]}
      </span>
      {value === null ? <span className="gauge" aria-hidden="true" /> : <ProbabilityGauge value={value} tone={side} />}
      <span className="pair-value">{value === null ? '없음' : formatPercent(value)}</span>
    </div>
  )
}

const candidateName = (before: string | null, after: string | null) =>
  before === after ? (before ?? '이름 없음') : `${before ?? '없음'} → ${after ?? '없음'}`

interface ScreenCardProps {
  screen: ScreenComparison
  beforeRunId: string
  afterRunId: string
  beforeSteps: RunStepsState
  afterSteps: RunStepsState
}

/** 한 화면의 두 스크린샷과 누를 가능성. 값은 서버가 준 그대로다 */
function ScreenCard({ screen, beforeRunId, afterRunId, beforeSteps, afterSteps }: ScreenCardProps) {
  return (
    <article className="comparison-screen" aria-label={pageName(screen.pageKey)}>
      <h3>{pageName(screen.pageKey)}</h3>
      {screen.screenComparable ? null : <p className="muted">{reasonText(screen.reason)}</p>}
      <div className="comparison-panes">
        <ScreenshotPane side="before" runId={beforeRunId} stepId={screen.beforeStepId} stepsState={beforeSteps} screen={screen} />
        <ScreenshotPane side="after" runId={afterRunId} stepId={screen.afterStepId} stepsState={afterSteps} screen={screen} />
      </div>
      {screen.candidateComparisons.length > 0 ? (
        <>
          <h4>누를 가능성</h4>
          <ol className="comparison-candidates">
            {screen.candidateComparisons.map((candidate, index) => (
              <li key={candidate.semanticKey}>
                <span className="comparison-candidate-name">
                  <span className="candidate-no">{index + 1}</span>
                  {candidateName(candidate.beforeLabel, candidate.afterLabel)}
                </span>
                <div className="pair">
                  <GaugeRow side="before" value={candidate.beforeProbability} />
                  <GaugeRow side="after" value={candidate.afterProbability} />
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </article>
  )
}

/** 스크린샷은 펼쳤을 때만 받는다 */
function ScreenList({ comparison }: { comparison: Comparison }) {
  const beforeSteps = useRunSteps(comparison.beforeRunId)
  const afterSteps = useRunSteps(comparison.afterRunId)
  return (
    <>
      <p className="muted">AI가 예상한 값이라 실제 고객 수치와는 달라요.</p>
      {comparison.screenComparisons.map((screen) => (
        <ScreenCard
          key={screen.pageKey}
          screen={screen}
          beforeRunId={comparison.beforeRunId}
          afterRunId={comparison.afterRunId}
          beforeSteps={beforeSteps}
          afterSteps={afterSteps}
        />
      ))}
    </>
  )
}

/** 화면별 자세한 비교. 기본은 접혀 있다 */
export function ScreenDetails({ comparison }: { comparison: Comparison }) {
  // 펼침 여부는 화면 상태다
  const [open, setOpen] = useState(false)
  if (comparison.screenComparisons.length === 0) return null
  return (
    <details className="comparison-details" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault()
          setOpen((value) => !value)
        }}
      >
        화면별로 자세히 보기
      </summary>
      {open ? <ScreenList comparison={comparison} /> : null}
    </details>
  )
}
