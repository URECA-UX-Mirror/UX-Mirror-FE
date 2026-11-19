import type { ReactNode } from 'react'
import type { ImprovementJobDto } from '../../api/improvements.ts'
import type { ImprovementReport, ImprovementScoreLine, ImprovementView } from '../../domain/improvement.ts'
import { formatScore, formatScoreDelta } from '../../domain/improvementScore.ts'
import { Disclosure, TimelineStep } from '../../shared/Timeline.tsx'
import { ChoiceSummary } from './ChoiceSummary.tsx'
import { VerificationSection } from './VerificationSection.tsx'
import { kindLabel, quote } from './labels.ts'
import { describeReason } from './reasons.ts'
import { isActiveJob, useImprovement, type ImprovementLoadState } from './useImprovement.ts'
import type { RunImprovement } from './useRunImprovement.ts'
import './improvement.css'

export const FIX_QUESTION = '어떻게 바꾸면 좋을까요?'
export const GAIN_QUESTION = '바꾸면 얼마나 좋아질까요?'

const LIMITATION = 'AI 기준이에요. 실제 사람 테스트로 확인해 보세요.'
const UNREADABLE = '이 부분을 보여 드릴 수 없어요.'

/** 부동소수점 오차로 정확히 경계인 값(−2.0%p)이 범위 밖이 되지 않게 한다 */
const EPSILON = 1e-9

/** 진행 단계 (BE `phase` 순서) */
const PHASES = [
  { phase: 'LOOP', name: '이름 후보 찾기' },
  { phase: 'BUILD_FINAL_SITE', name: '개선안 만들기' },
  { phase: 'OFFICIAL_AND_VERIFY', name: '다시 확인' },
]

/**
 * 진단 화면의 ③ "어떻게 바꾸면 좋을까요?"와 ④ "바꾸면 얼마나 좋아질까요?".
 * 아직 시작하지 않았으면 시작 버튼을, 시작했으면 진행 → 결과를 같은 자리에 보인다.
 * 서비스는 사용자의 사이트를 바꾸지 않는다. 바꿀 이름을 제안하고, AI가 보는 화면에서만 그 이름으로 다시 해 본다.
 */
export function ImprovementSteps({ runImprovement }: { runImprovement: RunImprovement }) {
  const { improvementId } = runImprovement
  if (improvementId) return <Loaded key={improvementId} improvementId={improvementId} runImprovement={runImprovement} />
  if (runImprovement.lookup === 'loading') {
    return (
      <>
        <TimelineStep state="upcoming" question={FIX_QUESTION} />
        <TimelineStep state="upcoming" question={GAIN_QUESTION} />
      </>
    )
  }
  return (
    <>
      <TimelineStep state="current" question={FIX_QUESTION}>
        <StartButton runImprovement={runImprovement} label="AI에게 개선안 받아 보기" />
        <p className="muted">메뉴 이름을 바꿔 보고 다시 진단해요. 5분쯤 걸려요.</p>
        {runImprovement.lookup === 'failed' ? (
          <p role="status" className="muted">
            전에 받은 개선안을 확인하지 못했어요.{' '}
            <button type="button" className="link-button" onClick={runImprovement.retryLookup}>다시 확인</button>
          </p>
        ) : null}
      </TimelineStep>
      <TimelineStep state="upcoming" question={GAIN_QUESTION} />
    </>
  )
}

function Loaded({ improvementId, runImprovement }: { improvementId: string; runImprovement: RunImprovement }) {
  const state = useImprovement(improvementId)
  return <ImprovementStepsView state={state} runImprovement={runImprovement} showKind />
}

function StartButton({ runImprovement, label }: { runImprovement: RunImprovement; label: string }) {
  return (
    <>
      <button type="button" className="primary" disabled={runImprovement.pending} onClick={runImprovement.start}>
        {runImprovement.pending ? '시작하는 중' : label}
      </button>
      {runImprovement.error ? <p role="alert" className="notice">{runImprovement.error}</p> : null}
    </>
  )
}

/**
 * 불러온 AI 개선 하나를 두 단계로 그린다. 진단 화면과 `/improvements/:id`가 같이 쓴다.
 * `runImprovement`가 있으면(진단 화면) 끝내지 못한 결과 아래에 다시 시작 버튼을 둔다.
 */
