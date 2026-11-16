import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { isAbortError, isApiError } from '../../api/client.ts'
import { getPresets } from '../../api/presets.ts'
import { createRun, getRun, listRuns } from '../../api/runs.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import type { Preset, Run, RunListItem, Variant } from '../../domain/types.ts'
import { ErrorNotice } from '../../shared/ErrorNotice.tsx'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { useHealth } from '../../shared/useHealth.ts'
import { createExperimentKey, SITE, STEPS, VERSIONS } from './constants.ts'
import './new-analysis.css'

type Results = Record<Variant, RunListItem[]>
type LoadState = 'loading' | 'ready' | 'error'
type ListResult = { token: string; status: 'ready' | 'error'; runs: RunListItem[] }
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

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
  const [preset, setPreset] = useState<Preset | null>(null)
  const [presetError, setPresetError] = useState<unknown>(null)
  const [presetVersion, setPresetVersion] = useState(0)
  const [goalId, setGoalId] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [maxSteps, setMaxSteps] = useState<number | ''>(STEPS.default)
  const [listResults, setListResults] = useState<Partial<Record<Variant, ListResult>>>({})
  const [listVersion, setListVersion] = useState(0)
  const [runResult, setRunResult] = useState<{ token: string; run: Run | null; error: boolean } | null>(null)
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
  const ready = !!preset && !!goalId && !!personaId && validSteps && validKey && keyInput === experimentKey && !submitting && !health.loading && health.health?.status === 'READY' && !activeRun && !anyLoading && !listFailed && !firstPending && !anyRunning
  const bothFinished = !anyLoading && !listFailed && !!validBefore && !!validAfter && isTerminalStatus(validBefore.status) && isTerminalStatus(validAfter.status)

  function selectExperiment(key: string) {
    setKeyInput(key)
    setSubmitError(null)
    if (key === experimentKey && key) setListVersion((v) => v + 1)
    else setParams(key ? { experimentKey: key } : {})
  }

  async function start(variant: Variant) {
    if (!ready) return
    const key = experimentKey || createExperimentKey()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const run = await createRun({ experimentKey: key, variant, goalId: firstRun?.goalId ?? goalId, personaId: firstRun?.personaId ?? personaId, maxSteps: firstRun?.maxSteps ?? (maxSteps === '' ? undefined : maxSteps) })
      navigate(`/runs/${encodeURIComponent(run.runId)}?experimentKey=${encodeURIComponent(key)}`)
    } catch (error) {
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
      <p><Link to="/replay">저장된 결과 보기</Link></p>
      <p>분석 사이트: {SITE.name}. 각 버전의 분석을 시작하면 해당 버전의 사이트가 사용됩니다.</p>
      <label>실험 키 <input value={keyInput} placeholder="새 실험은 비워 두세요" onChange={(e) => setKeyInput(e.target.value)} /></label>
      <button type="button" disabled={!KEY_PATTERN.test(keyInput)} onClick={() => selectExperiment(keyInput)}>조회</button>
      {!!keyInput && !KEY_PATTERN.test(keyInput) && <p role="alert">실험 키는 영문, 숫자, 밑줄, 하이픈으로 1~64자 입력해 주세요.</p>}
      {!validKey && <p role="alert">주소의 실험 키가 올바르지 않습니다.</p>}
      <button type="button" onClick={() => selectExperiment('')}>새 실험</button>
      <p>기존 실험 키를 입력하면 서버에서 실행 기록과 분석 조건을 불러옵니다.</p>
      {presetError ? <ErrorNotice error={presetError} onRetry={() => setPresetVersion((v) => v + 1)} /> : !preset ? <p>프리셋을 불러오는 중입니다.</p> : !preset.goals.length || !preset.personas.length ? <p role="alert">선택할 목표 또는 사용자 유형이 없어 분석을 시작할 수 없습니다.</p> : null}
      <fieldset disabled={!preset || !!firstId}>
        <legend>분석 조건</legend>
        <label>목표 <select value={firstRun?.goalId ?? goalId} onChange={(e) => setGoalId(e.target.value)}>{preset?.goals.map((g) => <option key={g.goalId} value={g.goalId}>{g.goal}</option>)}</select></label>
        <label>사용자 유형 <select value={firstRun?.personaId ?? personaId} onChange={(e) => setPersonaId(e.target.value)}>{preset?.personas.map((p) => <option key={p.personaId} value={p.personaId}>{p.persona}</option>)}</select></label>
        <label>최대 탐색 횟수 <input type="number" min={STEPS.min} max={STEPS.max} value={firstRun?.maxSteps ?? maxSteps} onChange={(e) => setMaxSteps(e.target.value === '' ? '' : Number(e.target.value))} /></label>
      </fieldset>
      {!validSteps && <p role="alert">최대 탐색 횟수는 1~15 사이의 정수여야 합니다.</p>}
      {firstRunState === 'error' && <p role="alert">기존 분석 조건을 확인할 수 없습니다. 실험 키를 다시 입력해 주세요.</p>}
      {engineNotReady && !health.loading && <p role="alert">엔진이 준비되지 않아 분석을 시작할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {activeRun && <p role="alert">다른 분석이 실행 중입니다. <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link></p>}
      {!!health.error && <p>엔진 상태를 확인할 수 없습니다. <button type="button" onClick={health.reload}>다시 확인</button></p>}
      {submitError ? <div role="alert">{code === 'RUN_ALREADY_ACTIVE' ? <p>다른 분석이 실행 중입니다. {activeRun && <Link to={`/runs/${encodeURIComponent(activeRun)}`}>진행 중인 Run 보기</Link>}</p> : code === 'EXPERIMENT_RUN_EXISTS' ? <p>같은 버전의 실행이 이미 있습니다. {Object.values(results).flat().filter((r) => r.validity === 'VALID').map((r) => <Link key={r.runId} to={`/runs/${encodeURIComponent(r.runId)}/result`}>{r.runId} 결과 보기 </Link>)}</p> : code === 'CONTRACT_VALIDATION_ERROR' ? <p>입력한 분석 조건을 확인해 주세요.</p> : isApiError(submitError) && submitError.status === 503 ? <p>실행 환경을 준비하지 못했습니다. 다시 시도해 주세요.</p> : <ErrorNotice error={submitError} />}</div> : null}
      <h2>버전</h2>
      <div className="version-list">{VERSIONS.map(({ variant, name, change }) => {
        const runs = results[variant]
        const run = runs[0]
        const validRun = variant === 'before' ? validBefore : validAfter
        const canCreate = runs.every((item) => item.validity === 'INVALID')
        return <article key={variant}><h3>{name}</h3><p>{change}</p>{listState[variant] === 'loading' ? <p>실행 기록 조회 중</p> : listState[variant] === 'error' ? <p>실행 기록: 확인 불가</p> : run ? <><p>마지막 Run: <Link to={`/runs/${encodeURIComponent(run.runId)}`}>{run.runId}</Link> <ResultOriginBadge origin={run.resultOrigin} /></p><p>분석 상태: {run.status}</p><p>실행 유효성: {run.validity ?? '확인 중'}</p><p>목표 화면 도달: {run.goalReached === null ? '확인 불가' : run.goalReached ? '도달' : '미도달'}</p></> : <p>실행 기록 없음</p>}{run?.validity === 'INVALID' && (validRun ? <p>이전 유효 Run: <Link to={`/runs/${encodeURIComponent(validRun.runId)}/result`}>{validRun.runId}</Link></p> : <p>유효한 실행이 없습니다. 재분석해 주세요.</p>)}<button type="button" disabled={!ready || (variant === 'after' && !validBefore) || !canCreate} onClick={() => void start(variant)}>분석 시작</button></article>
      })}</div>
      {listFailed && validKey && <button type="button" onClick={() => setListVersion((v) => v + 1)}>실행 기록 다시 조회</button>}
      <button type="button" disabled>+ 버전 추가</button> <span>v3 (준비 중)</span>
      <h2>버전 비교</h2>
      <label>첫 번째 버전 <select value={compareA} onChange={(e) => setCompareA(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
      <label>두 번째 버전 <select value={compareB} onChange={(e) => setCompareB(e.target.value as Variant)}>{VERSIONS.map((v) => <option value={v.variant} key={v.variant}>{v.name}</option>)}</select></label>
      {compareA === compareB && <p role="alert">서로 다른 버전을 선택해 주세요.</p>}
      <button type="button" disabled={!bothFinished || compareA === compareB || !experimentKey || keyInput !== experimentKey} onClick={() => navigate(`/comparisons/${encodeURIComponent(experimentKey)}`)}>비교하기</button>
    </section>
  )
}
