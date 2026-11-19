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

/** 진행 중인 작업이 있을 때 다시 조회하는 간격. 끝나면 조회를 멈춘다 */
export const BUSY_POLL_MS = 3000

/** 진행 중인 진단·AI 개선·후보 평가가 있는지 */
export function isBusy(health: Health | null): boolean {
  return !!health && (!!health.activeRunId || !!health.activeOptimization || !!health.activeOwner)
}

/** 진행 중인 작업 화면 주소 (AI 개선 > 진단 > 후보 비교). 없으면 `null` */
export function busyLinkOf(health: Health | null): string | null {
  if (!health) return null
  if (health.activeOwner?.improvementId) return `/improvements/${encodeURIComponent(health.activeOwner.improvementId)}`
  if (health.activeRunId) return `/runs/${encodeURIComponent(health.activeRunId)}`
  if (health.activeOptimization) return `/optimizations/${encodeURIComponent(health.activeOptimization.optimizationId)}`
  return null
}

/**
 * `GET /api/health`를 조회한다. 진행 중인 작업이 있는 동안만 3초마다 다시 조회하고, 없으면 멈춘다
 * (끝난 뒤에도 "다른 진단이 진행 중"이 남지 않게).
 * `refreshKey`가 바뀌면(예: 라우트 이동) 다시 조회하고, 끝날 때까지 이전 결과를 유지한다.
 */
export function useHealth(refreshKey = ''): HealthState {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const token = `${version}:${refreshKey}`
  const busy = isBusy(settled?.health ?? null)

  useEffect(() => {
    if (!busy || settled?.token !== token) return undefined
    const timer = setTimeout(() => setVersion((v) => v + 1), BUSY_POLL_MS)
    return () => clearTimeout(timer)
  }, [busy, settled?.token, token])

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
