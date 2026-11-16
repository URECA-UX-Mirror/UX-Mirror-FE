import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { screenshotUrl } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Run, Step } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { statusLabel } from './statusLabel.ts'
import { useRunProgress } from './useRunProgress.ts'

export function RunProgressPage() {
  const { runId } = useParams()
  if (!runId) return null
  // runId가 바뀌면 열람 중인 단계 같은 화면 상태를 초기화한다.
  return <RunProgress key={runId} runId={runId} />
}

function RunProgress({ runId }: { runId: string }) {
  const polling = useRunProgress(runId)
  const snapshot = polling.data

  if (!snapshot) {
    if (polling.status === 'failed') {
      if (isApiError(polling.error) && polling.error.status === 404) {
        return <RunNotFound />
      }
      return (
        <section>
          <h1>AI 탐색 진행</h1>
          <ErrorNotice error={polling.error} onRetry={polling.retry} />
        </section>
      )
    }
    return (
      <section>
        <h1>AI 탐색 진행</h1>
        <p role="status">
          {polling.retrying ? '연결 재시도 중' : '실행 정보를 불러오는 중'}
        </p>
      </section>
    )
  }

  const { run, steps } = snapshot
  const terminal = isTerminalStatus(run.status)

  return (
    <section className="run-progress">
      <header className="run-progress-header">
        <h1>AI 탐색 진행</h1>
        <ResultOriginBadge origin={run.resultOrigin} />
      </header>
      <ReplayNotice experimentKey={run.experimentKey} />
      <p>
        <span className="run-id">{run.runId}</span> · {run.goal}
      </p>
      <p role="status" className="run-status" data-status={run.status}>
        {statusLabel(run)}
      </p>
      {polling.status === 'failed' ? (
        <ErrorNotice error={polling.error} onRetry={polling.retry} />
      ) : polling.retrying ? (
        <p role="status">연결 재시도 중</p>
      ) : null}
      {snapshot.stepsError === null ? null : polling.status === 'done' ? (
        // 종료 뒤에도 `/steps`를 받지 못했다. Run 상태는 그대로 두고 단계 기록만 다시 조회한다.
        <div role="alert" className="error-notice">
          <p>단계 기록을 불러오지 못했습니다</p>
          <button type="button" onClick={polling.retry}>
            다시 시도
          </button>
        </div>
      ) : (
        <p role="status">단계 기록 재시도 중</p>
      )}

      <ProgressCells run={run} steps={steps} terminal={terminal} />
      <StepViewer run={run} steps={steps} terminal={terminal} />

      {terminal ? (
        <Link className="run-result-link" to={`/runs/${encodeURIComponent(run.runId)}/result`}>
          분석 결과 보기
        </Link>
      ) : (
        <button type="button" disabled>
          분석 결과 보기
        </button>
      )}
    </section>
  )
}

function RunNotFound() {
  return (
    <section>
      <h1>AI 탐색 진행</h1>
      <p role="alert">실행을 찾을 수 없음</p>
      <Link to="/">새 분석</Link>
    </section>
  )
}

/**
 * `maxSteps` 칸 중 서버에 저장된 단계만 채우고 나머지는 대기 칸이다.
 * 종료된 Run은 더 실행될 단계가 없으므로 대기 칸을 만들지 않는다.
 */
function ProgressCells({
  run,
  steps,
  terminal,
}: {
  run: Run
  steps: Step[]
  terminal: boolean
}) {
  const total = terminal ? steps.length : Math.max(run.maxSteps, steps.length)
  return (
    <div>
      <p>
        진행 {run.progress.stepCount} / {run.progress.maxSteps}
        {run.progress.currentPageKey === null
          ? null
          : ` · 현재 화면 ${run.progress.currentPageKey}`}
      </p>
      <ol className="progress-cells" aria-label="탐색 단계">
        {Array.from({ length: total }, (_, index) => {
          const step = steps[index]
          return (
            <li
              key={index}
              className={step ? 'progress-cell-done' : 'progress-cell-waiting'}
            >
              {step ? `Step ${step.stepId}` : '대기'}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepViewer({
  run,
  steps,
  terminal,
}: {
  run: Run
  steps: Step[]
  terminal: boolean
}) {
  // `null`이면 최신 단계를 따라간다. 최신이 아닌 단계를 직접 고르면 그 단계에 머문다.
  const [pinnedId, setPinnedId] = useState<number | null>(null)

  if (steps.length === 0) {
    return <p role="status">{terminal ? '단계 기록 없음' : '첫 단계 준비 중'}</p>
  }

  const latest = steps[steps.length - 1]
  const viewed = steps.find((step) => step.stepId === pinnedId) ?? latest
  const browsingHistory = viewed.stepId !== latest.stepId

  return (
    <div className="step-viewer">
      <nav aria-label="단계 선택">
        {steps.map((step) => (
          <button
            key={step.stepId}
            type="button"
            aria-pressed={step.stepId === viewed.stepId}
            onClick={() =>
              setPinnedId(step.stepId === latest.stepId ? null : step.stepId)
            }
          >
            Step {step.stepId}
          </button>
        ))}
      </nav>
      {browsingHistory ? (
        <p role="status">
          기록 열람 중{' '}
          <button type="button" onClick={() => setPinnedId(null)}>
            최신 단계로 이동
          </button>
        </p>
      ) : null}
      <p>
        {viewed.page.title} ({viewed.page.path})
      </p>
      <ScreenshotViewer
        src={screenshotUrl(run.runId, viewed.stepId)}
        alt={`Step ${viewed.stepId} 스크린샷`}
        viewport={viewed.page.viewport}
        screenshotSize={viewed.page.screenshotSize}
        scroll={viewed.page.scroll}
        boxes={viewed.candidates.map((candidate) => ({
          id: candidate.optionId,
          bbox: candidate.bbox,
          label: candidate.label,
          probability: candidate.probability,
          highlighted: candidate.selected,
        }))}
        runInProgress={!terminal}
        retryKey={run.progress.lastUpdatedAt ?? undefined}
      />
      <CandidateProbabilityList
        candidates={viewed.candidates}
        decision={viewed.decision}
      />
    </div>
  )
}
