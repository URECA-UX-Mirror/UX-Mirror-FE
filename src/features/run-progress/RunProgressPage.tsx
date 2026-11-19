import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { screenshotUrl } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { isScenarioRun, pageLabel } from '../../domain/site.ts'
import type { Run, Step } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { ColumnsIcon, HistoryIcon, SettingsIcon } from '../../shared/icons.tsx'
import { RunGauge } from '../../shared/RunGauge.tsx'
import { SelectedAction } from '../../shared/SelectedAction.tsx'
import { selectedLabel, stepTime } from '../../shared/stepLabel.ts'
import { useRunSite } from '../../shared/useRunSite.ts'
import { StepMetricsPanel } from '../run-result/StepMetricsPanel.tsx'
import { versionName } from '../new-analysis/constants.ts'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { improvementRunText } from '../../shared/improvementRun.ts'
import { OptimizerRunTag } from '../../shared/OptimizerRunTag.tsx'
import { statusLabel } from './statusLabel.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
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
  const site = useRunSite(snapshot?.run)

  if (!snapshot) {
    if (polling.status === 'failed') {
      if (isApiError(polling.error) && polling.error.status === 404) {
        return <RunNotFound />
      }
      return (
        <section>
          <h1>{PAGE_NAMES.progress}</h1>
          <ErrorNotice error={polling.error} onRetry={polling.retry} />
        </section>
      )
    }
    return (
      <section>
        <h1>{PAGE_NAMES.progress}</h1>
        <p role="status">
          {polling.retrying ? '다시 연결하는 중이에요' : '진단 정보를 불러오는 중이에요'}
        </p>
      </section>
    )
  }

  const { run, steps } = snapshot
  const terminal = isTerminalStatus(run.status)

  return (
    <section className="run-progress">
      <section className="card run-head" aria-label="진단 정보">
        <div className="run-head-top">
          <div className="page-title-row">
            <h1>{terminal ? '진단이 끝났어요' : PAGE_NAMES.progress}</h1>
            <span role="status" className="run-status" data-status={run.status}>
              {statusLabel(run)}
            </span>
            <ReplayNotice experimentKey={run.experimentKey} origins={[run.resultOrigin]} />
          </div>
          {terminal ? (
            <Link className="run-result-link" to={`/runs/${encodeURIComponent(run.runId)}/result`}>
              {PAGE_NAMES.result} 보기
            </Link>
          ) : (
            <span className="muted">끝나면 결과를 볼 수 있어요 (보통 1~2분)</span>
          )}
        </div>
        <dl className="meta-row">
          <div>
            <dt>사이트</dt>
            <dd>{isScenarioRun(run) ? site?.name ?? '등록된 사이트' : versionName(run.variant, !!(run.optimizationContext || run.improvementContext))}</dd>
          </div>
          {run.improvementContext ? (
            <div>
              <dt>AI 개선</dt>
              <dd>{improvementRunText(run.improvementContext)}</dd>
            </div>
          ) : null}
          {run.optimizationContext ? (
            <div>
              <dt>{PAGE_NAMES.optimizer}</dt>
              <dd>
                <OptimizerRunTag context={run.optimizationContext} />
              </dd>
            </div>
          ) : null}
          <div>
            <dt>클릭 수</dt>
            <dd className="num">
              {run.progress.stepCount}번 / 최대 {run.progress.maxSteps}번
            </dd>
          </div>
          <div>
            <dt>현재 화면</dt>
            <dd>
              {run.progress.currentPageKey ? pageLabel(site, run.progress.currentPageKey) : '-'}
            </dd>
          </div>
          <div className="meta-goal">
            <dt>하려는 일</dt>
            <dd>{run.persona ? `${run.persona} 고객이 ` : ''}{run.goal}</dd>
          </div>
        </dl>
        {run.validity === 'INVALID' ? <p role="alert">이 진단은 결과로 쓸 수 없어요. 다시 시작해 주세요.</p> : null}
        {run.error ? <p role="alert">진단 중 문제가 생겼어요. 다시 시작해 주세요.</p> : null}
        <RunGauge
          stepCount={run.progress.stepCount}
          maxSteps={run.progress.maxSteps}
          terminal={terminal}
          status={run.status}
        />
        {polling.status === 'failed' ? (
          <ErrorNotice error={polling.error} onRetry={polling.retry} />
        ) : polling.retrying ? (
          <p role="status">다시 연결하는 중이에요</p>
        ) : null}
        {snapshot.stepsError === null ? null : polling.status === 'done' ? (
          // 종료 뒤에도 `/steps`를 받지 못했다. Run 상태는 그대로 두고 단계 기록만 다시 조회한다.
          <div role="alert" className="error-notice">
            <p>클릭 기록을 불러오지 못했어요</p>
            <button type="button" onClick={polling.retry}>
              다시 시도
            </button>
          </div>
        ) : (
          <p role="status">클릭 기록을 다시 불러오는 중이에요</p>
        )}
      </section>

      <StepViewer run={run} steps={steps} terminal={terminal} />
    </section>
  )
}

