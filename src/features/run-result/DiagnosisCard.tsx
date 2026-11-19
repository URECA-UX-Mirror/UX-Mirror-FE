import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { startImprovement } from '../../api/improvements.ts'
import { createRun } from '../../api/runs.ts'
import type { Run, RunListItem, Step } from '../../domain/types.ts'
import { GOAL_SCREENS } from '../../shared/customerInput.ts'
import { stopReasonLabel } from '../../shared/runLabels.ts'
import { startErrorMessage } from '../improvement/labels.ts'

/** AI 개선이 바꿀 수 있는 버튼 (상단 메뉴 "이용정보" 자리, BE `uxm/label_edit.EDITABLE_KEY`) */
const EDITABLE_HREF = '/shop/orders'
const TOP = 4

const percent = (p: number) => `${Math.round(p * 100)}%`

/**
 * 진단 결과 맨 위 "진단서": 결론 한 줄 → 멈춘 이유 → 첫 화면에서 고객이 고른 버튼 → 다음 할 일.
 * 다음 할 일: "AI에게 고쳐 달라고 하기"(MORO MARKET 진단만), "개선안 화면으로도 해 보기"(같은 조건으로 after 실행).
 */
export function DiagnosisCard({ run, steps, runs }: { run: Run; steps: Step[] | null; runs: RunListItem[] | null }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<'improve' | 'after' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reached = run.summary?.goalReached === true
  const screen = GOAL_SCREENS.find((s) => s.path === run.verification?.path)
  const goalName = screen?.label ?? (run.verification?.text ? `'${run.verification.text}'` : '목표')
  const clicks = run.summary?.stepCount ?? null
  const first = steps?.[0]
  const ranked = first ? [...first.candidates].sort((a, b) => b.probability - a.probability).slice(0, TOP) : []
  const editable = first?.candidates.find((c) => c.href === EDITABLE_HREF) ?? null
  const isMoro = !run.siteId
  const isDiagnosis = run.variant === 'before' && !run.optimizationContext && !run.improvementContext
  const after = runs?.find((r) => r.variant === 'after' && r.validity === 'VALID') ?? null
  const afterRunning = runs?.find((r) => r.variant === 'after' && r.validity !== 'INVALID' && r.validity !== 'VALID') ?? null

  async function improve() {
    setPending('improve')
    setError(null)
    try {
      const job = await startImprovement({ sourceRunId: run.runId })
      navigate(`/improvements/${encodeURIComponent(job.improvementId)}`)
    } catch (e) {
      setError(startErrorMessage(e))
    } finally {
      setPending(null)
    }
  }

  async function tryAfter() {
    if (!run.verification) return
    setPending('after')
    setError(null)
    try {
      const created = await createRun({
        experimentKey: run.experimentKey,
        variant: 'after',
        goal: run.goalId ? { goalId: run.goalId } : { goal: run.goal, verification: { path: run.verification.path, text: run.verification.text, exact: run.verification.exact, ...(run.verification.scope === 'page' || run.verification.scope === 'main' ? { scope: run.verification.scope } : {}) } },
        persona: run.personaId ? { personaId: run.personaId } : { persona: run.persona },
        maxSteps: run.maxSteps,
      })
      navigate(`/runs/${encodeURIComponent(created.runId)}?experimentKey=${encodeURIComponent(run.experimentKey)}`)
    } catch (e) {
      setError(isApiError(e) && e.code === 'RUN_ALREADY_ACTIVE' ? '지금 다른 진단이 진행 중이에요. 끝나면 다시 눌러 주세요.' : isApiError(e) && e.message.trim() ? e.message : '개선안 진단을 시작하지 못했어요.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="card diagnosis-card" aria-label="진단 요약" data-reached={reached ? 'yes' : 'no'}>
      <p className="diagnosis-headline">
        {reached
          ? `${clicks !== null ? `${clicks}번 만에 ` : ''}${goalName} 화면에 도착했어요.`
          : `${goalName} 화면을 찾지 못했어요.`}
      </p>
      {!reached && stopReasonLabel(run.terminationReason) ? <p className="diagnosis-reason">{stopReasonLabel(run.terminationReason)}</p> : null}

      {ranked.length ? (
        <div className="diagnosis-first">
          <h2>첫 화면에서 이 고객이 누를 가능성</h2>
          <ul className="choice-bars">
            {ranked.map((c) => (
              <li key={c.optionId} data-editable={c.href === EDITABLE_HREF ? 'yes' : undefined}>
                <span className="choice-label">{c.label}</span>
                <span className="choice-bar" style={{ width: `${Math.max(4, c.probability * 100)}%` }} aria-hidden="true" />
                <span className="choice-value">{percent(c.probability)}</span>
                {c === ranked[0] ? <span className="choice-note">가장 많이 골랐어요</span> : null}
              </li>
            ))}
          </ul>
          {isMoro && editable && !reached ? (
            <p className="muted">"{editable.label}"을(를) 누를 가능성은 {percent(editable.probability)}예요. AI가 이 메뉴 이름을 바꿔 볼 수 있어요.</p>
          ) : null}
        </div>
      ) : null}

      {isMoro && isDiagnosis ? (
        <div className="diagnosis-actions">
          <button type="button" className="primary" disabled={pending !== null} onClick={() => void improve()}>
            {pending === 'improve' ? '시작하는 중' : 'AI에게 고쳐 달라고 하기'}
          </button>
          <span className="muted">같은 고객·같은 일로 메뉴 이름을 바꿔 보고, 다른 고객에게 손해가 없는지까지 확인해요 (약 5분)</span>
          {after ? (
            <Link to={`/comparisons/${encodeURIComponent(run.experimentKey)}`}>지금 화면 vs 개선안 비교</Link>
          ) : afterRunning ? (
            <Link to={`/runs/${encodeURIComponent(afterRunning.runId)}`}>개선안 진단 진행 보기</Link>
          ) : run.verification ? (
            <button type="button" disabled={pending !== null} onClick={() => void tryAfter()}>
              {pending === 'after' ? '시작하는 중' : '개선안 화면으로도 해 보기'}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="error-notice">{error}</p> : null}
    </section>
  )
}
