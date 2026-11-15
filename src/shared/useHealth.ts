import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/client.ts'
import { getHealth } from '../api/health.ts'
import type { Health } from '../domain/types.ts'

export interface HealthState {
  health: Health | null
  /** 조회에 실패하면 담긴다. 이때 엔진 상태는 "확인 불가"로 표시한다 */
  error: unknown
  loading: boolean
  reload: () => void
}

interface Settled {
  /** 이 결과가 어느 조회(version)의 것인지 */
  version: number
  health: Health | null
  error: unknown
}

/** `GET /api/health`를 한 번 조회한다. 폴링하지 않는다. */
export function useHealth(): HealthState {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((health) => setSettled({ version, health, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setSettled({ version, health: null, error })
      })
    return () => controller.abort()
  }, [version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return {
    health: settled?.health ?? null,
    error: settled?.error ?? null,
    loading: settled?.version !== version,
    reload,
  }
}