function RunNotFound() {
  return (
    <section>
      <h1>{PAGE_NAMES.progress}</h1>
      <p role="alert">이 진단을 찾을 수 없어요.</p>
      <Link to="/">새 진단</Link>
    </section>
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
    return (
      <section className="card" aria-label="고객이 본 화면">
        <SectionTitle icon={<ColumnsIcon />} title="고객이 본 화면" />
        <p role="status">{terminal ? '클릭 기록이 없어요' : 'AI 고객이 첫 화면을 보고 있어요'}</p>
      </section>
    )
  }

  const latest = steps[steps.length - 1]
  const viewed = steps.find((step) => step.stepId === pinnedId) ?? latest
  const browsingHistory = viewed.stepId !== latest.stepId
  const select = (step: Step) =>
    setPinnedId(step.stepId === latest.stepId ? null : step.stepId)
  const waiting = !terminal && steps.length < run.maxSteps

  return (
    <>
      {browsingHistory ? (
        <p role="status" className="history-banner">
          <span>
            {viewed.stepId}번째 클릭 화면을 보는 중이에요 (지금 화면 아님)
          </span>
          <button type="button" onClick={() => setPinnedId(null)}>
            지금 화면 보기
          </button>
        </p>
      ) : null}

      <div className="step-layout">
        <section className="card" aria-label="고객이 본 화면">
          <SectionTitle
            icon={<ColumnsIcon />}
            title="고객이 본 화면"
            aside="AI 고객이 본 화면과 누른 곳"
            action={
              <nav className="step-tabs" aria-label="클릭 선택">
                {steps.map((step) => (
                  <button
                    key={step.stepId}
                    type="button"
                    aria-pressed={step.stepId === viewed.stepId}
                    onClick={() => select(step)}
                  >
                    {step.stepId}번째
                  </button>
                ))}
              </nav>
            }
          />
          <div className="browser-bar">
            <span className="browser-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="browser-url mono">
              {viewed.page.title}
            </span>
            <span className="browser-tag num">
              {viewed.stepId}번째 클릭 전 화면
            </span>
          </div>
          <ScreenshotViewer
            src={screenshotUrl(run.runId, viewed.stepId)}
            alt={`${viewed.stepId}번째 클릭 전 화면`}
            viewport={viewed.page.viewport}
            screenshotSize={viewed.page.screenshotSize}
            scroll={viewed.page.scroll}
            boxes={viewed.candidates.map((candidate, index) => ({
              id: candidate.optionId,
              bbox: candidate.bbox,
              label: candidate.label,
              tag: index + 1,
              highlighted: candidate.selected,
            }))}
            runInProgress={!terminal}
            retryKey={run.progress.lastUpdatedAt ?? undefined}
          />
        </section>

        <section className="card" aria-label="고객이 누른 곳">
          <SectionTitle
            icon={<SettingsIcon />}
            title="고객이 누른 곳"
            action={<span className="step-chip">{viewed.stepId}번째</span>}
          />
          <SelectedAction step={viewed} />
          <h3 className="list-title">버튼별로 누를 가능성</h3>
          <CandidateProbabilityList
            candidates={viewed.candidates}
            decision={viewed.decision}
          />
          <StepMetricsPanel
            key={viewed.stepId}
            decision={viewed.decision}
            basis={run.referenceBasis}
          />
        </section>
      </div>

      <section className="card" aria-label="클릭 기록">
        <SectionTitle
          icon={<HistoryIcon />}
          title="클릭 기록"
          aside={`최대 ${run.maxSteps}번 · 누르면 그때 화면을 볼 수 있어요`}
        />
        <div className="history-grid">
          {steps.map((step) => (
            <button
              key={step.stepId}
              type="button"
              className="history-card"
              aria-pressed={step.stepId === viewed.stepId}
              aria-label={`${step.stepId}번째 클릭`}
              onClick={() => select(step)}
            >
              <span className="history-card-head">
                <span>{step.stepId}번째</span>
                <span className="num">{stepTime(step.timestamp)}</span>
              </span>
              <span className="history-card-body">
                <span className="history-from">{step.page.title}</span>
                <span className="history-action">
                  {step.decision.selectedActionType === 'GO_BACK' ? '뒤로 가기' : `'${selectedLabel(step)}' 누름`}
                </span>
              </span>
              <span className="history-card-foot">
                {step.action.executed
                  ? step.decision.selectedActionType === 'GO_BACK'
                    ? '뒤로 감'
                    : '이동함'
                  : '누르지 못함'}
              </span>
            </button>
          ))}
          {waiting ? (
            <div className="history-card history-card-waiting">
              <span className="history-card-head">
                <span>{steps.length + 1}번째</span>
                <span>최대 {run.maxSteps}번</span>
              </span>
              <span className="history-card-body">
                <span className="history-from">다음 화면을 보는 중</span>
                <span className="history-action">목표 화면에 도착하거나 클릭 수를 다 쓰면 끝나요</span>
              </span>
              <span className="history-card-foot">진행 중</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
