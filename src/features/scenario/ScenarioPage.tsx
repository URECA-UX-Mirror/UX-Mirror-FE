import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isAbortError, isApiError } from '../../api/client.ts'
import { createRun } from '../../api/runs.ts'
import { listSites } from '../../api/sites.ts'
import type { Site } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, INPUT_LIMITS, STEPS } from '../new-analysis/constants.ts'
import { GOAL_EXAMPLES, NO_SITE_MAP_NOTICE, PERSONA_EXAMPLE } from './constants.ts'
import './scenario.css'

type SiteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sites: Site[] }

const isSentence = (text: string) => text.trim() !== '' && text.trim().length <= INPUT_LIMITS.sentence

export function ScenarioPage() {
  const navigate = useNavigate()
  const health = useHealth()
  const [siteState, setSiteState] = useState<SiteState>({ status: 'loading' })
  const [siteVersion, setSiteVersion] = useState(0)
  const [siteId, setSiteId] = useState('')
  const [pageKey, setPageKey] = useState('')
  const [goalText, setGoalText] = useState('')
  const [personaText, setPersonaText] = useState('')
  const [maxSteps, setMaxSteps] = useState<number | ''>(STEPS.default)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)

  useEffect(() => {
    const controller = new AbortController()
    listSites(controller.signal)
      .then((sites) => { if (!controller.signal.aborted) setSiteState({ status: 'ready', sites }) })
      .catch((error: unknown) => { if (!controller.signal.aborted && !isAbortError(error)) setSiteState({ status: 'error' }) })
    return () => controller.abort()
  }, [siteVersion])

  const reloadSites = useCallback(() => {
    setSiteState({ status: 'loading' })
    setSiteVersion((v) => v + 1)
  }, [])

  const sites = siteState.status === 'ready' ? siteState.sites : []
  const site = sites.find((s) => s.siteId === siteId) ?? sites[0] ?? null
  // 서버가 정한 `goalSelectable`만 따른다. 도착 화면 목록을 프론트가 따로 정하지 않는다
  const goalPages = site?.pages.filter((p) => p.goalSelectable && p.goalText !== null) ?? []
  const page = goalPages.find((p) => p.pageKey === pageKey) ?? null
  const validSteps = typeof maxSteps === 'number' && Number.isInteger(maxSteps) && maxSteps >= STEPS.min && maxSteps <= STEPS.max
  const activeRun = health.health?.activeRunId
  const engineNotReady = health.health !== null && health.health.status !== 'READY'
  const ready = !!site && !!page?.goalText && isSentence(goalText) && isSentence(personaText) && validSteps
    && !submitting && !health.loading && health.health?.status === 'READY' && !activeRun

  function selectSite(id: string) {
    setSiteId(id)
    setPageKey('')
    setSubmitError(null)
  }

  async function start() {
    if (!ready || !site || !page?.goalText) return
    setSubmitting(true)
    setSubmitError(null)
    const experimentKey = createExperimentKey()
    try {
      const run = await createRun({
        experimentKey,
        variant: 'before',
        siteId: site.siteId,
        goal: { goal: goalText.trim(), verification: { path: page.path, text: page.goalText } },
        persona: { persona: personaText.trim() },
        maxSteps: typeof maxSteps === 'number' ? maxSteps : undefined,
      })
      navigate(`/runs/${encodeURIComponent(run.runId)}?experimentKey=${encodeURIComponent(experimentKey)}`)
    } catch (error) {
      setSubmitError(error)
      health.reload()
    } finally { setSubmitting(false) }
  }

  const code = isApiError(submitError) ? submitError.code : null
  const adjustSteps = (delta: number) => setMaxSteps(Math.min(STEPS.max, Math.max(STEPS.min, (typeof maxSteps === 'number' ? maxSteps : STEPS.default) + delta)))

  return (
    <section className="scenario">
      <header className="page-header">
        <h1>시나리오 테스트</h1>
        <p className="page-lead">등록된 사이트에서 사용자 상황을 문장으로 적고, AI가 도착 화면까지 찾아가는 과정을 확인합니다.</p>
      </header>

      <section className="card" aria-label="사이트">
        <h2>사이트</h2>
        {siteState.status === 'loading' && <p role="status">사이트 목록을 불러오는 중입니다.</p>}
        {siteState.status === 'error' && <p role="alert">사이트 목록을 불러오지 못했습니다. <button type="button" onClick={reloadSites}>다시 시도</button></p>}
        {siteState.status === 'ready' && sites.length === 0 && <p role="status">시나리오 테스트에 쓸 수 있는 사이트가 없습니다. <button type="button" onClick={reloadSites}>다시 확인</button></p>}
        {site && (
          <div className="field">
            <label htmlFor="scenario-site">사이트 선택</label>
            <select id="scenario-site" value={site.siteId} onChange={(e) => selectSite(e.target.value)}>
              {sites.map((s) => <option key={s.siteId} value={s.siteId}>{s.name}</option>)}
            </select>
          </div>
        )}
        {site && !site.siteMapAvailable && <p role="status" className="site-warning">{NO_SITE_MAP_NOTICE}</p>}
      </section>

      {site && (
        <fieldset className="card">
          <legend>시나리오 조건</legend>
          <p className="muted">메뉴 이름 대신 사용자 상황으로 적어 주세요. 예: {GOAL_EXAMPLES.join(' / ')}</p>
          <SentenceInput title="상황 문장(목표)" label="상황 문장" placeholder={`예: ${GOAL_EXAMPLES[0]}`} value={goalText} onChange={(t) => { setGoalText(t); setSubmitError(null) }} />
          <SentenceInput title="사용자 유형" label="사용자 유형 문장" placeholder={`예: ${PERSONA_EXAMPLE}`} value={personaText} onChange={(t) => { setPersonaText(t); setSubmitError(null) }} />
          <div className="field">
            <label htmlFor="scenario-page">도착 화면</label>
            <select id="scenario-page" value={page?.pageKey ?? ''} onChange={(e) => { setPageKey(e.target.value); setSubmitError(null) }}>
              <option value="">도착 화면을 선택해 주세요</option>
              {goalPages.map((p) => <option key={p.pageKey} value={p.pageKey}>{p.label}</option>)}
            </select>
            {goalPages.length === 0 && <span role="status" className="muted">이 사이트에는 도착 화면으로 고를 수 있는 화면이 없습니다.</span>}
          </div>
          <div className="steps-row">
            <div>
              <label htmlFor="scenario-steps">최대 탐색 횟수</label>
              <p className="muted">허용 범위: {STEPS.min}~{STEPS.max}회</p>
            </div>
            <div className="stepper">
              <button type="button" aria-label="탐색 횟수 줄이기" disabled={typeof maxSteps === 'number' && maxSteps <= STEPS.min} onClick={() => adjustSteps(-1)}>-</button>
              <input id="scenario-steps" type="number" min={STEPS.min} max={STEPS.max} value={maxSteps} onChange={(e) => setMaxSteps(e.target.value === '' ? '' : Number(e.target.value))} />
              <button type="button" aria-label="탐색 횟수 늘리기" disabled={typeof maxSteps === 'number' && maxSteps >= STEPS.max} onClick={() => adjustSteps(1)}>+</button>
            </div>
          </div>
          {!validSteps && <p role="alert">최대 탐색 횟수는 {STEPS.min}~{STEPS.max} 사이의 정수여야 합니다.</p>}
        </fieldset>
      )}

      {engineNotReady && !health.loading && <p role="alert">엔진이 준비되지 않아 시작할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {activeRun && <p role="alert">다른 분석이 실행 중입니다. <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link></p>}
      {!!health.error && <p role="status">엔진 상태를 확인할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {submitError ? (
        code === 'CONTRACT_VALIDATION_ERROR' && isApiError(submitError)
          ? <div role="alert"><p>{submitError.message || '입력한 시나리오 조건을 확인해 주세요.'}</p><p>입력을 고친 뒤 다시 시작해 주세요.</p></div>
          : code === 'RUN_ALREADY_ACTIVE'
            // 진행 중인 Run 링크는 엔진 상태를 다시 읽은 뒤 위의 `activeRun` 안내가 맡는다
            ? (activeRun ? null : <p role="alert">다른 분석이 실행 중입니다.</p>)
            : isApiError(submitError) && submitError.status === 503
              ? <div role="alert"><p>{submitError.message.trim() || '실행 환경을 준비하지 못했습니다.'}</p>{code === 'BROWSER_ERROR' && <p>Run은 생성되지 않았습니다.</p>}{submitError.retryable && <button type="button" disabled={!ready} onClick={() => void start()}>다시 시도</button>}</div>
              : <ErrorNotice error={submitError} onRetry={ready ? () => void start() : undefined} />
      ) : null}

      <div className="scenario-actions">
        <button type="button" className="primary" disabled={!ready} onClick={() => void start()}>시나리오 시작</button>
      </div>
    </section>
  )
}

function SentenceInput({ title, label, placeholder, value, onChange }: { title: string; label: string; placeholder: string; value: string; onChange: (text: string) => void }) {
  const id = useId()
  const length = value.trim().length
  const max = INPUT_LIMITS.sentence
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{title}</label>
        <small className={length > max ? 'over' : 'muted'}>{length}/{max}자</small>
      </div>
      <input id={id} aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {length > max && <span role="alert" className="field-error">{label}은 {max}자 이하로 입력해 주세요.</span>}
    </div>
  )
}
