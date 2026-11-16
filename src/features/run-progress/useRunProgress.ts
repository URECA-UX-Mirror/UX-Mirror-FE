import { getRun, getRunSteps } from '../../api/runs.ts'
import type { Run, Step } from '../../domain/types.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { usePolling } from '../../shared/polling/usePolling.ts'

export interface RunSnapshot {
  run: Run
  steps: Step[]
}

/** 같은 `stepId`가 다시 오면 내용을 덮어쓰고, 순서는 서버가 준 그대로 둔다(다시 정렬하지 않는다). */
export function mergeSteps(items: ReadonlyArray<Step>): Step[] {
  const byId = new Map<number, Step>()
  for (const step of items) byId.set(step.stepId, step)
  return [...byId.values()]
}

/**
 * Run과 `/steps`를 함께 조회한다. `/steps`는 Run 응답을 받은 뒤에 조회하므로
 * 종료 응답에 대한 `/steps`가 곧 종료 뒤 마지막 조회가 되어 마지막 단계가 빠지지 않는다.
 */
async function fetchSnapshot(
  runId: string,
  signal: AbortSignal,
): Promise<RunSnapshot> {
  const run = await getRun(runId, signal)
  const steps = await getRunSteps(runId, signal)
  return { run, steps: mergeSteps(steps) }
}

export function useRunProgress(runId: string) {
  return usePolling<RunSnapshot>({
    resetKey: runId,
    fetch: (signal) => fetchSnapshot(runId, signal),
    isDone: (data) => isTerminalStatus(data.run.status),
  })
}
