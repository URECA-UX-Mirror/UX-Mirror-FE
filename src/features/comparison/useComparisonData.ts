import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../../api/client.ts'
import { getComparison } from '../../api/comparisons.ts'
import { getRunSteps } from '../../api/runs.ts'
import type { Comparison, Step } from '../../domain/types.ts'

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
  }
}
