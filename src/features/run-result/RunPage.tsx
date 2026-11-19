import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { getRunIssues, goalScreenshotUrl, screenshotUrl } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { isScenarioRun } from '../../domain/site.ts'
import type { Issue, Run, Site, Step } from '../../domain/types.ts'
import { GOAL_SCREENS } from '../../shared/customerInput.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { issueTypeLabel } from '../../shared/runLabels.ts'
import { selectedLabel } from '../../shared/stepLabel.ts'
import { useRunSite } from '../../shared/useRunSite.ts'
import { VERSIONS } from '../new-analysis/constants.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { useRunProgress } from '../run-progress/useRunProgress.ts'
import { DiagnosisCard } from './DiagnosisCard.tsx'
import './run.css'

/** 끝난 뒤에도 분석이 `PENDING`이면 살펴볼 점만 최대 5번 다시 불러온다(`docs/contracts/run-lifecycle.md`). */
const ISSUE_MAX_REFETCHES = 5

/** MORO MARKET 화면 이름. 사이트 정보가 없는 진단은 이 표로 이름을 붙인다 */
const SHOP_PAGES: Record<string, string> = {
  home: '홈',
  ...Object.fromEntries(GOAL_SCREENS.map((s) => [s.pageKey, s.label])),
}

/**
 * 진단 화면 하나. 진행 중에는 지금 화면과 클릭 기록을, 끝나면 같은 자리에서 결과를 보인다.
 * `/runs/:runId`, `/runs/:runId/result` 둘 다 이 화면이다.
 */
export function RunPage() {
  const { runId } = useParams()
  if (!runId) return null
  // 다른 진단으로 가면 펼침 같은 화면 상태를 새로 시작한다.
  return <RunView key={runId} runId={runId} />
}

function RunView({ runId }: { runId: string }) {
  const polling = useRunProgress(runId)
  const snapshot = polling.data
  const site = useRunSite(snapshot?.run)

  if (!snapshot) {
    if (polling.status === 'failed') {
      if (isApiError(polling.error) && polling.error.status === 404) {
        return (
          <section className="run-page">
            <h1>진단</h1>
            <p role="alert">진단을 찾을 수 없어요</p>
            <Link to="/">새로 진단하기</Link>
          </section>
        )
      }
      return (
        <section className="run-page">
          <h1>진단</h1>
          <LoadFailed onRetry={polling.retry} />
        </section>
      )
    }
    return (
      <section className="run-page">
        <h1>진단</h1>
        <p role="status">{polling.retrying ? '다시 연결하는 중이에요' : '불러오는 중이에요'}</p>
      </section>
    )
  }

  const { run, steps } = snapshot
  const done = isTerminalStatus(run.status)
  const pageName = (pageKey: string) => pageNameOf(pageKey, site, steps)

  return (
    <section className="run-page">
      <header className="run-page-head">
        <div className="run-page-title">
          <h1>진단</h1>
          {/* 서버 오류 원문은 보이지 않는다 */}
          <span role="status" className="run-status" data-status={run.status}>
            {statusLabel({ status: run.status, error: null })}
          </span>
        </div>
        <p className="run-page-who">{customerText(run.persona)} · {run.goal}</p>
        <p className="muted">{whereText(run, site)}</p>
      </header>

      {polling.status === 'failed' ? (
        <LoadFailed onRetry={polling.retry} />
      ) : polling.retrying ? (
        <p role="status" className="muted">다시 연결하는 중이에요</p>
      ) : null}
      {snapshot.stepsError === null ? null : polling.status === 'done' ? (
        <div role="alert" className="error-notice">
          <p>클릭 기록을 불러오지 못했어요</p>
          <button type="button" onClick={polling.retry}>다시 시도</button>
        </div>
      ) : (
        <p role="status" className="muted">클릭 기록을 다시 불러오는 중이에요</p>
      )}

      {done ? (
        <Finished run={run} steps={steps} pageName={pageName} />
      ) : (
        <Live run={run} steps={steps} />
      )}
    </section>
  )
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="error-notice">
      <p>불러오지 못했어요</p>
      <button type="button" onClick={onRetry}>다시 시도</button>
    </div>
  )
}

