import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { ImprovementJobDto } from '../../api/improvements.ts'
import type { ImprovementView } from '../../domain/improvement.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { OfficialSection } from './OfficialSection.tsx'
import { RoundsSection } from './RoundsSection.tsx'
import { CandidateNote, SummarySection } from './SummarySection.tsx'
import { VerificationSection } from './VerificationSection.tsx'
import { goalPageName, kindLabel } from './labels.ts'
import { isActiveJob, useImprovement } from './useImprovement.ts'
import './improvement.css'

/** 결과 아래 한 줄 */
const LIMITATION = 'AI 고객 기준이에요. 실제 사람 테스트로 확인해 보세요.'

/** 진행 단계 (BE `phase` 순서) */
const STEPS = [
  { phase: 'LOOP', name: '이름 후보 찾기' },
  { phase: 'BUILD_FINAL_SITE', name: '개선안 만들기' },
  { phase: 'OFFICIAL_AND_VERIFY', name: '다시 확인' },
]

const UNREADABLE = '이 부분을 보여 드릴 수 없어요.'

export function ImprovementPage() {
  const { improvementId } = useParams()
  if (!improvementId) return null
  // 주소의 improvementId가 바뀌면 로딩 상태를 새로 시작한다.
  return <ImprovementDetail key={improvementId} improvementId={improvementId} />
}

function ImprovementDetail({ improvementId }: { improvementId: string }) {
  const state = useImprovement(improvementId)

  if (state.phase === 'loading') return <Page><p role="status">불러오는 중이에요</p></Page>
  if (state.phase !== 'success') {
    return (
      <Page>
        <p role="alert" className="error-notice">
          {state.phase === 'notFound' ? '결과를 찾을 수 없어요.' : '결과를 불러오지 못했어요. 다시 시도하고 있어요.'}
          {state.phase === 'error' ? <> <button type="button" onClick={state.retry}>지금 다시 불러오기</button></> : null}
        </p>
        <Link to="/improvements">AI 개선 목록으로</Link>
      </Page>
    )
  }

  const { job, view } = state
  const running = isActiveJob(job)
  const unfinished = job.status === 'FAILED' || job.status === 'INTERRUPTED'
  return (
    <Page job={job}>
      {state.stale ? (
        <p role="status" className="busy-notice">
          연결이 잠깐 끊겼어요. 다시 연결하는 중이에요.{' '}
          <button type="button" onClick={state.retry}>지금 다시 불러오기</button>
        </p>
      ) : null}
      {running ? <Progress job={job} view={view} /> : null}
      {unfinished ? <Failed job={job} view={view} /> : null}
      {job.status === 'COMPLETED' ? (
        view ? <Done view={view} /> : <p role="status" className="muted">결과를 아직 보여 드릴 수 없어요. 잠시 뒤 다시 열어 주세요.</p>
      ) : null}
      {view && !running ? (
        <>
          <HowChosen view={view} />
          <p className="imp-limitation">{LIMITATION}</p>
        </>
      ) : null}
    </Page>
  )
}

/** 제목 + 출처 표시 + "OO 고객이 OO 때 · 도착 화면 OO" */
function Page({ job, children }: { job?: ImprovementJobDto; children: ReactNode }) {
  const input = job?.input
  return (
    <section className="improvement-page">
      <header className="page-header">
        <div className="page-title-row">
          <h1>{PAGE_NAMES.improvement}</h1>
          {job?.kind ? <span className="experiment-tag">{kindLabel(job.kind)}</span> : null}
        </div>
        {input ? (
          <p className="imp-question">
            <strong>{input.persona}</strong> 고객이 <strong>{input.goal}</strong> 때 · 도착 화면 <strong>{goalPageName(input.goalPage)}</strong>
            {input.sourceRunId ? <> · <Link to={`/runs/${encodeURIComponent(input.sourceRunId)}/result`}>처음 진단 보기</Link></> : null}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

function Progress({ job, view }: { job: ImprovementJobDto; view: ImprovementView | null }) {
  const index = job.phase === 'DONE' ? STEPS.length : STEPS.findIndex((s) => s.phase === job.phase)
  return (
    <section className="card imp-card" aria-label="진행 상황">
      <h2>AI가 고치는 중이에요</h2>
      <ol className="imp-steps">
        {STEPS.map((step, i) => {
          const state = index > i ? 'done' : index === i ? 'doing' : 'todo'
          return (
            <li key={step.phase} data-state={state}>
              <span className="imp-step-mark" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
              {step.name}
              {state === 'doing' ? <span className="imp-sr"> (하는 중)</span> : null}
              {state === 'done' ? <span className="imp-sr"> (끝)</span> : null}
            </li>
          )
        })}
      </ol>
      <p role="status" className="muted">5분쯤 걸려요. 이 화면을 닫아도 계속돼요.</p>
      {view?.report.ok ? <CandidateNote report={view.report.data} stage="pending" /> : null}
    </section>
  )
}

function Failed({ job, view }: { job: ImprovementJobDto; view: ImprovementView | null }) {
  return (
    <section className="card imp-card" aria-label="끝내지 못함">
      <h2>{job.status === 'INTERRUPTED' ? '중간에 멈췄어요' : '끝내지 못했어요'}</h2>
      <p role="alert">
        잠시 뒤 다시 해 주세요.
        {job.error?.message ? <span className="muted"> {job.error.message}</span> : null}
      </p>
      {view?.report.ok ? <CandidateNote report={view.report.data} stage="unfinished" /> : null}
    </section>
  )
}

/** 끝난 결과: 결론 카드 + 개선안에서 다시 해 본 결과 */
function Done({ view }: { view: ImprovementView }) {
  const report = view.report
  const verification = view.verification
  const improved = report.ok && report.data.result === 'IMPROVED'
  const skipVerification = verification.ok && verification.data.status === 'NOT_RUN' && !improved
  return (
    <>
      <section className="card imp-card imp-result" aria-label="결론">
        {report.ok ? (
          <SummarySection report={report.data} maxGuardLoss={maxGuardLossOf(view.plan?.rules ?? null)} />
        ) : <p role="alert" className="error-notice">{UNREADABLE}</p>}
      </section>
      {skipVerification ? null : (
        <section className="card imp-card" aria-label="개선안에서 다시 해 봤어요">
          <h2>개선안에서 다시 해 봤어요</h2>
          {verification.ok ? (
            <VerificationSection verification={verification.data} mainGoalKey={report.ok ? report.data.main.goalKey : view.plan?.mainGoal?.goalKey} />
          ) : <p role="alert" className="error-notice">{UNREADABLE}</p>}
        </section>
      )}
    </>
  )
}

/** 접힌 "어떻게 골랐는지 보기": 시험한 이름 + 점수 계산. 둘 다 없으면 보이지 않는다 */
function HowChosen({ view }: { view: ImprovementView }) {
  const rounds = view.rounds.ok && view.rounds.data.length ? view.rounds.data : null
  const official = view.official.ok ? view.official.data : null
  if (!rounds && !official) return null
  return (
    <details className="card imp-card imp-how">
      <summary>어떻게 골랐는지 보기</summary>
      {rounds ? <RoundsSection rounds={rounds} stop={view.stop} goals={goalsOf(view)} /> : null}
      {official ? <OfficialSection official={official} goalNames={goalNamesOf(view)} /> : null}
    </details>
  )
}

/** 다른 고객 허용 감소 범위 `plan.rules.maxGuardLoss`. 숫자가 아니거나 없으면 `null` */
function maxGuardLossOf(rules: Record<string, unknown> | null): number | null {
  const value = rules?.maxGuardLoss
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
