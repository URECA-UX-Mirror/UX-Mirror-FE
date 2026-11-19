import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isAbortError, isApiError } from '../../api/client.ts'
import { createRun } from '../../api/runs.ts'
import { listSites } from '../../api/sites.ts'
import type { Site } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { MAX_SENTENCE, sentenceProblem } from '../../shared/inputRules.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { busyLinkOf, isBusy, useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, STEPS } from '../new-analysis/constants.ts'
import { GOAL_EXAMPLES, NO_SITE_MAP_NOTICE, PERSONA_EXAMPLE } from './constants.ts'
import { findSiteByLink, linkHost } from './siteLink.ts'
import './scenario.css'

type SiteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sites: Site[] }

export function ScenarioPage() {
  const navigate = useNavigate()
  const health = useHealth()
  const [siteState, setSiteState] = useState<SiteState>({ status: 'loading' })
  const [siteVersion, setSiteVersion] = useState(0)
  const [link, setLink] = useState('')
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
  const site = findSiteByLink(sites, link)
  const linkProblem = !link.trim() ? null : !linkHost(link) ? '사이트 링크를 확인해 주세요. 예: https://www.example.com' : !site ? '아직 등록되지 않은 사이트예요. 등록된 사이트의 링크를 넣어 주세요.' : null
  const examples = sites.filter((s) => s.siteUrl)
  // 서버가 정한 `goalSelectable`만 따른다. 도착 화면 목록을 프론트가 따로 정하지 않는다
  const goalPages = site?.pages.filter((p) => p.goalSelectable && p.goalText !== null) ?? []
  const page = goalPages.find((p) => p.pageKey === pageKey) ?? null
  const validSteps = typeof maxSteps === 'number' && Number.isInteger(maxSteps) && maxSteps >= STEPS.min && maxSteps <= STEPS.max
  const busy = isBusy(health.health)
  const busyLink = busyLinkOf(health.health)
  const engineNotReady = health.health !== null && health.health.status !== 'READY'
  const ready = !!site && !!page?.goalText && !sentenceProblem(goalText, '고객이 하려는 일') && !sentenceProblem(personaText, '고객 유형') && validSteps
    && !submitting && !health.loading && health.health?.status === 'READY' && !busy

  function changeLink(next: string) {
    setLink(next)
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
        <h1>{PAGE_NAMES.otherSite}</h1>
        <p className="page-lead">등록된 다른 사이트에서도 AI 고객이 원하는 화면을 잘 찾아오는지 확인해요.</p>
      </header>

      <section className="card" aria-label="사이트">
        <h2>사이트</h2>
        {siteState.status === 'loading' && <p role="status">사이트 목록을 불러오는 중이에요.</p>}
        {siteState.status === 'error' && <p role="alert">사이트 목록을 불러오지 못했어요. <button type="button" onClick={reloadSites}>다시 시도</button></p>}
        {siteState.status === 'ready' && sites.length === 0 && <p role="status">진단할 수 있는 사이트가 아직 없어요. <button type="button" onClick={reloadSites}>다시 확인</button></p>}
        {siteState.status === 'ready' && sites.length > 0 && (
          <div className="field">
            <label htmlFor="scenario-site">진단할 사이트 링크</label>
            <input id="scenario-site" type="url" inputMode="url" value={link} placeholder={examples[0]?.siteUrl ?? 'https://'} onChange={(e) => changeLink(e.target.value)} />
            {linkProblem ? <span role="alert" className="field-error">{linkProblem}</span> : null}
            {site ? <span role="status" className="muted">{site.name}을(를) 진단해요.</span> : null}
            {examples.length > 0 && !site ? (
              <span className="muted">
                등록된 사이트:{' '}
                {examples.map((s, i) => (
                  <span key={s.siteId}>
                    {i > 0 ? ', ' : ''}
                    <button type="button" className="link-button" onClick={() => changeLink(s.siteUrl ?? '')}>{s.name}</button>
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        )}
        {site && !site.siteMapAvailable && <p role="status" className="site-warning">{NO_SITE_MAP_NOTICE}</p>}
      </section>

      {site && (
        <section className="card" aria-label="고객과 할 일">
          <SentenceInput title="어떤 고객인가요?" label="고객 유형" placeholder={`예: ${PERSONA_EXAMPLE}`} value={personaText} onChange={(t) => { setPersonaText(t); setSubmitError(null) }} />
          <SentenceInput title="고객이 하려는 일" label="고객이 하려는 일" placeholder={`예: ${GOAL_EXAMPLES[0]}`} value={goalText} onChange={(t) => { setGoalText(t); setSubmitError(null) }} />
          <div className="field">
            <label htmlFor="scenario-page">도착하면 성공인 화면</label>
            <select id="scenario-page" value={page?.pageKey ?? ''} onChange={(e) => { setPageKey(e.target.value); setSubmitError(null) }}>
              <option value="">화면을 골라 주세요</option>
              {goalPages.map((p) => <option key={p.pageKey} value={p.pageKey}>{p.label}</option>)}
            </select>
            {goalPages.length === 0 && <span role="status" className="muted">이 사이트에는 고를 수 있는 화면이 없어요.</span>}
          </div>
          <div className="steps-row">
            <div>
              <label htmlFor="scenario-steps">최대 클릭 수</label>
              <p className="muted">{STEPS.min}~{STEPS.max}번</p>
            </div>
            <div className="stepper">
              <button type="button" aria-label="클릭 수 줄이기" disabled={typeof maxSteps === 'number' && maxSteps <= STEPS.min} onClick={() => adjustSteps(-1)}>-</button>
              <input id="scenario-steps" type="number" min={STEPS.min} max={STEPS.max} value={maxSteps} onChange={(e) => setMaxSteps(e.target.value === '' ? '' : Number(e.target.value))} />
              <button type="button" aria-label="클릭 수 늘리기" disabled={typeof maxSteps === 'number' && maxSteps >= STEPS.max} onClick={() => adjustSteps(1)}>+</button>
            </div>
          </div>
          {!validSteps && <p role="alert">최대 클릭 수는 {STEPS.min}~{STEPS.max} 사이 숫자로 적어 주세요.</p>}
        </section>
      )}

      {engineNotReady && !busy && !health.loading && <p role="alert">AI 고객이 아직 준비 중이에요. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {busy && <p role="status" className="busy-notice">다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.{busyLink ? <> <Link to={busyLink}>보러 가기</Link></> : null}</p>}
      {!!health.error && <p role="status">서버에 연결할 수 없어요. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {submitError ? (
        code === 'CONTRACT_VALIDATION_ERROR' && isApiError(submitError)
          ? <div role="alert"><p>{submitError.message || '입력한 내용을 확인해 주세요.'}</p><p>고친 뒤 다시 시작해 주세요.</p></div>
          : code === 'RUN_ALREADY_ACTIVE'
            // 진행 중인 Run 링크는 엔진 상태를 다시 읽은 뒤 위의 진행 중 안내가 맡는다
            ? (busy ? null : <p role="alert">다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.</p>)
            : isApiError(submitError) && submitError.status === 503
              ? <div role="alert"><p>{submitError.message.trim() || '진단을 준비하지 못했어요.'}</p>{code === 'BROWSER_ERROR' && <p>진단은 시작되지 않았어요.</p>}{submitError.retryable && <button type="button" disabled={!ready} onClick={() => void start()}>다시 시도</button>}</div>
              : <ErrorNotice error={submitError} onRetry={ready ? () => void start() : undefined} />
      ) : null}

      <div className="scenario-actions">
        <button type="button" className="primary" disabled={!ready} onClick={() => void start()}>진단 시작</button>
      </div>
    </section>
  )
}

function SentenceInput({ title, label, placeholder, value, onChange }: { title: string; label: string; placeholder: string; value: string; onChange: (text: string) => void }) {
  const id = useId()
  const problem = value.trim() ? sentenceProblem(value, label) : null
  return (
    <div className="field">
      <label htmlFor={id} className="field-head">{title}</label>
      <input id={id} aria-label={label} value={value} maxLength={MAX_SENTENCE} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {problem && <span role="alert" className="field-error">{problem}</span>}
    </div>
  )
}