export function ImprovementStepsView({ state, runImprovement, showKind = false }: {
  state: ImprovementLoadState
  runImprovement?: RunImprovement
  showKind?: boolean
}) {
  if (state.phase === 'loading') {
    return (
      <>
        <TimelineStep state="current" question={FIX_QUESTION}><p role="status">불러오는 중이에요</p></TimelineStep>
        <TimelineStep state="upcoming" question={GAIN_QUESTION} />
      </>
    )
  }
  if (state.phase !== 'success') {
    return (
      <TimelineStep state="current" question={FIX_QUESTION}>
        <p role="alert" className="notice">
          {state.phase === 'notFound' ? '결과를 찾을 수 없어요.' : '결과를 불러오지 못했어요. 다시 시도하고 있어요.'}
          {state.phase === 'error' ? <> <button type="button" className="link-button" onClick={state.retry}>지금 다시 불러오기</button></> : null}
        </p>
      </TimelineStep>
    )
  }

  const { job, view } = state
  const stale = state.stale ? (
    <p role="status" className="notice">
      연결이 잠깐 끊겼어요. 다시 연결하는 중이에요.{' '}
      <button type="button" className="link-button" onClick={state.retry}>지금 다시 불러오기</button>
    </p>
  ) : null
  const report = view?.report.ok ? view.report.data : null

  if (isActiveJob(job)) {
    return (
      <>
        <TimelineStep state="current" question={FIX_QUESTION} answer="AI가 개선안을 찾는 중이에요">
          {stale}
          <Progress job={job} />
          <p role="status" className="muted">5분쯤 걸려요. 이 화면을 닫아도 계속돼요.</p>
          {report ? <CandidateNote report={report} stage="pending" /> : null}
        </TimelineStep>
        <TimelineStep state="upcoming" question={GAIN_QUESTION} />
      </>
    )
  }

  if (job.status !== 'COMPLETED') {
    return (
      <TimelineStep state="done" question={FIX_QUESTION} tone="bad" answer={job.status === 'INTERRUPTED' ? '중간에 멈췄어요' : '끝내지 못했어요'}>
        {stale}
        <p role="alert">잠시 뒤 다시 해 주세요.</p>
        {report ? <CandidateNote report={report} stage="unfinished" /> : null}
        {runImprovement ? <StartButton runImprovement={runImprovement} label="개선안 다시 받아 보기" /> : null}
      </TimelineStep>
    )
  }

  if (!view) {
    return (
      <TimelineStep state="current" question={FIX_QUESTION}>
        {stale}
        <p role="status" className="muted">
          결과를 아직 보여 드릴 수 없어요.{' '}
          <button type="button" className="link-button" onClick={state.retry}>다시 불러오기</button>
        </p>
      </TimelineStep>
    )
  }
  if (!report) {
    return (
      <>
        <TimelineStep state="done" question={FIX_QUESTION}>
          {stale}
          <p role="alert" className="notice">{UNREADABLE}</p>
        </TimelineStep>
        <TimelineStep state="done" question={GAIN_QUESTION}>
          <Recheck view={view} mainGoalKey={view.plan?.mainGoal?.goalKey} improved />
          <HowChosen view={view} />
          <p className="imp-limitation">{LIMITATION}</p>
        </TimelineStep>
      </>
    )
  }

  const improved = report.result === 'IMPROVED' && report.afterLabel !== null
  // 마지막 확인(공식 점수)까지 통과한 이름만 권한다. 후보 찾기만 끝난 결과(`LOOP_A` 등)는 확정이 아니다
  const confirmed = improved && report.scoreSource === 'OFFICIAL_B'
  const verifyFailed = view.verification.ok && view.verification.data.status === 'FAILED'
  // 다시 받아 보다가 끝내지 못해, 전에 끝난 결과를 보이는 중
  const retry = runImprovement?.newerFailed ? (
    <>
      <p role="status" className="muted">다시 받아 보던 개선안은 끝내지 못했어요. 전에 받은 결과예요.</p>
      <StartButton runImprovement={runImprovement} label="개선안 다시 받아 보기" />
    </>
  ) : null

  if (improved && !confirmed) {
    return (
      <>
        <TimelineStep state="done" question={FIX_QUESTION} answer="아직 확정된 개선안이 없어요">
          {stale}
          <CandidateNote report={report} stage="unconfirmed" />
          {retry}
        </TimelineStep>
        <TimelineStep state="done" question={GAIN_QUESTION}>
          <Recheck view={view} mainGoalKey={report.main.goalKey} improved />
          <HowChosen view={view} />
          <p className="imp-limitation">{LIMITATION}</p>
        </TimelineStep>
      </>
    )
  }

  return (
    <>
      <TimelineStep
        state="done"
        question={FIX_QUESTION}
        answer={improved ? (
          <>
            {report.target?.region ? <span className="tl-answer-pre">{report.target.region} </span> : null}
            {quote(report.beforeLabel)} <span aria-hidden="true">→</span> <strong>{quote(report.afterLabel!)}</strong>
          </>
        ) : report.result === 'NO_IMPROVEMENT' ? '이름만 바꿔서는 나아지지 않았어요' : '이번에는 바꿀 이름을 못 정했어요'}
      >
        {stale}
        {improved ? null : (
          <>
            <p>지금은 {quote(report.beforeLabel)} 메뉴 이름만 바꿔 볼 수 있어요.</p>
            {report.officialRejected ? <p>{rejectedText(report)}</p> : null}
          </>
        )}
        {retry}
      </TimelineStep>
      <TimelineStep
        state="done"
        question={GAIN_QUESTION}
        answer={improved ? <ScoreChange line={report.main} big /> : `${formatScore(report.main.before)} 그대로예요`}
      >
        <p className="muted">{improved ? '찾아올 가능성' : '찾아올 가능성이 더 나아진 이름이 없었어요.'}</p>
        {improved ? (
          <p className="muted">
            {verifyFailed ? '다시 해 보는 중에 멈춰서 확인은 끝내지 못했어요.' : '실제 사이트는 바뀌지 않아요. 이 이름으로 바꿔서 반영해 보세요.'}
          </p>
        ) : null}
        {improved && report.guards.length ? <Guards guards={report.guards} maxGuardLoss={maxGuardLossOf(view)} /> : null}
        <Recheck view={view} mainGoalKey={report.main.goalKey} improved={improved} />
        <HowChosen view={view} />
        <p className="imp-limitation">
          {LIMITATION}
          {showKind && job.kind ? ` · ${kindLabel(job.kind)}` : ''}
        </p>
      </TimelineStep>
    </>
  )
}

