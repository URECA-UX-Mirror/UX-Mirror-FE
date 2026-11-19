import { useEffect, useState } from 'react'
import { toImprovementView } from '../../adapters/improvement.ts'
import { isAbortError, isApiError } from '../../api/client.ts'
import { ACTIVE_JOB_STATUSES, getImprovement, type ImprovementJobDto } from '../../api/improvements.ts'
import type { ImprovementView } from '../../domain/improvement.ts'

/** 진행 중일 때 다시 조회하는 간격 */
export const IMPROVEMENT_POLL_MS = 3000

// AI 개선은 서버 API(`GET /api/improvements/{id}`, BE #130)로 읽는다. 진행 중이면 3초마다 다시 읽고 끝나면 멈춘다.
export type ImprovementLoadState =
  | { phase: 'loading' }
  /** `view`는 리포트가 생긴 뒤(루프가 끝난 뒤)에만 있다 */
  | { phase: 'success'; job: ImprovementJobDto; view: ImprovementView | null }
  | { phase: 'notFound' }
  | { phase: 'error' }

/** `improvementId`는 주소에만 쓴다. 이 밖의 문자는 요청하지 않는다 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

export const isSafeImprovementId = (id: string) => SAFE_ID.test(id)

export const isActiveJob = (job: ImprovementJobDto) => ACTIVE_JOB_STATUSES.includes(job.status)

/** 주소의 id가 바뀌면 호출하는 쪽이 `key`로 새로 마운트한다 */
export function useImprovement(improvementId: string): ImprovementLoadState {
  const safe = isSafeImprovementId(improvementId)
  const [state, setState] = useState<ImprovementLoadState>({ phase: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!safe) return
    const controller = new AbortController()
    getImprovement(improvementId, controller.signal)
      .then((job) => {
        if (controller.signal.aborted) return
        setState({ phase: 'success', job, view: job.improvement ? toImprovementView(job.improvement) : null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState(isApiError(error) && error.status === 404 ? { phase: 'notFound' } : { phase: 'error' })
      })
    return () => controller.abort()
  }, [improvementId, safe, tick])

  const active = state.phase === 'success' && isActiveJob(state.job)
  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setTick((t) => t + 1), IMPROVEMENT_POLL_MS)
    return () => clearTimeout(timer)
  }, [active, state])

  return safe ? state : { phase: 'notFound' }
}
