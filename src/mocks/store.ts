import type {
  OptimizationContextDto,
  Variant,
  VerificationDto,
} from '../api/dto/index.ts'
import {
  buildOptimization,
  isActiveStatus,
  OPTIMIZATION_SEEDS,
  verificationRuns,
} from './fixtures/optimization.ts'
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
  /** 직접 입력한 목표면 `null` (그때는 `goal`·`verification`이 있다) */
  goalId: string | null
  goal?: string
  verification?: VerificationDto
  /** 직접 입력한 사용자 유형이면 `null` (그때는 `persona`가 있다) */
  personaId: string | null
  persona?: string
  /**
   * 경로 지표 기준. 생략하면 허용 경로(직접 입력한 목표는 기준 없음).
   * `site-map` 사이트 지도(직접 입력한 목표에도 적용), `none` 지도 오류로 기준 없음(`referencePathConfig: null`),
   * `legacy` `basis` 없는 과거 허용 경로 설정
   */
  reference?: 'site-map' | 'none' | 'legacy'
  /** 시나리오 Run의 사이트(임시, OI-11). 있으면 `mode: SCENARIO`인 시나리오 Run이다 */
  siteId?: string
  maxSteps: number
  /** 생성 시각(ms). 이 시각부터 경과 시간으로 상태가 전이한다 */
  createdAtMs: number
  /** true이면 종료 후 `validity = INVALID` */
  invalid?: boolean
  replacementRunId?: string
  /** UX Optimizer 검증 Run의 연결 정보(임시, OI-12). 있으면 응답의 `optimizationContext`가 된다 */
  optimizationContext?: OptimizationContextDto
}

/** UX Optimizer mock 시나리오(fixtures/optimization.ts 주석) */
export type OptimizationScenario =
  | 'success'
  | 'partial'
  | 'eval-timeout'
  | 'site-changed'
  | 'interrupted'
  | 'invalid-site'
  | 'not-selectable'

/** 상태는 이 기록과 현재 시각으로만 정한다(`buildOptimization`). 검증 Run은 `verifyAtMs`가 있는 기록에서 만든다 */
export interface OptimizationRecord {
  optimizationId: string
  scenario: OptimizationScenario
  sourceRunId: string | null
  /** 생성 시각(ms). 이 시각부터 경과 시간으로 상태가 전이한다 */
  createdAtMs: number
  /** 검증을 시작한 시각(ms). 시작 전이면 없다 */
  verifyAtMs?: number
}

