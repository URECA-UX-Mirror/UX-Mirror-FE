import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbortError } from '../../api/client.ts'
import { listImprovements, startImprovement } from '../../api/improvements.ts'
import { startErrorMessage } from './labels.ts'

const FAILED_STATUSES = ['FAILED', 'INTERRUPTED']

export interface RunImprovement {
  /**
   * 이 진단에서 시작한 AI 개선 중 보여 줄 것. 가장 최근 것이되, 그것이 끝내지 못한 것이고
   * 전에 끝난 결과가 있으면 그 끝난 결과다. 없으면 `null`
   */
  improvementId: string | null
  /** 가장 최근 것은 끝내지 못해 전에 끝난 결과를 보이는 중 (다시 받아 보기를 권한다) */
  newerFailed: boolean
  /** 지난 기록 확인 상태. `failed`면 있는지 없는지 모른다 */
  lookup: 'loading' | 'ready' | 'failed'
  retryLookup: () => void
  start: () => void
  /** 시작 요청을 보내는 중 */
  pending: boolean
  /** 시작 실패 안내 */
  error: string | null
}

/**
 * 진단 하나에 딸린 AI 개선. `GET /api/improvements`에서 `input.sourceRunId`가 이 진단인 것을 찾아
 * 다시 열어도 같은 결과가 보이게 하고, `start`로 새로 시작한다(`POST /api/improvements {sourceRunId}`).
 * `enabled`가 false면 아무것도 조회하지 않는다.
 */
export function useRunImprovement(runId: string, enabled: boolean): RunImprovement {
  const [improvementId, setImprovementId] = useState<string | null>(null)
  const [newerFailed, setNewerFailed] = useState(false)
  /** 이 화면에서 시작에 성공했는지. 그 뒤로는 목록 조회 결과로 바꾸지 않는다 */
  const started = useRef(false)
  const [lookup, setLookup] = useState<RunImprovement['lookup']>('loading')
  const [tick, setTick] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    listImprovements(controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        // 서버는 최신순으로 주지만, 순서에 기대지 않고 가장 최근 것을 고른다
        const mine = items
          .filter((item) => item.input?.sourceRunId === runId)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        // 다시 받아 보다가 끝내지 못했어도 전에 끝난 결과는 가리지 않는다
        const done = FAILED_STATUSES.includes(mine[0]?.status) ? mine.find((item) => item.status === 'COMPLETED') : undefined
        const chosen = done ?? mine[0]
        // 이 화면에서 방금 시작한 것이 있으면 그대로 둔다
        if (!started.current) {
          setImprovementId(chosen?.improvementId ?? null)
          setNewerFailed(done !== undefined)
        }
        setLookup('ready')
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || isAbortError(e)) return
        setLookup('failed')
      })
    return () => controller.abort()
  }, [runId, enabled, tick])

  const retryLookup = useCallback(() => {
    setLookup('loading')
    setTick((t) => t + 1)
  }, [])

  const start = useCallback(() => {
    setPending(true)
    setError(null)
    startImprovement({ sourceRunId: runId })
      .then((job) => {
        started.current = true
        setImprovementId(job.improvementId)
        setNewerFailed(false)
        setLookup('ready')
      })
      .catch((e: unknown) => {
        setError(startErrorMessage(e))
        // 응답을 못 받았거나 다른 탭에서 이미 시작했을 수 있다. 이 진단의 것이 생겼는지 다시 찾아본다
        setTick((t) => t + 1)
      })
      .finally(() => setPending(false))
  }, [runId])

  return { improvementId, newerFailed, lookup, retryLookup, start, pending, error }
}
