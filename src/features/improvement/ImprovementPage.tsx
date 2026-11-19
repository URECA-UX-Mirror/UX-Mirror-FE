import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { ImprovementJobDto } from '../../api/improvements.ts'
import type { Area, ImprovementReport, ImprovementView as ReportView } from '../../domain/improvement.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { OfficialSection } from './OfficialSection.tsx'
import { SummarySection } from './SummarySection.tsx'
import { VerificationSection } from './VerificationSection.tsx'
import { isActiveJob, useImprovement } from './useImprovement.ts'
import { RoundsSection } from './RoundsSection.tsx'
import { goalPageName, kindLabel } from './labels.ts'
import './improvement.css'

/** 결과 아래에 늘 보이는 한 줄 */
const LIMITATION = 'AI 고객 기준 결과예요. 실제 사람의 클릭률은 아니니, 사람 사용성 테스트에 올릴 후보로 써 주세요.'

/** 진행 단계 (BE `phase` 순서) */
const STEPS: { phase: string; todo: string; doing: string; done: string }[] = [
  { phase: 'LOOP', todo: '문제 버튼 찾고 새 이름 후보 시험하기', doing: '문제 버튼을 찾고 새 이름 후보를 시험하는 중이에요', done: '문제 버튼을 찾고 새 이름 후보를 시험했어요' },
  { phase: 'BUILD_FINAL_SITE', todo: '개선안 화면 만들기', doing: '개선안 화면을 만드는 중이에요', done: '개선안 화면을 만들었어요' },
  { phase: 'OFFICIAL_AND_VERIFY', todo: '개선안에서 AI 고객으로 다시 확인하기', doing: '개선안에서 AI 고객으로 다시 확인하는 중이에요', done: '개선안에서 AI 고객으로 다시 확인했어요' },
]

export function ImprovementPage() {
  const { improvementId } = useParams()
  if (!improvementId) return null
  // 주소의 improvementId가 바뀌면 로딩 상태를 새로 시작한다.
  return <ImprovementDetail key={improvementId} improvementId={improvementId} />
}

function ImprovementDetail({ improvementId }: { improvementId: string }) {
  const state = useImprovement(improvementId)

  if (state.phase === 'loading') {
    return (
      <Page>
        <p role="status">AI 개선 결과를 불러오는 중이에요</p>
      </Page>
    )
  }
  if (state.phase !== 'success') {
    return (
      <Page>
        <p role="alert" className="error-notice">
          {state.phase === 'notFound' ? 'AI 개선 결과를 찾을 수 없어요.' : 'AI 개선 결과를 불러오지 못했어요. 자동으로 다시 시도하고 있어요.'}
          {state.phase === 'error' ? <> <button type="button" onClick={state.retry}>지금 다시 불러오기</button></> : null}
        </p>
        <Link to="/improvements">{PAGE_NAMES.improvement} 목록 보기</Link>
      </Page>
    )
  }

  const { job, view } = state
  return (
    <Page kind={job.kind}>
      {state.stale ? (
        <p role="status" className="busy-notice">
          서버에 잠시 연결하지 못해 마지막으로 받은 내용을 보여 주고 있어요. 자동으로 다시 시도하고 있어요.{' '}
          <button type="button" onClick={state.retry}>지금 다시 불러오기</button>
        </p>
      ) : null}
      <InputLine job={job} />
      {isActiveJob(job) ? <Progress job={job} /> : null}
      {job.status === 'FAILED' || job.status === 'INTERRUPTED' ? <Failed job={job} /> : null}
      {view ? <Report view={view} running={isActiveJob(job)} stage={stageOf(job)} /> : job.status === 'COMPLETED' ? (
        <p role="status" className="card">결과를 아직 보여줄 수 없어요. 잠시 뒤 다시 열어 주세요.</p>
      ) : null}
    </Page>
  )
}

function Page({ kind, children }: { kind?: string; children: ReactNode }) {
  return (
    <section className="improvement-page">
      <div className="page-title-row">
        <h1>{PAGE_NAMES.improvement}</h1>
        {kind ? <span className="experiment-tag">{kindLabel(kind)}</span> : null}
      </div>
      {children}
    </section>
  )
}

