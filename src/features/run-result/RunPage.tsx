import { Link, useParams } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { getRunIssues, goalScreenshotUrl, screenshotUrl } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { isScenarioRun } from '../../domain/site.ts'
import type { Issue, Run, Site, Step } from '../../domain/types.ts'
import { GOAL_SCREENS } from '../../shared/customerInput.ts'
import { quote, roOf } from '../../shared/hangul.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'
import { issueTypeLabel, stopReasonLabel } from '../../shared/runLabels.ts'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { selectedLabel } from '../../shared/stepLabel.ts'
import { Disclosure, Timeline, TimelineStep } from '../../shared/Timeline.tsx'
import { useRunSite } from '../../shared/useRunSite.ts'
import { FIX_QUESTION, GAIN_QUESTION, ImprovementSteps } from '../improvement/ImprovementSteps.tsx'
import { useRunImprovement } from '../improvement/useRunImprovement.ts'
import { useRunProgress } from '../run-progress/useRunProgress.ts'
import { EDITABLE_KEY, explainRun, type Why } from './why.ts'
import './run.css'

/** 끝난 뒤에도 분석이 `PENDING`이면 살펴볼 점만 최대 5번 다시 불러온다(`docs/contracts/run-lifecycle.md`). */
const ISSUE_MAX_REFETCHES = 5

const FIND_QUESTION = '잘 찾아가나요?'
const WHY_QUESTION = '왜 그랬을까요?'
const BAR_COUNT = 4

/** MORO MARKET 화면 이름. 사이트 정보가 없는 진단은 이 표로 이름을 붙인다 */
const SHOP_PAGES: Record<string, string> = {
  home: '홈',
  ...Object.fromEntries(GOAL_SCREENS.map((s) => [s.pageKey, s.label])),
}

/**
 * 결과 화면 하나. 번호가 붙은 단계가 위에서 아래로 차례로 채워진다:
 * 잘 찾아가나요? → 왜 그랬을까요? → 어떻게 바꾸면 좋을까요? → 바꾸면 얼마나 좋아질까요?
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
    const notFound = polling.status === 'failed' && isApiError(polling.error) && polling.error.status === 404
    return (
      <section className="report-page">
        <header className="report-head"><h1>진단</h1></header>
        {notFound ? (
          <>
            <p role="alert">진단을 찾을 수 없어요</p>
            <Link to="/">새 진단 하러 가기</Link>
          </>
        ) : polling.status === 'failed' ? (
          <LoadFailed onRetry={polling.retry} />
        ) : (
          <p role="status">{polling.retrying ? '다시 연결하는 중이에요' : '불러오는 중이에요'}</p>
        )}
      </section>
    )
  }

  const { run, steps } = snapshot
  const done = isTerminalStatus(run.status)
  const improvable = canImprove(run)

  return (
    <section className="report-page">
      <header className="report-head">
        <p className="report-eyebrow">{whereText(run, site)}</p>
        <h1>{run.goal}</h1>
      </header>

      {polling.status === 'failed' ? (
        <LoadFailed onRetry={polling.retry} />
      ) : polling.retrying ? (
        <p role="status" className="muted">다시 연결하는 중이에요</p>
      ) : null}
      {snapshot.stepsError === null ? null : polling.status === 'done' ? (
        <div role="alert" className="notice">
          클릭 기록을 불러오지 못했어요{' '}
          <button type="button" className="link-button" onClick={polling.retry}>다시 시도</button>
        </div>
      ) : (
        <p role="status" className="muted">클릭 기록을 다시 불러오는 중이에요</p>
      )}

      <Timeline label="진단 결과">
        {done ? (
          <Finished run={run} steps={steps} site={site} />
        ) : (
          <>
            <Live run={run} steps={steps} />
            <TimelineStep state="upcoming" question={WHY_QUESTION} />
            {improvable ? (
              <>
                <TimelineStep state="upcoming" question={FIX_QUESTION} />
                <TimelineStep state="upcoming" question={GAIN_QUESTION} />
              </>
            ) : null}
          </>
        )}
      </Timeline>
    </section>
  )
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="notice">
      불러오지 못했어요{' '}
      <button type="button" className="link-button" onClick={onRetry}>다시 시도</button>
    </div>
  )
}

/**
 * AI에게 개선안을 받아 볼 수 있는 진단의 종류: 직접 한 예시 쇼핑몰(MORO MARKET) 지금 화면 진단.
 * 서버는 이 가운데 끝난·유효한 진단만 받는다 (BE `api/improvement_jobs.py` `source_problem`).
 */
