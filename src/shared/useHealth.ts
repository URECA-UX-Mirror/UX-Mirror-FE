import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/client.ts'
import { getHealth } from '../api/health.ts'
import type { Health } from '../domain/types.ts'

export interface HealthState {
  health: Health | null
  /** 조회에 실패하면 담긴다. 이때 엔진 상태는 "확인 불가"로 표시한다 */
  error: unknown
  /** 가장 최근 조회가 끝나지 않았으면 true. 이전 결과(`health`, `error`)는 그대로 남아 있다 */
  loading: boolean
  reload: () => void
}

interface Settled {
  /** 이 결과가 어느 조회의 것인지 */
  token: string
  health: Health | null
  error: unknown
}

/**
 * `GET /api/health`를 조회한다. 폴링하지 않는다.
 * `refreshKey`가 바뀌면(예: 라우트 이동) 다시 조회하고, 끝날 때까지 이전 결과를 유지한다.
 */
export function useHealth(refreshKey = ''): HealthState {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const token = `${version}:${refreshKey}`

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((health) => setSettled({ token, health, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setSettled({ token, health: null, error })
      })
    return () => controller.abort()
  }, [token])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return {
    health: settled?.health ?? null,
    error: settled?.error ?? null,
    loading: settled?.token !== token,
    reload,
  }
}
