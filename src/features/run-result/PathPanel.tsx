import { screenshotUrl } from '../../api/runs.ts'
import type { PathVisit, Step } from '../../domain/types.ts'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { StepMetricsPanel } from './StepMetricsPanel.tsx'

interface PathPanelProps {
  runId: string
  path: PathVisit[]
  /** `null`이면 아직 조회 중이거나 실패했다 */
  steps: Step[] | null
  stepsFailed: boolean
  selected: number
  onSelect: (index: number) => void
}

/**
 * 노드의 화면에서 모델이 판단한 Step은 **다음 노드의 `stepId`**다(`PathVisit.stepId`는 그 노드에 들어오게 만든 Step, 계약 §6.4).
 * 다음 노드가 없거나(도착 화면) 그 `stepId`가 `null`이면 Step이 없다.
 */
function judgedStepId(path: PathVisit[], index: number): number | null {
  return path[index + 1]?.stepId ?? null
}

function nodeLabel(visit: PathVisit): string {
  const base = `${visit.sequence}. ${visit.pageKey}`
  return visit.enteredBy === 'GO_BACK' ? `${base} (이전 화면 복귀)` : base
}

export function PathPanel({
  runId,
  path,
  steps,
  stepsFailed,
  selected,
  onSelect,
}: PathPanelProps) {
  if (path.length === 0) {
    return (
      <section className="result-section" aria-label="탐색 경로">
        <h2>탐색 경로</h2>
        <p>탐색 경로 정보가 없습니다</p>
      </section>
    )
  }
  const index = Math.min(selected, path.length - 1)
  const visit = path[index]
  const isLast = index === path.length - 1
  const stepId = judgedStepId(path, index)
  const step =
    stepId === null ? null : (steps?.find((s) => s.stepId === stepId) ?? null)

  return (
    <section className="result-section" aria-label="탐색 경로">
      <h2>탐색 경로</h2>
      <ol className="path-list">
        {path.map((node, i) => (
          <li key={node.sequence}>
            <button
              type="button"
              aria-pressed={i === index}
              onClick={() => onSelect(i)}
            >
              {nodeLabel(node)}
            </button>
          </li>
        ))}
      </ol>

      <div className="path-detail">
        <h3>
          {visit.pageKey} <small>{visit.path}</small>
        </h3>
        {visit.enteredBy === 'GO_BACK' && visit.visitCause === 'MODEL_BACK' ? (
          <p>이전 화면 복귀: 모델이 GO_BACK을 선택해 돌아온 화면입니다.</p>
        ) : null}
        {visit.visitCause === 'SYSTEM_BACK_RECOVERY' ? (
          <p>시스템이 이전 화면으로 복구한 화면입니다.</p>
        ) : null}

        {stepId === null ? (
          <p role="status" className="no-image">
            {isLast
              ? '도착 화면 이미지 없음'
              : '이 화면에서 모델이 판단한 Step이 없어 이미지가 없습니다'}
          </p>
        ) : step === null ? (
          <p role="status" className="no-image">
            {stepsFailed
              ? 'Step 정보를 불러오지 못했습니다'
              : steps === null
                ? 'Step 정보를 불러오는 중'
                : `Step ${stepId} 정보를 찾을 수 없습니다`}
          </p>
        ) : (
          <>
            <ScreenshotViewer
              src={screenshotUrl(runId, step.stepId)}
              alt={`${visit.pageKey} 화면 (Step ${step.stepId})`}
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
            <CandidateProbabilityList
              candidates={step.candidates}
              decision={step.decision}
            />
            <StepMetricsPanel key={step.stepId} decision={step.decision} />
          </>
        )}
      </div>
    </section>
  )
}
