import { Link, Navigate, useParams } from 'react-router'
import { Timeline } from '../../shared/Timeline.tsx'
import { ImprovementStepsView } from './ImprovementSteps.tsx'
import { goalPageName, kindLabel } from './labels.ts'
import { useImprovement } from './useImprovement.ts'
import './improvement.css'

/**
 * `/improvements/:id`. 진단에서 시작한 결과면 그 진단 화면으로 보낸다 (결과는 진단 화면 안에 있다).
 * 진단 없이 만든 결과(사전 등록 공식 결과 등)만 여기서 같은 두 단계로 보인다.
 */
export function ImprovementPage() {
  const { improvementId } = useParams()
  if (!improvementId) return null
  // 주소의 improvementId가 바뀌면 로딩 상태를 새로 시작한다.
  return <ImprovementDetail key={improvementId} improvementId={improvementId} />
}

function ImprovementDetail({ improvementId }: { improvementId: string }) {
  const state = useImprovement(improvementId)
  const job = state.phase === 'success' ? state.job : null
  const sourceRunId = job?.input?.sourceRunId
  if (sourceRunId) return <Navigate to={`/runs/${encodeURIComponent(sourceRunId)}`} replace />

  return (
    <section className="report-page">
      <header className="report-head">
        <p className="report-eyebrow">
          {job?.input ? `찾을 화면 · ${goalPageName(job.input.goalPage)}` : 'AI 개선안'}
          {job?.kind ? <span className="kind-tag">{kindLabel(job.kind)}</span> : null}
        </p>
        <h1>{job?.input?.goal ?? '메뉴 이름을 바꿔 봤어요'}</h1>
      </header>
      <Timeline label="개선안">
        <ImprovementStepsView state={state} />
      </Timeline>
      {state.phase === 'notFound' || state.phase === 'error' ? <Link to="/">새 진단 하러 가기</Link> : null}
    </section>
  )
}
