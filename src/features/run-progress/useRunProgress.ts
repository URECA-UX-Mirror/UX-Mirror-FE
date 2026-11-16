import { useCallback, useRef } from 'react'
import { isAbortError } from '../../api/client.ts'
import { getRun, getRunSteps } from '../../api/runs.ts'
import type { Run, Step } from '../../domain/types.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'

export interface RunSnapshot {
  run: Run
  /** `/steps` 조회에 실패하면 직전에 받은 목록을 그대로 둔다 */
  steps: Step[]
  /** 이번 `/steps` 조회가 실패했으면 그 오류. Run 조회 오류와 구분한다 */
  stepsError: unknown
}

/**
 * 종료된 Run에서 `/steps`만 계속 실패할 때 `/steps`를 다시 조회하는 최대 횟수(`임시`).
 * 이 횟수까지 실패하면 폴링을 멈추고 수동 재시도 버튼을 보인다.
 */
export const MAX_STEPS_RETRIES = 5

/** 같은 `stepId`가 다시 오면 내용을 덮어쓰고, 순서는 서버가 준 그대로 둔다(다시 정렬하지 않는다). */
export function mergeSteps(items: ReadonlyArray<Step>): Step[] {
  const byId = new Map<number, Step>()
  for (const step of items) byId.set(step.stepId, step)
  return [...byId.values()]
}

/**
 * Run과 `/steps`를 함께 조회한다. `/steps`는 Run 응답을 받은 뒤에 조회하므로
 * 종료 응답에 대한 `/steps`가 곧 종료 뒤 마지막 조회가 되어 마지막 단계가 빠지지 않는다.
 * `/steps` 오류(404 포함)는 Run 오류가 아니다. Run 상태는 그대로 반영하고 이전 Step 목록을 유지한다.
 *
 * `runId`마다 새로 마운트해야 한다(호출하는 쪽이 `key={runId}`로 보장한다). Step 목록을 ref에 보관한다.
 */
export function useRunProgress(runId: string) {
  const steps = useRef<Step[]>([])
  const stepsFailures = useRef(0)
  const polling = usePolling<RunSnapshot>({
    resetKey: runId,
    fetch: async (signal) => {
      const run = await getRun(runId, signal)
      let stepsError: unknown = null
      try {
        steps.current = mergeSteps(await getRunSteps(runId, signal))
        stepsFailures.current = 0
      } catch (error) {
        if (isAbortError(error)) throw error
        stepsError = error
        stepsFailures.current += 1
      }
      return { run, steps: steps.current, stepsError }
    },
    // 종료돼도 마지막 `/steps`를 받지 못했으면 한도까지 `/steps`를 다시 조회한다.
    isDone: (data) =>
      isTerminalStatus(data.run.status) &&
      (data.stepsError === null || stepsFailures.current >= MAX_STEPS_RETRIES),
  })

  const { retry: retryPolling } = polling
  const retry = useCallback(() => {
    stepsFailures.current = 0
    retryPolling()
  }, [retryPolling])
  return { ...polling, retry }
}