/** 어떤 고객·어떤 일로 돌렸는지 한 문장 */
function InputLine({ job }: { job: ImprovementJobDto }) {
  const input = job.input
  if (!input) return null
  return (
    <p className="improvement-question">
      <strong>{input.persona}</strong> 고객이 <strong>{input.goal}</strong> 때, <strong>{goalPageName(input.goalPage)}</strong> 화면까지 잘 찾아오도록
      {input.sourceRunId ? <> · <Link to={`/runs/${encodeURIComponent(input.sourceRunId)}/result`}>처음 진단 보기</Link></> : null}
    </p>
  )
}

function Progress({ job }: { job: ImprovementJobDto }) {
  const index = STEPS.findIndex((s) => s.phase === job.phase)
  return (
    <section className="card improvement-progress" aria-label="진행 상황">
      <ol className="progress-steps">
        {STEPS.map((step, i) => {
          const state = index > i ? 'done' : index === i ? 'doing' : 'todo'
          return (
            <li key={step.phase} data-state={state}>
              <span aria-hidden="true">{state === 'done' ? '✓' : state === 'doing' ? '●' : '○'}</span>{' '}
              {step[state]}
            </li>
          )
        })}
      </ol>
      <p role="status" className="muted">모두 약 5분 걸려요. 기다리는 동안 <Link to="/improvements">지난 결과</Link>를 볼 수 있어요.</p>
    </section>
  )
}

function Failed({ job }: { job: ImprovementJobDto }) {
  return (
    <section className="card" role="alert">
      <p>{job.status === 'INTERRUPTED' ? 'AI 개선이 중간에 멈췄어요.' : 'AI 개선을 끝내지 못했어요.'} 잠시 뒤 다시 시도해 주세요.</p>
      {job.error?.message ? <p className="muted">{job.error.message}</p> : null}
    </section>
  )
}

/** 리포트가 확정인지: 끝남 → final, 진행 중 → pending(공식 평가 전), 실패·중단 → unfinished */
function stageOf(job: ImprovementJobDto): 'final' | 'pending' | 'unfinished' {
  if (isActiveJob(job)) return 'pending'
  return job.status === 'COMPLETED' ? 'final' : 'unfinished'
}

function Report({ view, running, stage }: { view: ReportView; running: boolean; stage: 'final' | 'pending' | 'unfinished' }) {
  return (
    <>
      <AreaSlot title={stage === 'final' ? '개선 효과' : '개선 효과 (확정 전)'} area={view.report}>
        {view.report.ok ? (
          <SummarySection report={view.report.data} maxGuardLoss={maxGuardLossOf(view.plan?.rules ?? null)} stage={stage} />
        ) : null}
      </AreaSlot>
      {running ? null : (
        <AreaSlot title="개선안에서 다시 확인한 결과" area={view.verification}>
          {view.verification.ok ? <VerificationSection verification={view.verification.data} /> : null}
        </AreaSlot>
      )}
      {view.rounds.ok ? (
        <RoundsSection rounds={view.rounds.data} stop={view.stop} goals={view.plan?.guardGoals ?? []} />
      ) : null}
      {view.official.ok && view.official.data ? (
        <details className="card improvement-area">
          <summary>점수 계산 자세히 보기</summary>
          <OfficialSection official={view.official.data} goalNames={goalNamesOf(view.report.ok ? view.report.data : null)} />
        </details>
      ) : null}
      <p className="improvement-limitations">{LIMITATION}</p>
    </>
  )
}

/** 지킬 목표 허용 감소 범위 `plan.rules.maxGuardLoss`. 숫자가 아니거나 없으면 `null` */
function maxGuardLossOf(rules: Record<string, unknown> | null): number | null {
  const value = rules?.maxGuardLoss
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function goalNamesOf(report: ImprovementReport | null): Record<string, string> {
  const names: Record<string, string> = {}
  for (const line of report ? [report.main, ...report.guards] : []) {
    if (line.goalKey && line.name) names[line.goalKey] = line.name
  }
  return names
}

/** 영역 자리. 데이터에 문제가 있으면 그 영역에만 안내를 보인다 */
function AreaSlot({ title, area, children }: { title: string; area: Area<unknown>; children?: ReactNode }) {
  if (area.ok && !children) return null
  return (
    <section className="card improvement-area" aria-label={title}>
      <h2>{title}</h2>
      {area.ok ? children : <p role="alert" className="error-notice">이 부분을 보여줄 수 없어요.</p>}
    </section>
  )
}
