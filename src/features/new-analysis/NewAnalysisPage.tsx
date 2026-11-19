import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { isAbortError } from '../../api/client.ts'
import { createRun } from '../../api/runs.ts'
import { listSites } from '../../api/sites.ts'
import type { Site } from '../../domain/types.ts'
import { DEFAULT_PERSONA, GOAL_SCREENS, goalProblem } from '../../shared/customerInput.ts'
import { eulOf } from '../../shared/hangul.ts'
import { MAX_SENTENCE } from '../../shared/inputRules.ts'
import { startFailureMessage } from '../../shared/serverMessage.ts'
import { busyLinkOf, isBusy, useHealth } from '../../shared/useHealth.ts'
import { findSiteByLink, linkHost } from '../scenario/siteLink.ts'
import { createExperimentKey, SITE, STEPS } from './constants.ts'
import { matchScreen, MORO_KEYWORDS, type GoalScreen } from './matchScreen.ts'
import './new-analysis.css'

type SiteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sites: Site[] }

// 첫 예시는 공식 계획의 환불 목표 문장 그대로 (시연 시나리오)
const MORO_EXAMPLES = ['지난주에 산 운동화가 발에 안 맞아서 돌려보내고 돈을 돌려받고 싶다', '배송이 어디쯤인지 궁금해요', '쿠폰이 있는지 보고 싶어요']
const UNREGISTERED = '아직 등록되지 않은 사이트예요. 지금은 등록된 사이트만 진단할 수 있어요.'
const BAD_LINK = '사이트 링크를 확인해 주세요. 예: https://www.example.com'
const PICK_SCREEN = '어느 화면을 찾아야 하나요?'

/** 등록 사이트에서 찾을 수 있는 화면. 서버가 정한 `goalSelectable`만 따른다 */
const screensOf = (site: Site): GoalScreen[] =>
  site.pages.flatMap((p) => (p.goalSelectable && p.goalText !== null ? [{ pageKey: p.pageKey, label: p.label, path: p.path, text: p.goalText }] : []))

/**
 * 첫 화면. 진단할 사이트(기본은 예시 쇼핑몰 MORO MARKET, 주소나 칩으로 등록 사이트)와 하려는 일 한 문장만 받는다.
 * 찾아야 할 화면은 문장의 낱말로 고르고(`matchScreen`), 고르지 못하면 직접 고르게 한다.
 * 고객 유형·확인 글자·최대 클릭 수는 정해진 값으로 채우고, 실험 키는 매번 새로 만든다.
 */