/** 진행 중: 지금 화면 한 장과 지금까지 누른 곳 */
function Live({ run, steps }: { run: Run; steps: Step[] }) {
  const latest = steps.at(-1)
  const clicking = Math.min(Math.max(run.progress.stepCount, steps.length) + 1, run.maxSteps)
  return (
    <section className="card run-live" aria-label="지금 진단 중">
      <p className="run-live-progress">
        {latest ? `${clicking}번째 클릭 중 · 최대 ${run.maxSteps}번` : `첫 화면을 보고 있어요 · 최대 ${run.maxSteps}번`}
      </p>
      {latest ? (
        <ScreenshotViewer
          src={screenshotUrl(run.runId, latest.stepId)}
          alt={`${latest.stepId}번째 클릭 전 화면`}
          viewport={latest.page.viewport}
          screenshotSize={latest.page.screenshotSize}
          scroll={latest.page.scroll}
          boxes={boxesOf(latest)}
          runInProgress
          retryKey={run.progress.lastUpdatedAt ?? undefined}
        />
      ) : null}
      {steps.length ? (
        <ol className="run-clicks" aria-label="지금까지 누른 곳">
          {steps.map((step) => (
            <li key={step.stepId}>{clickText(step)}</li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/** 끝남: 결론 → 지나간 길 → (접힘) 클릭별 자세히 → (접힘, 있을 때만) 살펴볼 점 */
function Finished({ run, steps, pageName }: {
  run: Run
  steps: Step[]
  pageName: (pageKey: string) => string
}) {
  const issues = usePolling({
    fetch: (signal) => getRunIssues(run.runId, signal),
    isDone: (data) => data.analysisStatus !== 'PENDING',
    resetKey: run.runId,
    maxRefetches: ISSUE_MAX_REFETCHES,
  })
  const items = issues.data?.analysisStatus === 'COMPLETED' ? issues.data.items : []
  const path = run.summary?.path ?? []
  const reached = run.summary?.goalReached === true

  return (
    <>
      <DiagnosisCard run={run} steps={steps.length ? steps : null} />

      <section className="card run-path" aria-label="지나간 길">
        <h2>지나간 길</h2>
        {path.length ? (
          <ol>
            {path.map((visit, i) => (
              <li key={visit.sequence}>
                <span className="run-path-node" data-back={visit.enteredBy === 'GO_BACK' ? 'true' : undefined}
                  data-goal={reached && i === path.length - 1 ? 'true' : undefined}>
                  {pageName(visit.pageKey)}
                  {visit.enteredBy === 'GO_BACK' ? <span className="run-path-note">돌아옴</span> : null}
                  {reached && i === path.length - 1 ? <span className="run-path-note">도착</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">지나간 길 기록이 없어요</p>
        )}
      </section>

      {steps.length ? (
        <Collapsible title="클릭별로 자세히 보기" className="run-detail">
          <ol className="run-steps">
            {steps.map((step) => (
              <li key={step.stepId} aria-label={`${step.stepId}번째 클릭`}>
                <h3>{step.stepId}. {pageName(step.page.pageKey)}에서 {clickText(step, false)}</h3>
                <ScreenshotViewer
                  src={screenshotUrl(run.runId, step.stepId)}
                  alt={`${step.stepId}번째 클릭 전 화면`}
                  viewport={step.page.viewport}
                  screenshotSize={step.page.screenshotSize}
                  scroll={step.page.scroll}
                  boxes={boxesOf(step)}
                  runInProgress={false}
                />
                <p className="muted">버튼마다 이 고객이 누를 가능성이에요</p>
                <CandidateProbabilityList candidates={step.candidates} decision={step.decision} />
              </li>
            ))}
            {run.terminationReason === 'GOAL_VERIFIED' ? (
              <li aria-label="도착한 화면">
                <h3>도착한 화면</h3>
                <ScreenshotViewer
                  src={goalScreenshotUrl(run.runId)}
                  alt="도착한 화면"
                  viewport={run.viewport}
                  boxes={[]}
                  runInProgress={false}
                  missingText="도착한 화면 이미지가 없어요"
                />
              </li>
            ) : null}
          </ol>
        </Collapsible>
      ) : null}

      {items.length ? (
        <Collapsible title={`살펴볼 점 ${items.length}개`} className="run-issues">
          <ul>
            {items.map((issue) => (
              <IssueItem key={issue.issueId} issue={issue} />
            ))}
          </ul>
          <p className="muted">AI 고객의 클릭 기록에서 찾은 단서예요. 실제 문제인지는 직접 확인해 주세요.</p>
        </Collapsible>
      ) : null}
    </>
  )
}

function IssueItem({ issue }: { issue: Issue }) {
  return (
    <li>
      <strong>{issue.title}</strong>
      {issue.reviewPriority === 'PRIORITY_REVIEW' ? <span className="run-issue-tag">먼저 보기</span> : null}
      <p>{issue.description}</p>
      <p className="muted">
        {issueTypeLabel(issue.issueType)}
        {issue.relatedStepIds.length ? ` · ${issue.relatedStepIds.map((id) => `${id}번째`).join(', ')} 클릭` : ''}
      </p>
    </li>
  )
}

/** 접힌 상자. 펼치기 전에는 안을 그리지 않아 스크린샷을 미리 받지 않는다 */
function Collapsible({ title, className, children }: {
  title: string
  className: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <details className={`card run-collapsible ${className}`} open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open ? children : null}
    </details>
  )
}

function boxesOf(step: Step) {
  return step.candidates.map((candidate, index) => ({
    id: candidate.optionId,
    bbox: candidate.bbox,
    label: candidate.label,
    tag: index + 1,
    highlighted: candidate.selected,
  }))
}

/** "1. '주문조회' 누름" (번호 없이도 쓴다) */
function clickText(step: Step, numbered = true): string {
  const head = numbered ? `${step.stepId}. ` : ''
  if (step.decision.selectedActionType === 'GO_BACK') return `${head}이전 화면으로 돌아감`
  const label = `'${selectedLabel(step)}'`
  return step.action.executed ? `${head}${label} 누름` : `${head}${label} 누르려 했지만 안 됨`
}

/** "방문자" → 그대로, "20대 직장인" → "20대 직장인 고객" */
function customerText(persona: string): string {
  return /(고객|사용자|자)$/.test(persona.trim()) ? persona : `${persona} 고객`
}

/** 어느 화면을 진단했는지 */
function whereText(run: Run, site: Site | undefined): string {
  if (isScenarioRun(run)) return `${site?.name ?? '다른 사이트'} 진단`
  const context = run.improvementContext ?? run.optimizationContext
  if (context) return `메뉴 이름을 '${context.label}'${withRo(context.label)} 바꿔 본 화면`
  const version = VERSIONS.find((v) => v.variant === run.variant)
  return `MORO MARKET ${version?.name ?? '화면'}`
}

/** 화면 이름. 사이트 정보 → MORO MARKET 표 → 그 화면의 제목 순으로 찾고, 코드값은 보이지 않는다 */
function pageNameOf(pageKey: string, site: Site | undefined, steps: Step[]): string {
  return (
    site?.pages.find((page) => page.pageKey === pageKey)?.label ??
    (isShopKey(pageKey) ? SHOP_PAGES[pageKey] : undefined) ??
    steps.find((step) => step.page.pageKey === pageKey)?.page.title ??
    '다른 화면'
  )
}

/** '로'/'으로'. 받침이 있으면(ㄹ 받침 제외) '으로' */
function withRo(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00
  if (code < 0 || code > 11171) return '로'
  const final = code % 28
  return final === 0 || final === 8 ? '로' : '으로'
}

const isShopKey = (key: string) => Object.hasOwn(SHOP_PAGES, key)
