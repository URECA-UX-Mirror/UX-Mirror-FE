import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../../api/client.ts'
import { getComparison } from '../../api/comparisons.ts'
import { getRun, getRunSteps } from '../../api/runs.ts'
import type { ReferenceBasis } from '../../api/dto/run.ts'
import type { Comparison, Open, OptimizationContext, Step } from '../../domain/types.ts'

interface Loaded {
  token: string
  comparison: Comparison | null
  error: unknown
}

export interface ComparisonState {
  comparison: Comparison | null
  error: unknown
  loading: boolean
  reload: () => void
}

/** `GET /api/comparisons/{experimentKey}`를 조회한다. 폴링하지 않고 다시 시도 버튼으로만 다시 조회한다. */
export function useComparison(experimentKey: string): ComparisonState {
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const token = `${version}:${experimentKey}`

  useEffect(() => {
    const controller = new AbortController()
    getComparison(experimentKey, controller.signal)
      .then((comparison) => setLoaded({ token, comparison, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoaded({ token, comparison: null, error })
      })
    return () => controller.abort()
  }, [token, experimentKey])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = loaded?.token === token ? loaded : null
  return {
    comparison: current?.comparison ?? null,
    error: current?.error ?? null,
    loading: current === null,
    reload,
  }
}

export interface RunStepsState {
  /** `stepId`로 찾는 Step. 아직 받지 못했거나 실패하면 비어 있다 */
  steps: ReadonlyMap<number, Step>
  failed: boolean
  /** 아직 응답을 받지 못했으면 true. 끝난 뒤 Step이 없는 것과 구분한다 */
  loading: boolean
}

interface StepsLoaded {
  runId: string
  steps: Map<number, Step>
  failed: boolean
}

/** 한 Run의 `/steps`를 받는다. 실패해도 비교 값은 계속 보이도록 오류는 `failed`로만 알린다. */
export function useRunSteps(runId: string): RunStepsState {
  const [loaded, setLoaded] = useState<StepsLoaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getRunSteps(runId, controller.signal)
      .then((items) =>
        setLoaded({
          runId,
          steps: new Map(items.map((step) => [step.stepId, step])),
          failed: false,
        }),
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoaded({ runId, steps: new Map(), failed: true })
      })
    return () => controller.abort()
  }, [runId])

  const current = loaded?.runId === runId ? loaded : null
  return {
    steps: current?.steps ?? new Map(),
    failed: current?.failed ?? false,
    loading: current === null,
  }
}

/** 한 Run의 경로 지표 기준. `undefined`는 아직 받지 못했거나 조회에 실패한 경우이고, `null`은 기준 없음이다 */
export type RunBasis = Open<ReferenceBasis> | null | undefined

interface BasisLoaded {
  runId: string
  basis: RunBasis
}

/**
 * 비교 응답에는 기준(`basis`)이 없으므로 각 Run의 `GET /api/runs/{runId}`에서 읽는다.
 * 실패해도 비교 값은 계속 보이도록 `undefined`로 두고 기존 표시를 유지한다.
 */
export function useRunBasis(runId: string): RunBasis {
  const [loaded, setLoaded] = useState<BasisLoaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getRun(runId, controller.signal)
      .then((run) => setLoaded({ runId, basis: run.referenceBasis }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoaded({ runId, basis: undefined })
      })
    return () => controller.abort()
  }, [runId])

  return loaded?.runId === runId ? loaded.basis : undefined
}

interface ContextLoaded {
  runId: string
  context: OptimizationContext | null
}

/**
 * Run의 Optimizer 연결 정보(`optimizationContext`). 일반 Run이거나 아직 받지 못했거나 조회에 실패하면 `null`이라 기존 표시를 유지한다.
 * 기준·후보 어느 라벨 사이트인지는 `variant`가 아니라 이 값으로만 알 수 있다.
 */
export function useRunOptimizationContext(runId: string): OptimizationContext | null {
  const [loaded, setLoaded] = useState<ContextLoaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getRun(runId, controller.signal)
      .then((run) => setLoaded({ runId, context: run.optimizationContext }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoaded({ runId, context: null })
      })
    return () => controller.abort()
  }, [runId])

  return loaded?.runId === runId ? loaded.context : null
}