function canImprove(run: Run): boolean {
  return run.variant === 'before' && !run.siteId && !isScenarioRun(run) && !run.optimizationContext && !run.improvementContext
}

type Outcome = 'reached' | 'missed' | 'unfinished'

/** 무효(브라우저 오류 등)·오류로 끝났거나 도달 여부가 없으면 "못 찾음"이 아니라 "끝내지 못함"이다 */
function outcomeOf(run: Run): Outcome {
  if (run.validity === 'INVALID' || run.status === 'ERROR' || typeof run.summary?.goalReached !== 'boolean') return 'unfinished'
  return run.summary.goalReached ? 'reached' : 'missed'
}

/** ① 진행 중: 지금 화면 한 장과 지금까지 누른 곳 */
function Live({ run, steps }: { run: Run; steps: Step[] }) {
  const latest = steps.at(-1)
  const clicking = Math.min(Math.max(run.progress.stepCount, steps.length) + 1, run.maxSteps)
  return (
    <TimelineStep state="current" question={FIND_QUESTION} answer={run.status === 'RUNNING' ? 'AI가 찾아보는 중이에요' : '곧 시작해요'}>
      <p role="status" className="run-live-progress">
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
    </TimelineStep>
  )
}

/** 끝난 진단: ① 결론과 지나간 길 → ② 이유 → (개선안을 받을 수 있는 진단만) ③④ */
function Finished({ run, steps, site }: { run: Run; steps: Step[]; site: Site | undefined }) {
  const pageName = (pageKey: string) => pageNameOf(pageKey, site, steps)
  const outcome = outcomeOf(run)
  const why = explainRun(run, steps, pageName)
  const improvable = canImprove(run) && run.validity === 'VALID' && outcome !== 'unfinished'
  const runImprovement = useRunImprovement(run.runId, improvable)
  const clicks = run.summary?.stepCount ?? null

  return (
    <>
      <TimelineStep
        state="done"
        question={FIND_QUESTION}
        tone={outcome === 'reached' ? 'good' : 'bad'}
        answer={outcome === 'reached' ? (clicks !== null ? `${clicks}번 만에 찾았어요` : '찾았어요') : outcome === 'missed' ? '못 찾았어요' : '진단을 끝내지 못했어요'}
      >
        {outcome === 'unfinished' ? (
          <p>
            {run.validity === 'INVALID' ? '이 진단은 결과로 쓸 수 없어요. ' : ''}
            {run.terminationReason && run.terminationReason !== 'GOAL_VERIFIED' ? `${stopReasonLabel(run.terminationReason)}. ` : ''}
            <Link to="/">다시 진단해 주세요.</Link>
          </p>
        ) : null}
        <PathTrail run={run} pageName={pageName} reached={outcome === 'reached'} />
        {steps.length ? (
          <Disclosure title="클릭별로 자세히 보기" lazy>
            <ClickDetails run={run} steps={steps} pageName={pageName} />
          </Disclosure>
        ) : null}
      </TimelineStep>

      {why ? (
        <TimelineStep state="done" question={WHY_QUESTION} answer={why.headline}>
          {why.lines.map((line) => <p key={line}>{line}</p>)}
          <ChoiceBars why={why} pageName={pageName} markEditable={improvable} />
          <Issues runId={run.runId} />
        </TimelineStep>
      ) : null}

      {improvable ? <ImprovementSteps runImprovement={runImprovement} /> : null}
      {isScenarioRun(run) && outcome !== 'unfinished' ? (
        <li className="tl-note muted">개선안 받아 보기는 지금 예시 쇼핑몰에서만 돼요.</li>
      ) : null}
    </>
  )
}

/** 지나간 길: 화면 이름을 화살표로 이은 한 줄 */
function PathTrail({ run, pageName, reached }: { run: Run; pageName: (pageKey: string) => string; reached: boolean }) {
  const path = run.summary?.path ?? []
  if (!path.length) return null
  return (
    <ol className="run-path" aria-label="지나간 길">
      {path.map((visit, i) => (
        <li key={visit.sequence} data-goal={reached && i === path.length - 1 ? 'true' : undefined}>
          {pageName(visit.pageKey)}
          {visit.enteredBy === 'GO_BACK' ? <span className="run-path-note"> (돌아옴)</span> : null}
        </li>
      ))}
    </ol>
  )
}