// 진행 중인 UX Optimizer(`GET /api/health`의 `activeOptimization`). 기본은 없음이다.
// 켜면 health가 값을 주고 `POST /api/runs`는 409 RUN_ALREADY_ACTIVE(BE 메시지 형식)를 돌려준다. 메모리에만 둔다.
export interface MockActiveOptimization {
  optimizationId: string
  status: 'CREATED' | 'EVALUATING' | 'VERIFYING' | 'MODEL_CALL_PENDING'
}
let activeOptimization: MockActiveOptimization | null = null
/** 수동으로 켠 값이 우선이고, 없으면 진행 중인(`CREATED`·`EVALUATING`·`VERIFYING`) Optimization 기록에서 구한다 */
export const getMockActiveOptimization = (
  nowMs: number = Date.now(),
): MockActiveOptimization | null => {
  if (activeOptimization) return activeOptimization
  for (const rec of allOptimizations()) {
    const { status } = buildOptimization(rec, nowMs)
    if (isActiveStatus(status)) {
      return { optimizationId: rec.optimizationId, status: status as MockActiveOptimization['status'] }
    }
  }
  return null
}
export const setMockActiveOptimization = (value: MockActiveOptimization | null) => {
  activeOptimization = value
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
  // `/replay`의 첫 고정 키(`REPLAY_EXPERIMENTS[0]`). mock-done과 같은 모양의 쌍이다
  seed({
    runId: 'run_mock_replay_before',
    experimentKey: 'e-s1-1119',
    variant: 'before',
    scenario: 'direct',
  }, 30),
  seed({ runId: 'run_mock_replay_after', experimentKey: 'e-s1-1119', variant: 'after' }, 35),
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
  // 목표·사용자 유형을 직접 입력한 Run (허용 경로 없음 → 경로 지표 null). v2는 같은 입력으로 시작해야 한다
  seed({
    runId: 'run_mock_direct_before',
    experimentKey: 'mock-direct',
    variant: 'before',
    goalId: null,
    goal: '주문 내역 화면 찾기',
    scenario: 'to-orders',
    // 실제 orders 화면 제목과 같아야 한다(띄어쓰기 포함). 탭 제목의 `주문/배송 조회`는 화면에 보이지 않는다
    verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/shop/orders', text: '주문 / 배송 조회', exact: false, scope: 'page' },
    personaId: null,
    persona: '쇼핑몰을 처음 쓰는 사용자',
  }, 25),
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

/**
 * 생성 시각이 최근인 Run이 먼저 온다(`GET /api/runs`와 같은 순서). UX Optimizer 검증 Run도 포함하되,
 * 서버가 아직 만들지 않은 Run(`createdAtMs`가 `nowMs`보다 뒤)은 빼서 목록·health의 `activeRun`에 보이지 않게 한다
 */
export function allRuns(nowMs: number = Date.now()): RunRecord[] {
  return [
    ...SEEDS,
    ...Object.values(created),
    ...allOptimizations()
      .flatMap(verificationRuns)
      .filter((run) => run.createdAtMs <= nowMs),
  ].sort(
    (a, b) => b.createdAtMs - a.createdAtMs,
  )
}

export function findRun(runId: string): RunRecord | undefined {
  return allRuns().find((run) => run.runId === runId)
}

/** 같은 `experimentKey`의 가장 먼저 만든 Run. 두 번째 Run부터 입력이 같아야 한다(UX-Mirror-BE #42) */
export function firstExperimentRun(experimentKey: string): RunRecord | undefined {
  return allRuns()
    .filter((run) => run.experimentKey === experimentKey)
    .sort((a, b) => a.createdAtMs - b.createdAtMs)[0]
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

// ---- UX Optimizer 기록 (임시, OI-12) ----
// 새로고침 뒤 복원을 위해 sessionStorage에 보관한다. 시드는 코드에 있고 만든 기록과 검증 시작 시각만 저장한다.

const OPT_STORAGE_KEY = 'ux-mirror-mock-optimizations'

interface OptimizationStorage {
  created: Record<string, OptimizationRecord>
  verifyAt: Record<string, number>
}

function loadOptimizations(): OptimizationStorage {
  try {
    const raw = sessionStorage.getItem(OPT_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as OptimizationStorage
  } catch {
    // 저장소를 읽지 못하면 메모리 값으로 시작한다.
  }
  return { created: {}, verifyAt: {} }
}

const optimizations: OptimizationStorage = loadOptimizations()

function persistOptimizations() {
  try {
    sessionStorage.setItem(OPT_STORAGE_KEY, JSON.stringify(optimizations))
  } catch {
    // 저장하지 못해도 메모리 값으로 동작한다.
  }
}

/** 생성 시각이 최근인 기록이 먼저 온다. */
export function allOptimizations(): OptimizationRecord[] {
  return [...OPTIMIZATION_SEEDS, ...Object.values(optimizations.created)]
    .map((rec) =>
      optimizations.verifyAt[rec.optimizationId] === undefined
        ? rec
        : { ...rec, verifyAtMs: optimizations.verifyAt[rec.optimizationId] },
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
}

export function findOptimization(optimizationId: string): OptimizationRecord | undefined {
  return allOptimizations().find((rec) => rec.optimizationId === optimizationId)
}

/** 테스트용: 만든 Optimization 기록과 검증 시작 시각을 지우고 시드 상태로 되돌린다 */
export function resetMockOptimizations(): void {
  optimizations.created = {}
  optimizations.verifyAt = {}
  persistOptimizations()
}

export function addOptimization(rec: OptimizationRecord): void {
  optimizations.created[rec.optimizationId] = rec
  persistOptimizations()
}

/** 검증을 시작한 시각을 기록한다. 이 시각부터 기준 Run → 후보 Run이 만들어진다 */
export function markOptimizationVerifying(optimizationId: string, atMs: number): void {
  optimizations.verifyAt[optimizationId] = atMs
  persistOptimizations()
}
