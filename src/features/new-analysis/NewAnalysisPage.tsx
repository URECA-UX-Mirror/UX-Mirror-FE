import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isApiError } from '../../api/client.ts'
import { createRun } from '../../api/runs.ts'
import { CustomerInputs } from '../../shared/CustomerInputs.tsx'
import { EMPTY_INPUT, inputProblems, screenOf, type CustomerInput } from '../../shared/customerInput.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { busyLinkOf, isBusy, useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, SITE, STEPS } from './constants.ts'
import './new-analysis.css'

/**
 * 진단하기 (첫 화면). "어떤 고객이, 무엇을 하려고, 어느 화면까지 오는지" 세 칸만 받는다.
 * 확인 글자·찾는 범위·최대 클릭 수는 도착 화면마다 정해진 값으로 자동으로 채운다. 실험 키는 매번 새로 만든다.
 */
export function NewAnalysisPage() {
  const navigate = useNavigate()
  const health = useHealth()
  const [input, setInput] = useState<CustomerInput>(EMPTY_INPUT)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const busy = isBusy(health.health)
  const notReady = !!health.health && health.health.status !== 'READY'
  const busyLink = busyLinkOf(health.health)

  async function start() {
    setShowErrors(true)
    if (inputProblems(input) || busy || notReady) return
    const screen = screenOf(input.pageKey)
    const experimentKey = createExperimentKey()
    setSubmitting(true)
    setStartError(null)
    try {
      const run = await createRun({
        experimentKey,
        variant: 'before',
        goal: { goal: input.goal.trim(), verification: { path: screen.path, text: screen.text, scope: 'page' } },
        persona: { persona: input.persona.trim() },
        maxSteps: STEPS.default,
      })
      navigate(`/runs/${encodeURIComponent(run.runId)}?experimentKey=${encodeURIComponent(experimentKey)}`)
    } catch (error) {
      setStartError(runStartError(error))
      health.reload()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="new-analysis">
      <header className="page-header">
        <h1>고객이 원하는 화면을 잘 찾을까요?</h1>
        <p className="page-lead">AI 고객이 쇼핑몰을 직접 눌러 보고, 어디서 헤매는지 알려 줘요.</p>
      </header>

      <section className="card" aria-label={PAGE_NAMES.diagnose}>
        <CustomerInputs value={input} onChange={setInput} showErrors={showErrors} disabled={submitting} />
        <p className="muted target-line">{SITE.name}(시연용 쇼핑몰)에서 진단해요.</p>
        {busy ? (
          <p role="status" className="busy-notice">
            다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.
            {busyLink ? <> <Link to={busyLink}>보러 가기</Link></> : null}
          </p>
        ) : null}
        {notReady && !busy ? (
          <p role="alert">AI 고객이 아직 준비 중이에요. <button type="button" onClick={health.reload}>다시 확인</button></p>
        ) : null}
        {health.error ? <p role="status">서버에 연결할 수 없어요. <button type="button" onClick={health.reload}>다시 확인</button></p> : null}
        {startError ? <p role="alert" className="error-notice">{startError}</p> : null}
        <button type="button" className="primary" disabled={submitting || busy || notReady} onClick={() => void start()}>
          {submitting ? '시작하는 중' : '진단 시작'}
        </button>
      </section>

    </section>
  )
}

function runStartError(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'RUN_ALREADY_ACTIVE') return '다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.'
    if (error.message.trim()) return error.message
  }
  return '진단을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}