export function NewAnalysisPage() {
  const id = useId()
  const navigate = useNavigate()
  const health = useHealth()
  const [siteState, setSiteState] = useState<SiteState>({ status: 'loading' })
  const [siteVersion, setSiteVersion] = useState(0)
  /** 비어 있으면 MORO MARKET */
  const [link, setLink] = useState('')
  const [goal, setGoal] = useState('')
  /** 직접 고른 화면. 한 번 고르면 문장을 고쳐도 바뀌지 않는다 */
  const [picked, setPicked] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

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
  const useShop = !link.trim()
  const site = useShop ? null : findSiteByLink(sites, link)
  const linkProblem = useShop || site ? null
    : !linkHost(link) ? BAD_LINK
      : siteState.status === 'ready' ? UNREGISTERED : null
  const siteReady = useShop || !!site

  const screens: readonly GoalScreen[] = site ? screensOf(site) : useShop ? GOAL_SCREENS : []
  const matched = matchScreen(goal, screens, site ? {} : MORO_KEYWORDS)
  const screen = screens.find((s) => s.pageKey === (picked ?? matched)) ?? null
  const examples = site
    ? screens.slice(0, 3).map((s) => `${s.label}${eulOf(s.label)} 보고 싶어요`)
    : useShop ? MORO_EXAMPLES : []

  const busy = isBusy(health.health)
  const notReady = !!health.health && health.health.status !== 'READY'
  const busyLink = busyLinkOf(health.health)
  const problem = showErrors ? goalProblem(goal) : null
  // 문장을 적었는데 화면을 고르지 못했거나, "바꾸기"를 눌렀으면 고르는 칸을 보인다
  const showSelect = siteReady && screens.length > 0 && (choosing || (!screen && (goal.trim() !== '' || showErrors)))

  function chooseSite(next: string) {
    setLink(next)
    setPicked(null)
    setChoosing(false)
    setStartError(null)
  }

  async function start(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (!siteReady || !screen || goalProblem(goal) || busy || notReady || submitting) return
    setSubmitting(true)
    setStartError(null)
    try {
      const run = await createRun({
        experimentKey: createExperimentKey(),
        variant: 'before',
        ...(site ? { siteId: site.siteId } : {}),
        goal: {
          goal: goal.trim(),
          verification: site ? { path: screen.path, text: screen.text } : { path: screen.path, text: screen.text, scope: 'page' },
        },
        persona: { persona: DEFAULT_PERSONA },
        maxSteps: STEPS.default,
      })
      navigate(`/runs/${encodeURIComponent(run.runId)}`)
    } catch (error) {
      setStartError(runStartError(error))
      health.reload()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="home">
      <header className="home-head">
        <h1>원하는 화면, 잘 찾아갈까요?</h1>
        <p>AI가 내 사이트를 직접 눌러 보고 알려 줘요.</p>
      </header>

      <form className="home-form" aria-label="새 진단" noValidate onSubmit={(e) => void start(e)}>
        <div className="field">
          <label className="field-head" htmlFor={`${id}-site`}>진단할 사이트</label>
          <input id={`${id}-site`} type="url" inputMode="url" value={link} disabled={submitting} placeholder="내 사이트 주소를 붙여 넣어 주세요" onChange={(e) => chooseSite(e.target.value)} />
          <div className="site-pick">
            <span className="muted">바로 해 보기</span>
            <div className="chip-row" role="group" aria-label="진단할 수 있는 사이트">
              <button type="button" className="chip" aria-pressed={useShop} disabled={submitting} onClick={() => chooseSite('')}>예시 쇼핑몰로 해 보기 ({SITE.name})</button>
              {sites.filter((s) => s.siteUrl).map((s) => (
                <button key={s.siteId} type="button" className="chip" aria-pressed={site?.siteId === s.siteId} disabled={submitting} onClick={() => chooseSite(s.siteUrl ?? '')}>{s.name}</button>
              ))}
            </div>
          </div>
          {useShop || (site && screens.length > 0) ? (
            <span role="status" className="site-chosen">✓ {useShop ? `예시 쇼핑몰 ${SITE.name}` : site?.name}에서 진단해요</span>
          ) : null}
          {linkProblem ? <span role="alert" className="field-error">{linkProblem}</span> : null}
          {!useShop && !site && siteState.status === 'loading' ? <span role="status" className="muted">등록된 사이트인지 확인하는 중이에요.</span> : null}
          {siteState.status === 'error' ? (
            <span role="status" className="muted">
              등록된 사이트 목록을 불러오지 못했어요.{' '}
              <button type="button" className="link-button" onClick={reloadSites}>다시 시도</button>
            </span>
          ) : null}
          {site && screens.length === 0 ? <span role="alert" className="field-error">이 사이트에는 찾을 화면이 아직 없어요.</span> : null}
        </div>

        <div className="field">
          <label className="field-head" htmlFor={`${id}-goal`}>무엇을 하려고 하나요?</label>
          <input id={`${id}-goal`} value={goal} maxLength={MAX_SENTENCE} disabled={submitting} placeholder={examples[0] ? `예: ${examples[0]}` : undefined} onChange={(e) => setGoal(e.target.value)} />
          {problem ? <span role="alert" className="field-error">{problem}</span> : null}
          {examples.length ? (
            <div className="chip-row" role="group" aria-label="예시">
              {examples.map((example) => (
                <button key={example} type="button" className="chip" disabled={submitting} onClick={() => { setGoal(example); setPicked(null); setChoosing(false) }}>{example}</button>
              ))}
            </div>
          ) : null}
          {showSelect ? (
            <label className="home-screen-pick" htmlFor={`${id}-page`}>
              <span>{PICK_SCREEN}</span>
              <select id={`${id}-page`} value={screen?.pageKey ?? ''} disabled={submitting} onChange={(e) => { setPicked(e.target.value || null); setChoosing(false) }}>
                <option value="">화면을 골라 주세요</option>
                {screens.map((s) => <option key={s.pageKey} value={s.pageKey}>{s.label}</option>)}
              </select>
              {showErrors && !screen ? <span role="alert" className="field-error">화면을 골라 주세요.</span> : null}
            </label>
          ) : screen ? (
            <p className="home-screen" role="status">
              찾아야 할 화면: <strong>{screen.label}</strong> ·{' '}
              <button type="button" className="link-button" disabled={submitting} onClick={() => setChoosing(true)}>바꾸기</button>
            </p>
          ) : null}
        </div>

        {busy ? (
          <p role="status" className="notice">
            다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.
            {busyLink ? <> <Link to={busyLink}>보러 가기</Link></> : null}
          </p>
        ) : null}
        {notReady && !busy ? (
          <p role="alert" className="notice">AI가 아직 준비 중이에요. <button type="button" className="link-button" onClick={health.reload}>다시 확인</button></p>
        ) : null}
        {health.error ? <p role="status" className="notice">서버에 연결할 수 없어요. <button type="button" className="link-button" onClick={health.reload}>다시 확인</button></p> : null}
        {startError ? <p role="alert" className="notice">{startError}</p> : null}

        <button type="submit" className="primary" disabled={submitting || busy || notReady || !siteReady || (!!site && screens.length === 0)}>
          {submitting ? '시작하는 중' : '진단 시작'}
        </button>
      </form>
    </section>
  )
}

function runStartError(error: unknown): string {
  return startFailureMessage(error, '진단을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
}
