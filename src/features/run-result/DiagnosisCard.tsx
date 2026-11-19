import { useState } from 'react'
import { useNavigate } from 'react-router'
import { startImprovement } from '../../api/improvements.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Run, Step } from '../../domain/types.ts'
import { GOAL_SCREENS } from '../../shared/customerInput.ts'
import { stopReasonLabel } from '../../shared/runLabels.ts'
import { startErrorMessage } from '../improvement/labels.ts'

/** AI 개선이 바꿀 수 있는 버튼 (상단 메뉴 "이용정보" 자리, BE `uxm/label_edit.EDITABLE_KEY`) */
const EDITABLE_HREF = '/shop/orders'
const TOP = 4

const percent = (p: number) => `${Math.round(p * 100)}%`

/** '을'/'를'. 받침이 있으면 '을' */
function withObject(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를'
}

/**
 * AI 개선을 시작할 수 있는 진단인지. 서버는 끝난·유효한 MORO MARKET 'before' 진단만 받는다(그 밖은 422).
 * 목표에 못 간(BLOCKED·MAX_STEPS) 진단도 유효하면 시작할 수 있다.
 */
function canStartImprovement(run: Run): boolean {
  return (
    isTerminalStatus(run.status) &&
    run.validity === 'VALID' &&
    run.variant === 'before' &&
    !run.siteId &&
    !run.optimizationContext &&
    !run.improvementContext
  )
}

/**
 * 진단 결과 맨 위 "진단서": 결론 한 줄 → 멈춘 이유 → 첫 화면에서 고객이 고른 버튼 → 다음 할 일("AI에게 고쳐 달라고 하기").
 * 개선안(after) 화면 진단은 여기서 권하지 않는다. 서버의 고정 개선안 사이트는 AI가 고른 이름과 다를 수 있어서다(OI-14).
 */
export function DiagnosisCard({ run, steps }: { run: Run; steps: Step[] | null }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reached = run.summary?.goalReached === true
  // 무효(브라우저 오류 등)·오류로 끝났거나 도달 여부가 없으면 "못 찾음"이 아니라 "진단을 끝내지 못함"이다
  const unfinished = run.validity === 'INVALID' || run.status === 'ERROR' || (isTerminalStatus(run.status) && typeof run.summary?.goalReached !== 'boolean')
  const outcome = reached ? 'yes' : unfinished ? 'unfinished' : 'no'
  const screen = GOAL_SCREENS.find((s) => s.path === run.verification?.path)
  const goalName = screen?.label ?? (run.verification?.text ? `'${run.verification.text}'` : '목표')
  const clicks = run.summary?.stepCount ?? null
  const first = steps?.[0]
  const ranked = first ? [...first.candidates].sort((a, b) => b.probability - a.probability).slice(0, TOP) : []
  const editable = first?.candidates.find((c) => c.href === EDITABLE_HREF) ?? null
  const improvable = canStartImprovement(run) && outcome !== 'unfinished'

  async function improve() {
    setPending(true)
    setError(null)
    try {
      const job = await startImprovement({ sourceRunId: run.runId })
      navigate(`/improvements/${encodeURIComponent(job.improvementId)}`)
    } catch (e) {
      setError(startErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="card diagnosis-card" aria-label="진단 요약" data-reached={outcome}>
      <p className="diagnosis-headline">
        {outcome === 'yes'
          ? `${clicks !== null ? `${clicks}번 만에 ` : ''}${goalName} 화면에 도착했어요.`
          : outcome === 'unfinished'
            ? '진단을 끝내지 못했어요.'
            : `${goalName} 화면을 찾지 못했어요.`}
      </p>
      {outcome === 'unfinished' ? (
        <p className="diagnosis-reason">
          {run.validity === 'INVALID' ? '이 진단은 결과로 쓸 수 없어요. ' : ''}
          {run.terminationReason && run.terminationReason !== 'GOAL_VERIFIED' ? `${stopReasonLabel(run.terminationReason)}. ` : ''}
          같은 조건으로 다시 진단해 주세요.
        </p>
      ) : outcome === 'no' && stopReasonLabel(run.terminationReason) ? (
        <p className="diagnosis-reason">{stopReasonLabel(run.terminationReason)}</p>
      ) : null}

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
          {improvable && editable && !reached ? (
            <p className="muted">'{editable.label}'{withObject(editable.label)} 누를 가능성은 {percent(editable.probability)}예요. AI가 이 메뉴 이름을 바꿔 볼 수 있어요.</p>
          ) : null}
        </div>
      ) : null}

      {improvable ? (
        <div className="diagnosis-actions">
          <button type="button" className="primary" disabled={pending} onClick={() => void improve()}>
            {pending ? '시작하는 중' : 'AI에게 고쳐 달라고 하기'}
          </button>
          <span className="muted">
            메뉴 이름을 바꿔 보고 같은 고객으로 다시 진단해요. 5분쯤 걸려요.
          </span>
        </div>
      ) : null}
      {error ? <p role="alert" className="error-notice">{error}</p> : null}
    </section>
  )
}
