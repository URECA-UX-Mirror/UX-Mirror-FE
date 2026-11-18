import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { isAbortError, isApiError } from '../../api/client.ts'
import { createRun, getRun, listRuns } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { GoalInput, PersonaInput, Run, RunListItem, Variant } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { useHealth } from '../../shared/useHealth.ts'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { CompareIcon, GlobeIcon, LayersIcon, SettingsIcon } from '../../shared/icons.tsx'
import { statusLabel } from '../run-progress/statusLabel.ts'
import { createExperimentKey, GOAL_PAGES, INPUT_LIMITS, SCOPES, SITE, STEPS, VERSIONS } from './constants.ts'
import './new-analysis.css'

type Results = Record<Variant, RunListItem[]>
type LoadState = 'loading' | 'ready' | 'error'
type ListResult = { token: string; status: 'ready' | 'error'; runs: RunListItem[] }
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
type Scope = 'page' | 'main'

const isSentence = (text: string, max: number) => text.trim() !== '' && text.trim().length <= max

/**
 * 기존 실험의 첫 Run 입력. 두 번째 버전은 이 값을 그대로 보낸다(같은 실험 키는 입력이 같아야 함).
 * 화면은 직접 입력만 받지만, 예전에 preset ID로 만든 실험은 ID를 그대로 보내야 서버가 같은 입력으로 본다.
 */
function goalInputOf(run: Run): GoalInput | null {
  if (run.goalId) return { goalId: run.goalId }
  const v = run.verification
  if (!v) return null
  const scope = v.scope === 'page' || v.scope === 'main' ? v.scope : undefined
  return { goal: run.goal, verification: { path: v.path, text: v.text, exact: v.exact, ...(scope ? { scope } : {}) } }
}

function personaInputOf(run: Run): PersonaInput {
  return run.personaId ? { personaId: run.personaId } : { persona: run.persona }
}

export function NewAnalysisPage() {
  const location = useLocation()
  return <NewAnalysisContent key={location.key} />
}

function NewAnalysisContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const experimentKey = params.get('experimentKey') ?? ''
  const [keyDraft, setKeyDraft] = useState({ locationKey: location.key, value: experimentKey })
  const keyInput = keyDraft.locationKey === location.key ? keyDraft.value : experimentKey
  const setKeyInput = (value: string) => setKeyDraft({ locationKey: location.key, value })
  // 탐색 목표·사용자 유형·성공 조건은 직접 입력한다 (UX-Mirror-FE #26)
  const [goalText, setGoalText] = useState('')
  const [goalPage, setGoalPage] = useState<string>(GOAL_PAGES[0].path)
  const [goalPageText, setGoalPageText] = useState<string>(GOAL_PAGES[0].text)
  const [goalScope, setGoalScope] = useState<Scope>('page')
  const [personaText, setPersonaText] = useState('')
  const [maxSteps, setMaxSteps] = useState<number | ''>(STEPS.default)
  const [listResults, setListResults] = useState<Partial<Record<Variant, ListResult>>>({})
  const [listVersion, setListVersion] = useState(0)
  const [runResult, setRunResult] = useState<{ token: string; run: Run | null; error: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [attemptedVariant, setAttemptedVariant] = useState<Variant | null>(null)
  // 분석 사이트 입력. 실행 요청 계약에 사이트 필드가 없어 요청에는 싣지 않는다(OI-8)
  const [site, setSite] = useState<string>(SITE.name)
  const [compareA, setCompareA] = useState<Variant>('before')
  const [compareB, setCompareB] = useState<Variant>('after')
  const health = useHealth()

  const validKey = !experimentKey || KEY_PATTERN.test(experimentKey)
  const listToken = JSON.stringify([experimentKey, listVersion, location.key])
  useEffect(() => {
    const controller = new AbortController()
    if (!experimentKey || !KEY_PATTERN.test(experimentKey)) return () => controller.abort()
    for (const { variant } of VERSIONS) {
      listRuns({ experimentKey, variant }, controller.signal).then((items) => {
        if (!controller.signal.aborted) setListResults((prev) => ({ ...prev, [variant]: { token: listToken, status: 'ready', runs: items } }))
      }).catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setListResults((prev) => ({ ...prev, [variant]: { token: listToken, status: 'error', runs: [] } }))
      })
    }
    return () => controller.abort()
  }, [experimentKey, listToken])

  const listState = Object.fromEntries(VERSIONS.map(({ variant }) => [variant,
    !experimentKey ? 'ready' : !validKey ? 'error' : listResults[variant]?.token === listToken ? listResults[variant].status : 'loading',
  ])) as Record<Variant, LoadState>
  const results = Object.fromEntries(VERSIONS.map(({ variant }) => [variant,
    listState[variant] === 'ready' && experimentKey ? listResults[variant]?.runs ?? [] : [],
  ])) as Results
  const validBefore = results.before.find((run) => run.validity === 'VALID')
  const validAfter = results.after.find((run) => run.validity === 'VALID')
  const firstId = (validBefore ?? results.before[0] ?? validAfter ?? results.after[0])?.runId
  const runToken = JSON.stringify([listToken, firstId])
  useEffect(() => {
    const controller = new AbortController()
    if (!firstId || !experimentKey) return () => controller.abort()
    getRun(firstId, controller.signal).then((run) => {
      if (!controller.signal.aborted) setRunResult({ token: runToken, run, error: false })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && !isAbortError(error)) setRunResult({ token: runToken, run: null, error: true })
    })
    return () => controller.abort()
  }, [firstId, experimentKey, runToken])

  const firstRun = runResult?.token === runToken ? runResult.run : null
  const firstRunState: LoadState = !firstId ? 'ready' : runResult?.token !== runToken ? 'loading' : runResult.error ? 'error' : 'ready'
  const effectiveSteps = firstRun?.maxSteps ?? maxSteps
  const validSteps = typeof effectiveSteps === 'number' && Number.isInteger(effectiveSteps) && effectiveSteps >= STEPS.min && effectiveSteps <= STEPS.max
  const anyLoading = listState.before === 'loading' || listState.after === 'loading'
  const listFailed = listState.before === 'error' || listState.after === 'error'
  const activeRun = health.health?.activeRunId
  const engineNotReady = health.health !== null && health.health.status !== 'READY'
  const firstPending = !!firstId && firstRunState !== 'ready'
  const anyRunning = Object.values(results).some((runs) => runs.some((run) => !isTerminalStatus(run.status)))
  // 실행 요청에는 사이트가 없어 대상은 MORO MARKET으로 고정이다. 다른 값이면 시작할 수 없다(OI-8)
  const siteSupported = site.trim().toLowerCase() === SITE.name.toLowerCase()
  const formGoal: GoalInput | null =
    isSentence(goalText, INPUT_LIMITS.sentence) && isSentence(goalPageText, INPUT_LIMITS.verificationText)
      ? { goal: goalText.trim(), verification: { path: goalPage, text: goalPageText.trim(), scope: goalScope } }
      : null
  const formPersona: PersonaInput | null =
    isSentence(personaText, INPUT_LIMITS.sentence) ? { persona: personaText.trim() } : null
  const goalInput = firstRun ? goalInputOf(firstRun) : formGoal
  const personaInput = firstRun ? personaInputOf(firstRun) : formPersona
  const ready = siteSupported && !!goalInput && !!personaInput && validSteps && validKey && keyInput === experimentKey && !submitting && !health.loading && health.health?.status === 'READY' && !activeRun && !anyLoading && !listFailed && !firstPending && !anyRunning
  const bothFinished = !anyLoading && !listFailed && !!validBefore && !!validAfter && isTerminalStatus(validBefore.status) && isTerminalStatus(validAfter.status)

  // 도착 화면을 고르면 그 화면의 제목을 성공 조건 글자로 채운다 (사용자가 고칠 수 있음)
  function selectGoalPage(path: string) {
    setGoalPage(path)
    const page = GOAL_PAGES.find((item) => item.path === path)
    if (page) setGoalPageText(page.text)
  }

  function selectExperiment(key: string) {
    setKeyInput(key)
    setSubmitError(null)
    if (key === experimentKey && key) setListVersion((v) => v + 1)
    else setParams(key ? { experimentKey: key } : {})
  }

  async function start(variant: Variant) {
    if (!ready) return
    const key = experimentKey || createExperimentKey()
    setAttemptedVariant(variant)
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (!goalInput || !personaInput) return
      const run = await createRun({ experimentKey: key, variant, goal: goalInput, persona: personaInput, maxSteps: firstRun?.maxSteps ?? (maxSteps === '' ? undefined : maxSteps) })
      navigate(`/runs/${encodeURIComponent(run.runId)}?experimentKey=${encodeURIComponent(key)}`)
    } catch (error) {
      setSubmitError(error)
      health.reload()
      setListVersion((v) => v + 1)
    } finally { setSubmitting(false) }
  }

  const code = isApiError(submitError) ? submitError.code : null
  const stepValue = firstRun?.maxSteps ?? maxSteps
  function adjustSteps(delta: number) {
    const base = typeof stepValue === 'number' ? stepValue : STEPS.default
    setMaxSteps(Math.min(STEPS.max, Math.max(STEPS.min, base + delta)))
  }

  // 시작을 막는 상태와 오류 안내. 제목 아래에 모아 보인다
  const notices = (
    <>
      {!validSteps && <p role="alert">최대 탐색 횟수는 1~15 사이의 정수여야 합니다.</p>}
      {firstRun && !goalInput && <p role="alert">기존 실험의 성공 조건을 확인할 수 없어 같은 조건으로 실행할 수 없습니다. 새 실험으로 시작해 주세요.</p>}
      {firstRunState === 'error' && <p role="alert">기존 분석 조건을 확인할 수 없습니다. 실험 키를 다시 입력해 주세요.</p>}
      {engineNotReady && !health.loading && <p role="alert">엔진이 준비되지 않아 분석을 시작할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {activeRun && <p role="alert">다른 분석이 실행 중입니다. <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link></p>}
      {!!health.error && <p role="status">엔진 상태를 확인할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {submitError ? <div role="alert">{code === 'RUN_ALREADY_ACTIVE' ? <p>다른 분석이 실행 중입니다. {activeRun && <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link>}</p> : code === 'EXPERIMENT_RUN_EXISTS' ? <p>같은 버전의 실행이 이미 있습니다. {Object.values(results).flat().filter((r) => r.validity === 'VALID').map((r) => <Link key={r.runId} to={`/runs/${encodeURIComponent(r.runId)}/result`}>{r.runId} 결과 보기 </Link>)}</p> : code === 'CONTRACT_VALIDATION_ERROR' ? <><p>{isApiError(submitError) && submitError.message ? submitError.message : '입력한 분석 조건을 확인해 주세요.'}</p><p>입력을 고친 뒤 다시 시작해 주세요.</p></> : code === 'BROWSER_ERROR' && isApiError(submitError) ? <><p>{submitError.message.trim() || '도착 화면을 확인하지 못했습니다'}</p><p>Run은 생성되지 않았습니다.</p>{submitError.retryable && attemptedVariant && <button type="button" disabled={!ready} onClick={() => void start(attemptedVariant)}>다시 시도</button>}</> : isApiError(submitError) && submitError.status === 503 ? <><p>{submitError.message.trim() || '실행 환경을 준비하지 못했습니다.'}</p>{submitError.retryable && attemptedVariant && <button type="button" disabled={!ready} onClick={() => void start(attemptedVariant)}>다시 시도</button>}</> : <ErrorNotice error={submitError} />}</div> : null}
    </>
  )

  return (
    <section className="new-analysis">
      <header className="page-header">
        <h1>새 UX 분석</h1>
        <p className="page-lead">{SITE.name}의 두 버전을 같은 조건으로 분석하고 결과를 비교합니다.</p>
      </header>

      <section className="card target-card" aria-label="분석 대상">
        <SectionTitle
          icon={<GlobeIcon />}
          title="분석 대상"
          action={<Link to="/replay" className="section-link">저장된 결과 보기</Link>}
        />
        <div className="target-site">
          <label htmlFor="target-site-input">분석 사이트</label>
          <input
            id="target-site-input"
            value={site}
            placeholder={SITE.name}
            maxLength={120}
            onChange={(e) => setSite(e.target.value)}
          />
        </div>
        <p className="muted">
          현재는 각 버전에 맞는 {SITE.name} 테스트 사이트만 분석할 수 있습니다. 입력한 값은 아직 분석 요청에 반영되지 않습니다.
        </p>
        {!siteSupported && (
          <p role="alert" className="site-warning">
            {site.trim() === '' ? '분석 사이트를 입력해 주세요.' : `분석할 수 없는 사이트입니다. ${SITE.name}만 분석할 수 있습니다.`}
          </p>
        )}
      </section>

      <section className="card" aria-label="실험">
        <SectionTitle icon={<CompareIcon />} title="실험" aside="실험 키 하나로 두 버전이 묶입니다" />
        <div className="key-row">
          <label>실험 키 <input value={keyInput} placeholder="새 실험은 비워 두세요" onChange={(e) => setKeyInput(e.target.value)} /></label>
          <button type="button" disabled={!KEY_PATTERN.test(keyInput)} onClick={() => selectExperiment(keyInput)}>조회</button>
          <button type="button" onClick={() => selectExperiment('')}>새 실험</button>
        </div>
        {!!keyInput && !KEY_PATTERN.test(keyInput) && <p role="alert">실험 키는 영문, 숫자, 밑줄, 하이픈으로 1~64자 입력해 주세요.</p>}
        {!validKey && <p role="alert">주소의 실험 키가 올바르지 않습니다.</p>}
        <p className="muted">기존 실험 키를 입력하면 서버에서 실행 기록과 분석 조건을 불러옵니다.</p>
      </section>

      {notices}

      <fieldset className="card" disabled={!!firstId}>
        <legend>
          <span className="section-icon"><SettingsIcon /></span>
          분석 조건
          <span className="section-aside">{firstId ? '기존 실험의 조건으로 고정됩니다' : '두 버전에 같은 조건이 적용됩니다'}</span>
        </legend>
        <div className="conditions-grid">
          <div className="condition-tile">
            <SentenceInput title="탐색 목표" label="탐색 목표 문장" placeholder="예: 최근 구매한 상품의 환불 신청 화면 찾기" value={firstRun ? firstRun.goal : goalText} onChange={setGoalText} />
          </div>
          <div className="condition-tile">
            <SentenceInput title="사용자 유형" label="사용자 유형 문장" placeholder="예: 온라인 쇼핑몰 이용 경험이 적은 사용자" value={firstRun ? firstRun.persona : personaText} onChange={setPersonaText} />
          </div>
        </div>
        <fieldset className="verification-box">
          <legend>성공 조건</legend>
          <p className="verification-lead">도착 화면에서 아래 글자가 보이면 목표에 도달한 것으로 판정합니다.</p>
          <div className="verification-grid">
            <label className="field">
              <span className="field-head"><span>도착 화면</span></span>
              <select value={firstRun?.verification?.path ?? goalPage} onChange={(e) => selectGoalPage(e.target.value)}>
                {GOAL_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label} ({p.path})</option>)}
                {firstRun?.verification && !GOAL_PAGES.some((p) => p.path === firstRun.verification?.path) && <option value={firstRun.verification.path}>{firstRun.verification.path}</option>}
              </select>
            </label>
            <SentenceInput title="화면에 보여야 할 글자" label="화면에 보여야 할 글자" placeholder="예: 환불 / 반품 신청" max={INPUT_LIMITS.verificationText} value={firstRun?.verification?.text ?? goalPageText} onChange={setGoalPageText} />
            <label className="field">
              <span className="field-head"><span>찾는 범위</span></span>
              <select value={firstRun?.verification?.scope ?? goalScope} onChange={(e) => setGoalScope(e.target.value as Scope)}>
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <p className="muted verification-note">직접 입력한 목표는 사이트 지도를 기준으로 최단 경로 대비 추가 단계·우회 이동·목표 경로 확률을 계산합니다. 사이트 지도를 쓸 수 없으면 계산하지 않습니다.</p>
        </fieldset>
        <div className="steps-row">
          <div>
            <label htmlFor="max-steps" className="steps-label">최대 탐색 횟수</label>
            <p className="muted">AI가 목표 화면을 탐색할 때 허용되는 최대 단계 수입니다. (허용 범위: {STEPS.min}~{STEPS.max}회)</p>
          </div>
          <div className="stepper">
            <button type="button" aria-label="탐색 횟수 줄이기" disabled={typeof stepValue === 'number' && stepValue <= STEPS.min} onClick={() => adjustSteps(-1)}>-</button>
            <input id="max-steps" type="number" min={STEPS.min} max={STEPS.max} value={stepValue} onChange={(e) => setMaxSteps(e.target.value === '' ? '' : Number(e.target.value))} />
            <button type="button" aria-label="탐색 횟수 늘리기" disabled={typeof stepValue === 'number' && stepValue >= STEPS.max} onClick={() => adjustSteps(1)}>+</button>
          </div>
        </div>
      </fieldset>

      <section className="card" aria-label="버전별 분석">
        <SectionTitle
          icon={<LayersIcon />}
          title="버전별 분석"
          aside="분석할 버전을 선택하고 AI 탐색을 실행합니다"
          action={<button type="button" disabled title="P0에서는 두 버전 비교만 지원합니다">+ 버전 추가</button>}
        />
        <div className="comparison-table-scroll">
          <table className="version-table">
            <thead>
              <tr>
                <th scope="col">버전</th>
                <th scope="col">변경 내용</th>
                <th scope="col">마지막 Run</th>
                <th scope="col">분석 상태</th>
                <th scope="col">실행 유효성</th>
                <th scope="col">목표 화면 도달</th>
                <th scope="col" className="col-action">작업</th>
              </tr>
            </thead>
            <tbody>
              {VERSIONS.map(({ variant, name, change }) => {
                const runs = results[variant]
                const run = runs[0]
                const validRun = variant === 'before' ? validBefore : validAfter
                const canCreate = runs.every((item) => item.validity === 'INVALID')
                const state = listState[variant]
                return (
                  <tr key={variant} data-variant={variant}>
                    <th scope="row"><span className="version-dot" data-variant={variant} />{name}</th>
                    <td><span className="change-chip" data-variant={variant}>{change}</span></td>
                    {state === 'loading' ? (
                      <td colSpan={4} className="muted">실행 기록 조회 중</td>
                    ) : state === 'error' ? (
                      <td colSpan={4} className="muted">실행 기록: 확인 불가</td>
                    ) : run ? (
                      <>
                        <td><Link to={`/runs/${encodeURIComponent(run.runId)}`} className="run-id">{run.runId}</Link> <ResultOriginBadge origin={run.resultOrigin} /></td>
                        <td>{statusLabel({ status: run.status, error: null })}</td>
                        <td>
                          {run.validity ?? '확인 중'}
                          {run.validity === 'INVALID' && (validRun ? <small className="cell-note">이전 유효 Run: <Link to={`/runs/${encodeURIComponent(validRun.runId)}/result`}>{validRun.runId}</Link></small> : <small className="cell-note">유효한 실행이 없습니다. 재분석해 주세요.</small>)}
                        </td>
                        <td>{run.goalReached === null ? '확인 불가' : run.goalReached ? '도달' : '미도달'}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="muted">실행 기록 없음</td>
                    )}
                    <td className="col-action">
                      {run && state === 'ready' ? <Link to={isTerminalStatus(run.status) ? `/runs/${encodeURIComponent(run.runId)}/result` : `/runs/${encodeURIComponent(run.runId)}`}>{isTerminalStatus(run.status) ? '결과 보기' : '진행 보기'}</Link> : null}
                      <button type="button" className="primary" disabled={!ready || (variant === 'after' && !validBefore) || !canCreate} onClick={() => void start(variant)}>분석 시작</button>
                    </td>
                  </tr>
                )
              })}
              <tr className="row-future">
                <th scope="row"><span className="version-dot" />v3 (예정)</th>
                <td colSpan={5}>상단 GNB 직관 검색 바 통합</td>
                <td className="col-action"><button type="button" disabled>비활성</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        {listFailed && validKey && <p><button type="button" onClick={() => setListVersion((v) => v + 1)}>실행 기록 다시 조회</button></p>}
      </section>

      <section className="card" aria-label="버전 비교">
        <SectionTitle icon={<CompareIcon />} title="버전 비교" aside="1:1 차이 분석" />
        <p className="muted">두 버전의 AI 탐색 결과를 비교합니다. 같은 조건으로 분석이 끝난 두 버전을 골라 주세요.</p>
        <div className="compare-row">
          <label>첫 번째 버전 <select value={compareA} onChange={(e) => setCompareA(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
          <label>두 번째 버전 <select value={compareB} onChange={(e) => setCompareB(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
          <button type="button" className="primary" disabled={!bothFinished || compareA === compareB || !experimentKey || keyInput !== experimentKey} onClick={() => navigate(`/comparisons/${encodeURIComponent(experimentKey)}`)}>비교하기</button>
        </div>
        {compareA === compareB && <p role="alert">서로 다른 버전을 선택해 주세요.</p>}
      </section>
    </section>
  )
}

function SentenceInput({ title, label, placeholder, value, onChange, max = INPUT_LIMITS.sentence }: { title: string; label: string; placeholder: string; value: string; onChange: (text: string) => void; max?: number }) {
  const length = value.trim().length
  return (
    <div className="field">
      <div className="field-head">
        <span>{title}</span>
        <small className={length > max ? 'over' : 'muted'}>{length}/{max}자</small>
      </div>
      <input aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {length > max && <span role="alert" className="field-error">{label}은 {max}자 이하로 입력해 주세요.</span>}
    </div>
  )
}
