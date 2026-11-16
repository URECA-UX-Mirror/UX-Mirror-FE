import type { Variant } from '../api/dto/index.ts'
import { RESULT_SEEDS } from './fixtures/runResult.ts'
import type { ScenarioName } from './fixtures/scenario.ts'

// 모의 서버의 Run 기록. 새로고침 뒤 복원을 확인할 수 있도록 sessionStorage에 보관한다.
// 저장소를 쓸 수 없으면 메모리에만 둔다.

export interface RunRecord {
  runId: string
  experimentKey: string
  variant: Variant
  /** 생략하면 `variant`와 같은 시나리오(before/after)를 쓴다 */
  scenario?: ScenarioName
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

const seed = (
  partial: Pick<RunRecord, 'runId' | 'experimentKey' | 'variant'> &
    Partial<RunRecord>,
  offsetMin = 0,
): RunRecord => ({
  goalId: 'refund',
  personaId: 'novice-shopper',
  maxSteps: 8,
  createdAtMs: SEED_AT_MS + offsetMin * 60_000,
  ...partial,
})

// 처음부터 종료된 Run. URL에 직접 넣어 결과·비교 화면을 확인할 수 있다.
const SEEDS: RunRecord[] = [
  // 두 버전이 같은 화면(home, orders)만 방문해 비교가 COMPLETED가 되는 쌍
  seed({
    runId: 'run_mock_done_before',
    experimentKey: 'mock-done',
    variant: 'before',
    scenario: 'direct',
  }),
  seed({ runId: 'run_mock_done_after', experimentKey: 'mock-done', variant: 'after' }, 5),
  // Before만 마이페이지를 거쳐 비교가 PARTIAL이 되는 쌍(NOT_VISITED_IN_AFTER)
  seed({ runId: 'run_mock_partial_before', experimentKey: 'mock-partial', variant: 'before' }, 6),
  seed({ runId: 'run_mock_partial_after', experimentKey: 'mock-partial', variant: 'after' }, 7),
  // 모델 GO_BACK과 재방문이 있는 Run
  seed({
    runId: 'run_mock_goback',
    experimentKey: 'mock-goback',
    variant: 'before',
    scenario: 'goback',
  }, 10),
  // 무효 처리된 Run과 그 재실행(replacementRunId)
  seed({
    runId: 'run_mock_invalid',
    experimentKey: 'mock-invalid',
    variant: 'before',
    invalid: true,
    replacementRunId: 'run_mock_invalid_retry',
  }, 15),
  seed({ runId: 'run_mock_invalid_retry', experimentKey: 'mock-invalid', variant: 'before' }, 16),
  // 무효 처리되고 재실행이 없는 Run
  seed({
    runId: 'run_mock_invalid_only',
    experimentKey: 'mock-invalid-run',
    variant: 'before',
    invalid: true,
  }, 20),
  seed({ runId: 'run_mock_invalid_only_after', experimentKey: 'mock-invalid-run', variant: 'after' }, 21),
  ...RESULT_SEEDS,
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

/** 생성 시각이 최근인 Run이 먼저 온다(`GET /api/runs`와 같은 순서). */
export function allRuns(): RunRecord[] {
  return [...SEEDS, ...Object.values(created)].sort(
    (a, b) => b.createdAtMs - a.createdAtMs,
  )
}

export function findRun(runId: string): RunRecord | undefined {
  return allRuns().find((run) => run.runId === runId)
}

/** 같은 `experimentKey`+`variant`의 Run을 최신순으로 돌려준다. */
export function findExperimentRuns(
  experimentKey: string,
  variant: Variant,
): RunRecord[] {
  return allRuns().filter(
    (run) => run.experimentKey === experimentKey && run.variant === variant,
  )
}

export function addRun(run: RunRecord): void {
  created[run.runId] = run
  persist()
}
