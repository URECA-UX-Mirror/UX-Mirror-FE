import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createRun } from '../../api/runs.ts'
import { DEFAULT_PERSONA, GOAL_SCREENS, goalProblem } from '../../shared/customerInput.ts'
import { MAX_SENTENCE } from '../../shared/inputRules.ts'
import { startFailureMessage } from '../../shared/serverMessage.ts'
import { busyLinkOf, isBusy, useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, SITE, STEPS } from './constants.ts'
import { matchScreen, MORO_KEYWORDS } from './matchScreen.ts'
import './new-analysis.css'

// 예시는 시연 시나리오 하나: 공식 계획의 환불 목표 문장 그대로 (헤맴 → '이용정보' → '주문 환불' → 도착이 확인된 문장)
const MORO_EXAMPLES = ['지난주에 산 운동화가 발에 안 맞아서 돌려보내고 돈을 돌려받고 싶다']
const PICK_SCREEN = '어느 화면을 찾아야 하나요?'

/** 배포 서버 진단에서 찍은 MORO MARKET 첫 화면 (정적 파일, 서버가 꺼져 있어도 보인다) */
const SHOP_PREVIEW = '/moro-market-home.jpg'

/**
 * 첫 화면. 시연용 예시 쇼핑몰 MORO MARKET 하나로 고정하고(#103), 하려는 일 한 문장만 받는다.
 * 쇼핑몰이 어떤 곳인지 첫 화면 스크린샷으로 보여 준다.
 * 찾아야 할 화면은 문장의 낱말로 고르고(`matchScreen`), 고르지 못하면 직접 고르게 한다.
 * 고객 유형·확인 글자·최대 클릭 수는 정해진 값으로 채우고, 실험 키는 매번 새로 만든다.
 */
export function NewAnalysisPage() {
  const id = useId()
  const navigate = useNavigate()
  const health = useHealth()
  const [goal, setGoal] = useState('')
  /** 직접 고른 화면. 한 번 고르면 문장을 고쳐도 바뀌지 않는다 */
  const [picked, setPicked] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)

  const screens = GOAL_SCREENS
  const matched = matchScreen(goal, screens, MORO_KEYWORDS)
  const screen = screens.find((s) => s.pageKey === (picked ?? matched)) ?? null
  const examples = MORO_EXAMPLES

  const busy = isBusy(health.health)
  const notReady = !!health.health && health.health.status !== 'READY'
  const busyLink = busyLinkOf(health.health)
  const problem = showErrors ? goalProblem(goal) : null
  // 문장을 적었는데 화면을 고르지 못했거나, "바꾸기"를 눌렀으면 고르는 칸을 보인다
  const showSelect = (choosing || (!screen && (goal.trim() !== '' || showErrors)))

  async function start(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (!screen || goalProblem(goal) || busy || notReady || submitting) return
    setSubmitting(true)
    setStartError(null)
    try {
      const run = await createRun({
        experimentKey: createExperimentKey(),
        variant: 'before',
        goal: {
          goal: goal.trim(),
          verification: { path: screen.path, text: screen.text, scope: 'page' },
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
        <p>AI가 쇼핑몰을 직접 눌러 보고, 어디서 헤매는지와 어떻게 바꾸면 좋을지 알려 줘요.</p>
      </header>

      <form className="home-form" aria-label="새 진단" noValidate onSubmit={(e) => void start(e)}>
        <div className="field">
          <span className="field-head">진단할 사이트</span>
          <div className="shop-card">
            <button type="button" className="shop-thumb" aria-label={`${SITE.name} 첫 화면 크게 보기`} onClick={() => setZoom(true)}>
              <img src={SHOP_PREVIEW} alt={`${SITE.name} 첫 화면`} width={1440} height={900} loading="eager" />
            </button>
            <div className="shop-info">
              <strong>예시 쇼핑몰 {SITE.name}</strong>
              <span className="muted">시연용으로 만든 생활용품 쇼핑몰이에요.</span>
              <button type="button" className="link-button" onClick={() => setZoom(true)}>첫 화면 크게 보기</button>
            </div>
          </div>
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

        <button type="submit" className="primary" disabled={submitting || busy || notReady}>
          {submitting ? '시작하는 중' : '진단 시작'}
        </button>
      </form>

      {zoom ? (
        <div className="shop-zoom" role="dialog" aria-modal="true" aria-label={`${SITE.name} 첫 화면`} onClick={() => setZoom(false)}>
          <img src={SHOP_PREVIEW} alt={`${SITE.name} 첫 화면`} />
          <button type="button" className="shop-zoom-close" onClick={() => setZoom(false)}>닫기</button>
        </div>
      ) : null}
    </section>
  )
}

function runStartError(error: unknown): string {
  return startFailureMessage(error, '진단을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
}
