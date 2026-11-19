import { getOptimization } from '../api/optimizations.ts'
import type { Optimization } from '../domain/types.ts'
import { isTerminalOptimizationStatus } from '../domain/optimizationStatus.ts'
import { usePolling } from './polling/usePolling.ts'

/**
 * Optimization을 1초 간격으로 조회하고 `COMPLETED`·`FAILED`에서 멈춘다(임시, OI-12).
 * 간격과 오류 backoff(재시도 가능 오류는 1→2→4→8초, 5번 연속 실패 또는 404·재시도 불가 오류는 멈춤)는
 * Run 폴링과 같은 `usePolling`을 쓴다. 종료 판정은 `isTerminalOptimizationStatus` 한 곳이다.
 * `FAILED`는 오류 응답이 아니라 정상 응답의 상태값이므로 `data.error`를 본다.
 *
 * `optimizationId`가 바뀌면 기존 루프를 취소하고 새로 시작한다. `enabled`가 `false`이면 조회하지 않는다.
 */
export function useOptimizationProgress(
  optimizationId: string,
  options: { enabled?: boolean } = {},
) {
  return usePolling<Optimization>({
    resetKey: optimizationId,
    enabled: options.enabled,
    fetch: (signal) => getOptimization(optimizationId, signal),
    isDone: (data) => isTerminalOptimizationStatus(data.status),
  })
}
