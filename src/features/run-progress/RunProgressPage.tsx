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
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { ColumnsIcon, HistoryIcon, SettingsIcon } from '../../shared/icons.tsx'
import { RunGauge } from '../../shared/RunGauge.tsx'
import { SelectedAction } from '../../shared/SelectedAction.tsx'
import { selectedLabel, stepTime } from '../../shared/stepLabel.ts'
import { StepMetricsPanel } from '../run-result/StepMetricsPanel.tsx'
import { VERSIONS } from '../new-analysis/constants.ts'
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
  const version = VERSIONS.find((item) => item.variant === run.variant)

  return (
    <section className="run-progress">
      <section className="card run-head" aria-label="실행 정보">
        <div className="run-head-top">
          <div className="page-title-row">
            <h1>AI 탐색 진행</h1>
            <span role="status" className="run-status" data-status={run.status}>
              {statusLabel(run)}
            </span>
            <ResultOriginBadge origin={run.resultOrigin} />
            <ReplayNotice experimentKey={run.experimentKey} origins={[run.resultOrigin]} />
          </div>
          {terminal ? (
            <Link className="run-result-link" to={`/runs/${encodeURIComponent(run.runId)}/result`}>
              분석 결과 보기
            </Link>
          ) : (
            <button type="button" disabled title="탐색이 끝나면 활성화됩니다">
              분석 결과 보기
            </button>
          )}
        </div>
        <dl className="meta-row">
          <div>
            <dt>실행 ID</dt>
            <dd>
              <span className="run-id">{run.runId}</span>
            </dd>
          </div>
          <div>
            <dt>버전</dt>
            <dd>{version ? `${version.name} · ${version.change}` : run.variant}</dd>
          </div>
          <div>
            <dt>진행 단계</dt>
            <dd className="num">
              Step {run.progress.stepCount} / {run.progress.maxSteps}단계
            </dd>
          </div>
          <div>
            <dt>현재 화면</dt>
            <dd>
              <span className="mono">{run.progress.currentPageKey ?? '-'}</span>
            </dd>
          </div>
          <div className="meta-goal">
            <dt>탐색 목표</dt>
            <dd>{run.goal}</dd>
          </div>
        </dl>
        <RunGauge
          stepCount={run.progress.stepCount}
          maxSteps={run.progress.maxSteps}
          terminal={terminal}
          status={run.status}
        />
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
      </section>

      <StepViewer run={run} steps={steps} terminal={terminal} />
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
      <section className="card" aria-label="탐색 화면">
        <SectionTitle icon={<ColumnsIcon />} title="탐색 화면" />
        <p role="status">{terminal ? '단계 기록 없음' : '첫 단계 준비 중'}</p>
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
            기록 열람 중 (Step {viewed.stepId}) 입니다. 실시간 화면이 아닙니다.
          </span>
          <button type="button" onClick={() => setPinnedId(null)}>
            최신 단계로 이동
          </button>
        </p>
      ) : null}

      <div className="step-layout">
        <section className="card" aria-label="탐색 화면">
          <SectionTitle
            icon={<ColumnsIcon />}
            title="탐색 화면"
            aside="기록된 화면과 AI의 선택 결과"
            action={
              <nav className="step-tabs" aria-label="단계 선택">
                {steps.map((step) => (
                  <button
                    key={step.stepId}
                    type="button"
                    aria-pressed={step.stepId === viewed.stepId}
                    onClick={() => select(step)}
                  >
                    Step {step.stepId}
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
              {viewed.page.path} · {viewed.page.title}
            </span>
            <span className="browser-tag num">
              화면 캡처 #{viewed.stepId} · {viewed.page.viewport.width} × {viewed.page.viewport.height}
            </span>
          </div>
          <ScreenshotViewer
            src={screenshotUrl(run.runId, viewed.stepId)}
            alt={`Step ${viewed.stepId} 스크린샷`}
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

        <section className="card" aria-label="AI 선택 결과">
          <SectionTitle
            icon={<SettingsIcon />}
            title="AI 선택 결과"
            action={<span className="step-chip">Step {viewed.stepId}</span>}
          />
          <SelectedAction step={viewed} />
          <h3 className="list-title">후보별 선택 확률</h3>
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

      <section className="card" aria-label="탐색 기록">
        <SectionTitle
          icon={<HistoryIcon />}
          title="탐색 기록"
          aside={`최대 ${run.maxSteps}단계 · 카드를 누르면 그 시점의 화면을 볼 수 있습니다`}
        />
        <div className="history-grid">
          {steps.map((step) => (
            <button
              key={step.stepId}
              type="button"
              className="history-card"
              aria-pressed={step.stepId === viewed.stepId}
              aria-label={`기록 STEP ${String(step.stepId).padStart(2, '0')}`}
              onClick={() => select(step)}
            >
              <span className="history-card-head">
                <span>STEP {String(step.stepId).padStart(2, '0')}</span>
                <span className="num">{stepTime(step.timestamp)}</span>
              </span>
              <span className="history-card-body">
                <span className="history-from">{step.page.title}</span>
                <span className="history-action">
                  {step.decision.selectedActionType} [{selectedLabel(step)}]
                </span>
              </span>
              <span className="history-card-foot">
                {step.action.executed
                  ? step.decision.selectedActionType === 'GO_BACK'
                    ? '뒤로 가기 완료'
                    : '이동 완료'
                  : '실행하지 못함'}
              </span>
            </button>
          ))}
          {waiting ? (
            <div className="history-card history-card-waiting">
              <span className="history-card-head">
                <span>
                  STEP {String(steps.length + 1).padStart(2, '0')}
                  {run.maxSteps > steps.length + 1 ? ` ~ ${String(run.maxSteps).padStart(2, '0')}` : ''}
                </span>
                <span>상한 {run.maxSteps}단계</span>
              </span>
              <span className="history-card-body">
                <span className="history-from">추가 탐색 대기</span>
                <span className="history-action">최대 단계에 도달하면 자동으로 종료됩니다</span>
              </span>
              <span className="history-card-foot">대기 중</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