function Progress({ job }: { job: ImprovementJobDto }) {
  const index = job.phase === 'DONE' ? PHASES.length : PHASES.findIndex((s) => s.phase === job.phase)
  return (
    <ol className="imp-steps" aria-label="진행 상황">
      {PHASES.map((step, i) => {
        const state = index > i ? 'done' : index === i ? 'doing' : 'todo'
        return (
          <li key={step.phase} data-state={state}>
            <span className="imp-step-mark" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
            {step.name}
            {state === 'doing' ? <span className="sr-only"> (하는 중)</span> : null}
            {state === 'done' ? <span className="sr-only"> (끝)</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * 아직 확정이 아닌 후보 (진행 중이거나, 끝내지 못했거나, 후보 찾기만 끝나 마지막 확인 전). "바꿔 보세요"라고 권하지 않는다.
 * 찾은 후보가 없으면 아무것도 보이지 않는다.
 */
function CandidateNote({ report, stage }: { report: ImprovementReport; stage: 'pending' | 'unfinished' | 'unconfirmed' }) {
  if (report.result !== 'IMPROVED' || report.afterLabel === null) return null
  return (
    <div className="imp-candidate" role="status">
      <p>지금까지 찾은 이름: {quote(report.beforeLabel)} <span aria-hidden="true">→</span> {quote(report.afterLabel)}</p>
      <p className="muted">
        {stage === 'pending' ? '아직 확정 아니에요. 다시 확인하면서 바뀔 수 있어요.'
          : stage === 'unconfirmed' ? '다시 확인하기 전이라 확정 아니에요. 이 이름은 아직 권하지 않아요.'
            : '확인을 끝내지 못해 확정 아니에요. 이 이름은 권하지 않아요.'}
      </p>
    </div>
  )
}

const goalNamesOfReport = (report: ImprovementReport) => Object.fromEntries(
  [report.main, ...report.guards].flatMap((line) => (line.goalKey && line.name ? [[line.goalKey, line.name]] : [])),
)

/** 고른 후보가 마지막 확인에서 떨어졌을 때 한 문장 */
function rejectedText(report: ImprovementReport): string {
  const rejected = report.officialRejected!
  const who = rejected.label ? `마지막 후보 ${quote(rejected.label)}도` : '마지막 후보도'
  const why = rejected.reason ? ` (${describeReason(rejected.reason, goalNamesOfReport(report))})` : ''
  return `${who} 다시 재 보니 기준에 못 미쳤어요${why}.`
}

/** "38.5% → 70.1%" + "+31.6%p". `big`이면 단계의 큰 답으로 쓴다 (바뀐 뒤 숫자에만 강조색) */
function ScoreChange({ line, big = false }: { line: ImprovementScoreLine; big?: boolean }) {
  return (
    <span className={big ? 'score-change score-change-big' : 'score-change'}>
      {formatScore(line.before)} <span aria-hidden="true">→</span> <strong>{formatScore(line.after)}</strong>
      <span className="delta-pill" data-negative={(line.delta ?? 0) < 0}>{formatScoreDelta(line.delta)}</span>
    </span>
  )
}

/** 다른 목표들은 괜찮은지 한 줄. 목표별 숫자는 접어 둔다. `maxGuardLoss`가 없으면 판정하지 않는다 */
function Guards({ guards, maxGuardLoss }: { guards: ImprovementScoreLine[]; maxGuardLoss: number | null }) {
  const dropped = (line: ImprovementScoreLine) =>
    maxGuardLoss !== null && line.delta !== null && line.delta < -maxGuardLoss - EPSILON
  const bad = guards.some(dropped)
  return (
    <div className="imp-guards" role="group" aria-label="다른 목표">
      <p data-bad={bad || undefined}>
        {maxGuardLoss === null ? '다른 목표도 같이 재 봤어요.' : bad ? '다른 목표가 많이 떨어졌어요.' : '다른 목표도 괜찮아요.'}
      </p>
      <Disclosure title="다른 목표 자세히 보기">
        <ul>
          {guards.map((line, index) => (
            <li key={line.goalKey ?? index}>
              <span>{line.name ?? '다른 목표'}</span> <ScoreChange line={line} />
              {dropped(line) ? <span className="imp-bad"> 많이 떨어졌어요</span> : null}
            </li>
          ))}
        </ul>
        {maxGuardLoss !== null ? <p className="muted">{formatScoreDelta(-maxGuardLoss)}까지는 괜찮다고 봐요.</p> : null}
      </Disclosure>
    </div>
  )
}

/** 개선안 화면에서 다시 해 본 결과. 바꿀 이름이 없어 해 보지 않았으면 보이지 않는다 */
function Recheck({ view, mainGoalKey, improved }: { view: ImprovementView; mainGoalKey?: string | null; improved: boolean }) {
  const verification = view.verification
  if (verification.ok && verification.data.status === 'NOT_RUN' && !improved) return null
  return (
    <section className="imp-recheck" aria-label="개선안에서 다시 해 봤어요">
      <h3>개선안에서 다시 해 봤어요</h3>
      {verification.ok ? (
        <VerificationSection verification={verification.data} mainGoalKey={mainGoalKey} />
      ) : <p role="alert" className="notice">{UNREADABLE}</p>}
    </section>
  )
}

/** 접힌 "어떻게 골랐는지 보기": 시험한 이름을 짧게 요약한다. 시험한 이름이 없으면 보이지 않는다 */
function HowChosen({ view }: { view: ImprovementView }): ReactNode {
  if (!view.rounds.ok || !view.rounds.data.some((r) => r.candidates.length)) return null
  return (
    <Disclosure title="어떻게 골랐는지 보기">
      <ChoiceSummary view={view} goalNames={goalNamesOf(view)} />
    </Disclosure>
  )
}

/** 다른 목표의 허용 감소 범위 `plan.rules.maxGuardLoss`. 숫자가 아니거나 없으면 `null` */
function maxGuardLossOf(view: ImprovementView): number | null {
  const value = view.plan?.rules?.maxGuardLoss
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const goalsOf = (view: ImprovementView) => [
  ...(view.plan?.mainGoal ? [view.plan.mainGoal] : []),
  ...(view.plan?.guardGoals ?? []),
]

/** 목표 키 → 이름. 계획과 리포트 어느 쪽에서든 읽는다 */
function goalNamesOf(view: ImprovementView): Record<string, string> {
  const names: Record<string, string> = {}
  for (const goal of goalsOf(view)) if (goal.name) names[goal.goalKey] = goal.name
  if (view.report.ok) {
    for (const line of [view.report.data.main, ...view.report.data.guards]) {
      if (line.goalKey && line.name) names[line.goalKey] = line.name
    }
  }
  return names
}