/**
 * 그 화면에서 버튼마다 누를 가능성 (위에서 네 개). AI가 이름을 바꿀 수 있는 메뉴에는 작은 표시를 붙이고,
 * 네 개 안에 없으면 그 메뉴를 한 줄 더 보인다.
 */
function ChoiceBars({ why, pageName, markEditable }: { why: Why; pageName: (pageKey: string) => string; markEditable: boolean }) {
  const step = why.step
  if (!step?.candidates.length) return null
  const ranked = [...step.candidates].sort((a, b) => b.probability - a.probability).slice(0, BAR_COUNT)
  const editable = markEditable && why.first ? step.candidates.find((c) => c.semanticKey === EDITABLE_KEY) : undefined
  if (editable && !ranked.includes(editable)) ranked.push(editable)
  const title = why.first ? '첫 화면에서 누를 가능성' : `${pageName(step.page.pageKey)} 화면에서 누를 가능성`
  return (
    <section className="choice" aria-label={title}>
      <h3>{title}</h3>
      <ul className="choice-bars">
        {ranked.map((c) => (
          <li key={c.optionId}>
            <span className="choice-label">
              {c.label}
              {c === editable ? <span className="choice-tag">바꿀 수 있어요</span> : null}
            </span>
            <span className="choice-value">{Math.round(c.probability * 100)}%</span>
            <span className="choice-track" aria-hidden="true"><span style={{ width: `${Math.max(1, c.probability * 100)}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClickDetails({ run, steps, pageName }: { run: Run; steps: Step[]; pageName: (pageKey: string) => string }) {
  return (
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
  )
}

/** 접힌 "살펴볼 점". 없으면 보이지 않는다 */
function Issues({ runId }: { runId: string }) {
  const issues = usePolling({
    fetch: (signal) => getRunIssues(runId, signal),
    isDone: (data) => data.analysisStatus !== 'PENDING',
    resetKey: runId,
    maxRefetches: ISSUE_MAX_REFETCHES,
  })
  const items = issues.data?.analysisStatus === 'COMPLETED' ? issues.data.items : []
  if (!items.length) return null
  return (
    <Disclosure title={`살펴볼 점 ${items.length}개`}>
      <ul className="run-issues">
        {items.map((issue) => <IssueItem key={issue.issueId} issue={issue} />)}
      </ul>
      <p className="muted">AI의 클릭 기록에서 찾은 단서예요. 실제 문제인지는 직접 확인해 주세요.</p>
    </Disclosure>
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
  const label = quote(selectedLabel(step))
  return step.action.executed ? `${head}${label} 누름` : `${head}${label} 누르려 했지만 안 됨`
}

/** 어디서 무엇을 찾는 진단인지 한 줄 */
function whereText(run: Run, site: Site | undefined): string {
  const context = run.improvementContext ?? run.optimizationContext
  const where = isScenarioRun(run)
    ? site?.name ?? '등록된 사이트'
    // 기준 실행(BASELINE)은 이름을 바꾸지 않은 지금 화면이다
    : context?.executionRole === 'BASELINE' ? 'MORO MARKET (지금 화면)'
      : context ? `메뉴 이름을 ${quote(context.label)}${roOf(context.label)} 바꿔 본 화면`
      : run.variant === 'after' ? 'MORO MARKET 개선안' : 'MORO MARKET'
  const goal = GOAL_SCREENS.find((s) => s.path === run.verification?.path)?.label
    ?? site?.pages.find((page) => page.path === run.verification?.path)?.label
  return goal ? `${where} · 찾을 화면 ${goal}` : where
}

/** 화면 이름. 사이트 정보 → MORO MARKET 표 → 그 화면의 제목 순으로 찾고, 코드값은 보이지 않는다 */
function pageNameOf(pageKey: string, site: Site | undefined, steps: Step[]): string {
  return (
    site?.pages.find((page) => page.pageKey === pageKey)?.label ??
    (Object.hasOwn(SHOP_PAGES, pageKey) ? SHOP_PAGES[pageKey] : undefined) ??
    steps.find((step) => step.page.pageKey === pageKey)?.page.title ??
    '다른 화면'
  )
}
