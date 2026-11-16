import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { isAbortError, isApiError } from '../../api/client.ts'
import { getPresets } from '../../api/presets.ts'
import { createRun, getRun, listRuns } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Preset, Run, RunListItem, Variant } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, isSupportedUrl, SITE, STEPS, VERSIONS } from './constants.ts'
import './new-analysis.css'

type Results = Record<Variant, RunListItem | null>
type LoadState = 'loading' | 'ready' | 'error'
const emptyResults: Results = { before: null, after: null }

export function NewAnalysisPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const experimentKey = params.get('experimentKey') ?? ''
  const [siteUrl, setSiteUrl] = useState<string>(SITE.urls[0])
  const [preset, setPreset] = useState<Preset | null>(null)
  const [presetError, setPresetError] = useState<unknown>(null)
  const [presetVersion, setPresetVersion] = useState(0)
  const [goalId, setGoalId] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [maxSteps, setMaxSteps] = useState<number>(STEPS.default)
  const [results, setResults] = useState<Results>(emptyResults)
  const [listState, setListState] = useState<Record<Variant, LoadState>>({ before: 'ready', after: 'ready' })
  const [listVersion, setListVersion] = useState(0)
  const [firstRun, setFirstRun] = useState<Run | null>(null)
  const [firstRunState, setFirstRunState] = useState<LoadState>('ready')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [compareA, setCompareA] = useState<Variant>('before')
  const [compareB, setCompareB] = useState<Variant>('after')
  const health = useHealth()

  useEffect(() => {
    const controller = new AbortController()
    getPresets(controller.signal).then((data) => {
      setPreset(data)
      setGoalId((current) => data.goals.some((g) => g.goalId === current) ? current : data.goals[0]?.goalId ?? '')
      setPersonaId((current) => data.personas.some((p) => p.personaId === current) ? current : data.personas[0]?.personaId ?? '')
      setPresetError(null)
    }).catch((error: unknown) => { if (!isAbortError(error)) setPresetError(error) })
    return () => controller.abort()
  }, [presetVersion])

  useEffect(() => {
    const controller = new AbortController()
    if (!experimentKey) return () => controller.abort()
    for (const { variant } of VERSIONS) {
      listRuns({ experimentKey, variant }, controller.signal).then((items) => {
        setResults((prev) => ({ ...prev, [variant]: items[0] ?? null }))
        setListState((prev) => ({ ...prev, [variant]: 'ready' }))
      }).catch((error: unknown) => {
        if (!isAbortError(error)) setListState((prev) => ({ ...prev, [variant]: 'error' }))
      })
    }
    return () => controller.abort()
  }, [experimentKey, listVersion])

  const firstId = results.before?.runId ?? results.after?.runId
  useEffect(() => {
    const controller = new AbortController()
    if (!firstId || !experimentKey) return () => controller.abort()
    getRun(firstId, controller.signal).then((run) => {
      setFirstRun(run)
      setFirstRunState('ready')
    }).catch((error: unknown) => { if (!isAbortError(error)) setFirstRunState('error') })
    return () => controller.abort()
  }, [firstId, experimentKey])

  const validSite = isSupportedUrl(siteUrl)
  const validSteps = Number.isInteger(maxSteps) && maxSteps >= STEPS.min && maxSteps <= STEPS.max
  const anyLoading = listState.before === 'loading' || listState.after === 'loading'
  const listFailed = listState.before === 'error' || listState.after === 'error'
  const activeRun = health.health?.activeRunId
  const firstPending = !!firstId && (firstRunState !== 'ready' || firstRun?.runId !== firstId)
  const anyRunning = Object.values(results).some((run) => run && !isTerminalStatus(run.status))
  const ready = !!preset && !!goalId && !!personaId && validSite && validSteps && !submitting && !health.loading && !activeRun && !anyLoading && !listFailed && !firstPending && !anyRunning
  const bothFinished = !!results.before && !!results.after && isTerminalStatus(results.before.status) && isTerminalStatus(results.after.status)

  function selectExperiment(key: string) {
    setResults(emptyResults)
    setFirstRun(null)
    setFirstRunState('loading')
    setListState({ before: 'loading', after: 'loading' })
    setSubmitError(null)
    setParams(key ? { experimentKey: key } : {})
    if (!key) { setListState({ before: 'ready', after: 'ready' }); setFirstRunState('ready') }
  }

  async function start(variant: Variant) {
    if (!ready) return
    const key = experimentKey || createExperimentKey()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const run = await createRun({ experimentKey: key, variant, goalId: firstRun?.goalId ?? goalId, personaId: firstRun?.personaId ?? personaId, maxSteps: firstRun?.maxSteps ?? maxSteps })
      navigate(`/runs/${encodeURIComponent(run.runId)}?experimentKey=${encodeURIComponent(key)}`)
    } catch (error) {
      setSubmitError(error)
      if (!experimentKey) selectExperiment(key)
      setSubmitError(error)
      health.reload()
      setListVersion((v) => v + 1)
    } finally { setSubmitting(false) }
  }

  const code = isApiError(submitError) ? submitError.code : null
  return (
    <section className="new-analysis">
      <h1>새 UX 분석</h1>
      <p>{SITE.name}의 두 버전을 같은 조건으로 분석합니다.</p>
      <label>웹사이트 주소 <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} /></label>
      {!validSite && <p role="alert">지원하지 않는 웹사이트</p>}
      <p>지원 주소: {SITE.urls.join(', ')}</p>
      <label>실험 키 <input value={experimentKey} placeholder="새 실험은 비워 두세요" onChange={(e) => selectExperiment(e.target.value)} /></label>
      <button type="button" onClick={() => selectExperiment('')}>새 실험</button>
      <p>기존 실험 키를 입력하면 서버에서 실행 기록과 분석 조건을 불러옵니다.</p>
      {presetError ? <ErrorNotice error={presetError} onRetry={() => setPresetVersion((v) => v + 1)} /> : !preset ? <p>프리셋을 불러오는 중입니다.</p> : !preset.goals.length || !preset.personas.length ? <p role="alert">선택할 목표 또는 사용자 유형이 없어 분석을 시작할 수 없습니다.</p> : null}
      <fieldset disabled={!preset || !!firstId}>
        <legend>분석 조건</legend>
        <label>목표 <select value={firstRun?.goalId ?? goalId} onChange={(e) => setGoalId(e.target.value)}>{preset?.goals.map((g) => <option key={g.goalId} value={g.goalId}>{g.goal}</option>)}</select></label>
        <label>사용자 유형 <select value={firstRun?.personaId ?? personaId} onChange={(e) => setPersonaId(e.target.value)}>{preset?.personas.map((p) => <option key={p.personaId} value={p.personaId}>{p.persona}</option>)}</select></label>
        <label>최대 탐색 횟수 <input type="number" min={STEPS.min} max={STEPS.max} value={firstRun?.maxSteps ?? maxSteps} onChange={(e) => setMaxSteps(e.target.value === '' ? NaN : Number(e.target.value))} /></label>
      </fieldset>
      {!validSteps && <p role="alert">최대 탐색 횟수는 1~15 사이의 정수여야 합니다.</p>}
      {firstRunState === 'error' && <p role="alert">기존 분석 조건을 확인할 수 없습니다. 실험 키를 다시 입력해 주세요.</p>}
      {activeRun && <p role="alert">다른 분석이 실행 중입니다. <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link></p>}
      {!!health.error && <p>엔진 상태를 확인할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {submitError ? <div role="alert">{code === 'RUN_ALREADY_ACTIVE' ? <p>다른 분석이 실행 중입니다. {activeRun && <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link>}</p> : code === 'EXPERIMENT_RUN_EXISTS' ? <p>같은 버전의 실행이 이미 있습니다. {Object.values(results).filter((r): r is RunListItem => !!r).map((r) => <Link key={r.runId} to={`/runs/${encodeURIComponent(r.runId)}/result`}>{r.runId} 결과 보기 </Link>)}</p> : code === 'CONTRACT_VALIDATION_ERROR' ? <p>입력한 분석 조건을 확인해 주세요.</p> : isApiError(submitError) && submitError.status === 503 ? <p>실행 환경을 준비하지 못했습니다. 다시 시도해 주세요.</p> : <ErrorNotice error={submitError} />}</div> : null}
      <h2>버전</h2>
      <div className="version-list">{VERSIONS.map(({ variant, name, change }) => {
        const run = results[variant]
        return <article key={variant}><h3>{name}</h3><p>{change}</p>{listState[variant] === 'loading' ? <p>실행 기록 조회 중</p> : listState[variant] === 'error' ? <p>실행 기록: 확인 불가</p> : run ? <><p>마지막 Run: <Link to={`/runs/${encodeURIComponent(run.runId)}`}>{run.runId}</Link> <ResultOriginBadge origin={run.resultOrigin} /></p><p>분석 상태: {run.status}</p><p>목표 화면 도달: {run.goalReached === null ? '확인 불가' : run.goalReached ? '도달' : '미도달'}</p></> : <p>실행 기록 없음</p>}<button type="button" disabled={!ready || (variant === 'after' && !results.before) || (!!run && run.validity !== 'INVALID')} onClick={() => void start(variant)}>분석 시작</button></article>
      })}</div>
      {listFailed && <button type="button" onClick={() => { setListState({ before: 'loading', after: 'loading' }); setListVersion((v) => v + 1) }}>실행 기록 다시 조회</button>}
      <button type="button" disabled>+ 버전 추가</button> <span>v3 (준비 중)</span>
      <h2>버전 비교</h2>
      <label>첫 번째 버전 <select value={compareA} onChange={(e) => setCompareA(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
      <label>두 번째 버전 <select value={compareB} onChange={(e) => setCompareB(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
      {compareA === compareB && <p role="alert">서로 다른 버전을 선택해 주세요.</p>}
      <button type="button" disabled={!bothFinished || compareA === compareB || !experimentKey} onClick={() => navigate(`/comparisons/${encodeURIComponent(experimentKey)}`)}>비교하기</button>
    </section>
  )
}
