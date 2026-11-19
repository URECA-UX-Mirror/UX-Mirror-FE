import { useCallback, useEffect, useState } from 'react'
import { toImprovementView } from '../../adapters/improvement.ts'
import { isAbortError, isApiError } from '../../api/client.ts'
import { ACTIVE_JOB_STATUSES, getImprovement, type ImprovementJobDto } from '../../api/improvements.ts'
import type { ImprovementView } from '../../domain/improvement.ts'

/** 진행 중일 때 다시 조회하는 간격 */
export const IMPROVEMENT_POLL_MS = 3000

/** 조회에 실패했을 때 다시 시도하는 간격 (일시적인 네트워크 오류로 진행 확인이 멈추지 않게) */
export const IMPROVEMENT_RETRY_MS = 5000

// AI 개선은 서버 API(`GET /api/improvements/{id}`, BE #130)로 읽는다. 진행 중이면 3초마다 다시 읽고 끝나면 멈춘다.
// 조회가 실패해도 멈추지 않고 5초마다 다시 시도한다. 이미 받은 내용이 있으면 그대로 보이고 `stale`로 알린다.
export type ImprovementLoadState =
  | { phase: 'loading' }
  /** `view`는 리포트가 생긴 뒤(루프가 끝난 뒤)에만 있다. `stale`: 마지막 조회가 실패해 이전 내용을 보이는 중 */
  | { phase: 'success'; job: ImprovementJobDto; view: ImprovementView | null; stale: boolean; retry: () => void }
  | { phase: 'notFound' }
  | { phase: 'error'; retry: () => void }

type Loaded =
  | { phase: 'loading' }
  | { phase: 'success'; job: ImprovementJobDto; view: ImprovementView | null; stale: boolean }
  | { phase: 'notFound' }
  | { phase: 'error' }

/** `improvementId`는 주소에만 쓴다. 이 밖의 문자는 요청하지 않는다 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

export const isSafeImprovementId = (id: string) => SAFE_ID.test(id)

export const isActiveJob = (job: ImprovementJobDto) => ACTIVE_JOB_STATUSES.includes(job.status)

/** 주소의 id가 바뀌면 호출하는 쪽이 `key`로 새로 마운트한다 */
export function useImprovement(improvementId: string): ImprovementLoadState {
  const safe = isSafeImprovementId(improvementId)
  const [state, setState] = useState<Loaded>({ phase: 'loading' })
  const [tick, setTick] = useState(0)
  const retry = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!safe) return
    const controller = new AbortController()
    getImprovement(improvementId, controller.signal)
      .then((job) => {
        if (controller.signal.aborted) return
        setState({ phase: 'success', job, view: job.improvement ? toImprovementView(job.improvement) : null, stale: false })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        if (isApiError(error) && error.status === 404) {
          setState({ phase: 'notFound' })
          return
        }
        setState((prev) => (prev.phase === 'success' ? { ...prev, stale: true } : { phase: 'error' }))
      })
    return () => controller.abort()
  }, [improvementId, safe, tick])

  // 진행 중이면 3초마다, 조회가 실패한 상태면 5초마다 다시 읽는다
  const delay = state.phase === 'error' || (state.phase === 'success' && state.stale)
    ? IMPROVEMENT_RETRY_MS
    : state.phase === 'success' && isActiveJob(state.job) ? IMPROVEMENT_POLL_MS : null
  useEffect(() => {
    if (delay === null) return undefined
    const timer = setTimeout(retry, delay)
    return () => clearTimeout(timer)
  }, [delay, state, retry])

  if (!safe) return { phase: 'notFound' }
  if (state.phase === 'success' || state.phase === 'error') return { ...state, retry }
  return state
}
