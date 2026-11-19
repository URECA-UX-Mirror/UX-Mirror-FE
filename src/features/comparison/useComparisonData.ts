import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../../api/client.ts'
import { getComparison } from '../../api/comparisons.ts'
import { getRun, getRunSteps } from '../../api/runs.ts'
import type { ReferenceBasis } from '../../api/dto/run.ts'
import type { Comparison, ImprovementContext, Open, OptimizationContext, Step } from '../../domain/types.ts'

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

export interface RunMeta {
  basis: RunBasis
  /** Optimizer 검증 Run이면 연결 정보. 일반 Run이거나 아직 받지 못했거나 조회에 실패하면 `null`이라 기존 표시를 유지한다 */
  optimizationContext: OptimizationContext | null
  /** 자동 개선 검증 Run이면 연결 정보(OI-14). 아니면 `null`이라 기존 표시를 유지한다 */
  improvementContext: ImprovementContext | null
}

interface MetaLoaded {
  runId: string
  meta: RunMeta
}

const UNKNOWN_META: RunMeta = { basis: undefined, optimizationContext: null, improvementContext: null }

/**
 * 비교 응답에는 경로 지표 기준(`basis`)과 Optimizer 연결 정보(`optimizationContext`)가 없으므로
 * 각 Run의 `GET /api/runs/{runId}`를 한 번 읽어 둘을 함께 얻는다. 어느 라벨 사이트인지는 `variant`가 아니라 `optimizationContext`로만 안다.
 * 실패해도 비교 값은 계속 보이도록 알 수 없음으로 두고 기존 표시를 유지한다.
 */
export function useRunMeta(runId: string): RunMeta {
  const [loaded, setLoaded] = useState<MetaLoaded | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getRun(runId, controller.signal)
      .then((run) =>
        setLoaded({
          runId,
          meta: { basis: run.referenceBasis, optimizationContext: run.optimizationContext, improvementContext: run.improvementContext },
        }),
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setLoaded({ runId, meta: UNKNOWN_META })
      })
    return () => controller.abort()
  }, [runId])

  return loaded?.runId === runId ? loaded.meta : UNKNOWN_META
}
