import { goalScreenshotUrl, screenshotUrl } from '../../api/runs.ts'
import type { PathVisit, Size, Step } from '../../domain/types.ts'
import { RouteIcon, ColumnsIcon } from '../../shared/icons.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { SelectedAction } from '../../shared/SelectedAction.tsx'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { selectedLabel } from '../../shared/stepLabel.ts'
import type { ReferenceBasis } from '../../api/dto/run.ts'
import type { Open } from '../../domain/types.ts'
import { StepMetricsPanel } from './StepMetricsPanel.tsx'

interface PathPanelProps {
  runId: string
  labelPage: (key: string) => string
  /** 경로 지표 기준(`Run.referenceBasis`) */
  basis: Open<ReferenceBasis> | null
  path: PathVisit[]
  /** `null`이면 아직 조회 중이거나 실패했다 */
  steps: Step[] | null
  stepsFailed: boolean
  /** 자동 재시도(backoff) 중 */
  stepsRetrying: boolean
  onRetrySteps: () => void
  /** 목표 화면에 도달했는지(`Run.summary`). 마지막 노드의 이름표에 쓴다 */
  goalReached: boolean
  /** `Run.terminationReason`. `GOAL_VERIFIED`일 때만 마지막 노드의 도착 화면 이미지를 요청한다(OI-3) */
  terminationReason: string | null
  /** `Run.viewport`. 도착 화면 이미지의 비율을 잡는다 */
  viewport: Size
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

/** 노드 위의 이름표. 복귀로 들어온 노드는 `이전 화면 복귀`로 구분한다 */
function nodeTag(visit: PathVisit, index: number, last: boolean, goalReached: boolean) {
  if (visit.enteredBy === 'GO_BACK') {
    return visit.visitCause === 'SYSTEM_BACK_RECOVERY' ? '시스템 복구' : '이전 화면 복귀'
  }
  if (index === 0) return '시작'
  if (last) return goalReached ? '목표 도달' : '종료'
  return null
}

/** 노드 사이의 화살표 이름. 다음 노드에 들어오게 만든 행동이다 */
function edgeLabel(next: PathVisit, steps: Step[] | null): string {
  if (next.enteredBy === 'GO_BACK') {
    return next.visitCause === 'SYSTEM_BACK_RECOVERY' ? '시스템 복구' : '모델 GO_BACK 복귀'
  }
  const step = steps?.find((item) => item.stepId === next.stepId)
  return step ? `CLICK [${selectedLabel(step)}]` : 'CLICK'
}

export function PathPanel({
  runId,
  labelPage,
  basis,
  path,
  steps,
  stepsFailed,
  stepsRetrying,
  onRetrySteps,
  goalReached,
  terminationReason,
  viewport,
  selected,
  onSelect,
}: PathPanelProps) {
  if (path.length === 0) {
    return (
      <section className="card" aria-label="탐색 경로">
        <SectionTitle icon={<RouteIcon />} title="AI 탐색 경로" />
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
    <>
      <section className="card" aria-label="탐색 경로">
        <SectionTitle
          icon={<RouteIcon />}
          title="AI 탐색 경로"
          aside="노드를 선택하면 아래에서 당시 화면과 선택 확률을 볼 수 있습니다"
        />
        <ul className="flow-legend" aria-label="범례">
          <li data-kind="click">모델 CLICK</li>
          <li data-kind="back">모델 GO_BACK</li>
          <li data-kind="goal">목표 도달</li>
        </ul>
        <ol className="flow">
          {path.map((node, i) => {
            const tag = nodeTag(node, i, i === path.length - 1, goalReached)
            return (
              <li key={node.sequence}>
                <button
                  type="button"
                  className="flow-node"
                  aria-pressed={i === index}
                  data-back={node.enteredBy === 'GO_BACK' ? 'true' : undefined}
                  data-goal={i === path.length - 1 && goalReached ? 'true' : undefined}
                  onClick={() => onSelect(i)}
                >
                  <span className="flow-node-head">
                    <span className="num">{node.sequence}.</span>
                    {tag ? <span className="flow-node-tag">{tag}</span> : null}
                  </span>
                  <strong>{labelPage(node.pageKey)}</strong>
                  <span className="mono">{node.path}</span>
                </button>
                {i < path.length - 1 ? (
                  <span
                    className="flow-edge"
                    data-back={path[i + 1].enteredBy === 'GO_BACK' ? 'true' : undefined}
                    aria-hidden="true"
                  >
                    {edgeLabel(path[i + 1], steps)}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="card" aria-label="단계별 탐색 상세">
        <SectionTitle
          icon={<ColumnsIcon />}
          title="단계별 탐색 상세"
          aside={`선택된 노드: ${labelPage(visit.pageKey)} (${visit.path})`}
        />
        {visit.enteredBy === 'GO_BACK' && visit.visitCause === 'MODEL_BACK' ? (
          <p>이전 화면 복귀: 모델이 GO_BACK을 선택해 돌아온 화면입니다.</p>
        ) : null}
        {visit.visitCause === 'SYSTEM_BACK_RECOVERY' ? (
          <p>시스템이 이전 화면으로 복구한 화면입니다.</p>
        ) : null}

        {stepId === null && isLast && terminationReason === 'GOAL_VERIFIED' ? (
          // 도착 화면은 Step이 없어 후보 좌표가 없다. bbox를 그리지 않고, 404·로드 실패면 기존 문구를 보인다
          <ScreenshotViewer
            src={goalScreenshotUrl(runId)}
            alt={`${visit.pageKey} 도착 화면`}
            viewport={viewport}
            boxes={[]}
            runInProgress={false}
            missingText="도착 화면 이미지 없음"
          />
        ) : stepId === null ? (
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
                ? stepsRetrying
                  ? '연결 재시도 중'
                  : 'Step 정보를 불러오는 중'
                : `Step ${stepId} 정보를 찾을 수 없습니다`}
            {stepsFailed ? (
              <>
                {' '}
                <button type="button" onClick={onRetrySteps}>
                  다시 시도
                </button>
              </>
            ) : null}
          </p>
        ) : (
          <div className="step-layout step-layout-flat">
            <div>
              <div className="browser-bar">
                <span className="browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="browser-url mono">
                  {step.page.path} · {step.page.title}
                </span>
                <span className="browser-tag num">
                  화면 캡처 #{step.stepId} · {step.page.viewport.width} × {step.page.viewport.height}
                </span>
              </div>
              <ScreenshotViewer
                src={screenshotUrl(runId, step.stepId)}
                alt={`${visit.pageKey} 화면 (Step ${step.stepId})`}
                viewport={step.page.viewport}
                screenshotSize={step.page.screenshotSize}
                scroll={step.page.scroll}
                boxes={step.candidates.map((candidate, i) => ({
                  id: candidate.optionId,
                  bbox: candidate.bbox,
                  label: candidate.label,
                  tag: i + 1,
                  highlighted: candidate.selected,
                }))}
                runInProgress={false}
              />
            </div>
            <div className="decision-col">
              <h3>Step {step.stepId} 의사결정</h3>
              <SelectedAction step={step} />
              <h3 className="list-title">후보별 선택 확률</h3>
              <CandidateProbabilityList
                candidates={step.candidates}
                decision={step.decision}
              />
              <StepMetricsPanel
                key={step.stepId}
                decision={step.decision}
                basis={basis}
              />
            </div>
          </div>
        )}
      </section>
    </>
  )
}
