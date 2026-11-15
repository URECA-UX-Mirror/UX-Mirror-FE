import type { Variant } from '../api/dto/index.ts'

// 모의 서버의 Run 기록. 새로고침 뒤 복원을 확인할 수 있도록 sessionStorage에 보관한다.
// 저장소를 쓸 수 없으면 메모리에만 둔다.

export interface RunRecord {
  runId: string
  experimentKey: string
  variant: Variant
  goalId: string
  personaId: string
  maxSteps: number
  /** 생성 시각(ms). 이 시각부터 경과 시간으로 상태가 전이한다 */
  createdAtMs: number
  /** true이면 종료 후 `validity = INVALID` */
  invalid?: boolean
  replacementRunId?: string
}

const STORAGE_KEY = 'ux-mirror-mock-runs'
const SEED_AT_MS = Date.parse('2026-11-01T09:00:00+09:00')

// 처음부터 종료된 Run. URL에 직접 넣어 결과·비교 화면을 확인할 수 있다.
const SEEDS: RunRecord[] = [
  {
    runId: 'run_mock_done_before',
    experimentKey: 'mock-done',
    variant: 'before',
    goalId: 'goal_refund',
    personaId: 'persona_new_user',
    maxSteps: 8,
    createdAtMs: SEED_AT_MS,
  },
  {
    runId: 'run_mock_done_after',
    experimentKey: 'mock-done',
    variant: 'after',
    goalId: 'goal_refund',
    personaId: 'persona_new_user',
    maxSteps: 8,
    createdAtMs: SEED_AT_MS,
  },
  {
    runId: 'run_mock_invalid',
    experimentKey: 'mock-invalid',
    variant: 'after',
    goalId: 'goal_refund',
    personaId: 'persona_new_user',
    maxSteps: 8,
    createdAtMs: SEED_AT_MS,
    invalid: true,
    replacementRunId: 'run_mock_done_after',
  },
]

function load(): Record<string, RunRecord> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, RunRecord>
  } catch {
    // 저장소를 읽지 못하면 메모리 값으로 시작한다.
  }
  return {}
}

const created: Record<string, RunRecord> = load()

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(created))
  } catch {
    // 저장하지 못해도 메모리 값으로 동작한다.
  }
}

export function allRuns(): RunRecord[] {
  return [...SEEDS, ...Object.values(created)]
}

export function findRun(runId: string): RunRecord | undefined {
  return allRuns().find((run) => run.runId === runId)
}

export function findExperimentRun(
  experimentKey: string,
  variant: Variant,
): RunRecord | undefined {
  return allRuns().find(
    (run) => run.experimentKey === experimentKey && run.variant === variant,
  )
}

export function addRun(run: RunRecord): void {
  created[run.runId] = run
  persist()
}
