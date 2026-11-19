import type {
  CandidateEvaluationDto,
  OptimizationDto,
  OptimizationErrorDto,
  OptimizationReportDto,
  OptimizationSelectionDto,
  OptimizationStatus,
  OptimizerRunOutcomeDto,
  VerificationPhase,
} from '../../api/dto/index.ts'
import type { OptimizationRecord, OptimizationScenario, RunRecord } from '../store.ts'
import { buildRun, getTiming } from './run.ts'

// UX Optimizer mock (FE #68, 임시 OI-12). 후보 평가·검증이 시간에 따라 진행한다. 상태는 기록(`OptimizationRecord`)과 현재 시각으로만 정한다.
//
// 시나리오는 `POST /api/optimizations`의 `sourceRunId`로 고른다(실제 서버는 없는 Run이면 404지만 mock은 아래 값을 시나리오 이름으로 쓴다).
//   (없음)                       success        후보 5개 모두 평가 → EVALUATED → 검증(기준 Run → 후보 Run) → COMPLETED
//   mock-opt-partial             partial        C3 FAILED(BROWSER_ERROR), C4 SKIPPED(INVALID_CANDIDATE)이고 나머지로 선정·검증
//   mock-opt-eval-timeout        eval-timeout   C2 평가에서 모델이 시간을 넘겨 평가 단계 FAILED(MODEL_TIMEOUT)
//   mock-opt-site-changed        site-changed   평가는 성공, 검증 시작 뒤 FAILED(SITE_INSTANCE_CHANGED). 검증 Run은 만들어지지 않는다
//   mock-opt-interrupted         interrupted    평가 도중 FAILED(OPTIMIZATION_INTERRUPTED, 서버 재시작)
//   mock-opt-invalid-site        invalid-site   평가는 성공, `POST /verify`가 422 INVALID_SITE_INSTANCE
//   mock-opt-model-unavailable   생성이 503 MODEL_UNAVAILABLE
//   mock-opt-policy-unavailable  생성이 503 OPTIMIZER_POLICY_UNAVAILABLE
//   mock-opt-condition-mismatch  생성이 422 EXPERIMENT_CONDITION_MISMATCH
// 처음부터 있는 시드(고정 ID): opt_mock_evaluated(검증 전), opt_mock_completed(보고서), opt_mock_partial, opt_mock_eval_timeout,
//   opt_mock_site_changed, opt_mock_interrupted. 시나리오 값은 임시이며 이유 코드·최종 판단 값은 정책 모듈이 정하기 전의 자리표시다.
// 검증 Run은 `experimentKey = optimizationId`이고 기준은 `variant=before`, 후보는 `after`다. 이 Run들은 기록에서 만들어져
// `GET /api/runs`·`/api/comparisons/{optimizationId}`로도 보인다. 한 시간에 Optimization 하나만 진행한다.

const SEED_AT_MS = Date.parse('2026-11-01T09:00:00+09:00')
const iso = (ms: number) => new Date(ms).toISOString()

/** 생성 뒤 첫 후보 평가가 시작되기까지(CREATED 구간) */
export const EVAL_START_MS = 500
/** 후보 하나를 평가하는 데 걸리는 시간 */
export const EVAL_STEP_MS = 1500
/** 검증 시작 뒤 사이트 재확인에 걸리는 시간. 끝나면 기준 Run을 만든다 */
export const RECHECK_MS = 500
/** 기준 Run이 끝난 뒤 후보 Run을 만들기까지, 후보 Run이 끝난 뒤 최종 판단까지 */
export const GAP_MS = 500

const SEMANTIC_KEY = '상단 메뉴>/shop/orders#1'

interface CandidateSpec {
  candidateId: string
  label: string
  role: 'BASELINE' | 'CANDIDATE'
  rank: number | null
  siteInstanceId: string
  target: number
  goalPath: number
}

const CANDIDATES: CandidateSpec[] = [
  { candidateId: 'C0', label: '이용정보', role: 'BASELINE', rank: null, siteInstanceId: 'moro-before', target: 0.12, goalPath: 0.3 },
  { candidateId: 'C1', label: '주문·배송', role: 'CANDIDATE', rank: 4, siteInstanceId: 'moro-c1', target: 0.31, goalPath: 0.55 },
  { candidateId: 'C2', label: '주문·환불', role: 'CANDIDATE', rank: 1, siteInstanceId: 'moro-after', target: 0.62, goalPath: 0.88 },
  { candidateId: 'C3', label: '주문·반품', role: 'CANDIDATE', rank: 2, siteInstanceId: 'moro-c3', target: 0.55, goalPath: 0.82 },
  { candidateId: 'C4', label: '주문 관리', role: 'CANDIDATE', rank: 3, siteInstanceId: 'moro-c4', target: 0.41, goalPath: 0.7 },
]

const round4 = (value: number) => Math.round(value * 10000) / 10000

const baselineRunId = (id: string) => `run_${id}_baseline`
const candidateRunId = (id: string) => `run_${id}_candidate`

// ---- 평가 ----

type Outcome = 'completed' | 'failed' | 'skipped' | 'timeout'

function outcomeOf(scenario: OptimizationScenario, index: number): Outcome {
  if (scenario === 'partial') {
    if (index === 3) return 'failed'
    if (index === 4) return 'skipped'
  }
  if (scenario === 'eval-timeout' && index === 2) return 'timeout'
  return 'completed'
}

/** 평가 단계가 몇 번째 후보에서 끝나는지. 모두 평가하면 후보 수, 도중에 실패하면 실패한 후보까지의 수 */
function evaluatedTotal(rec: OptimizationRecord): number {
  if (rec.scenario === 'eval-timeout') return 3
  if (rec.scenario === 'interrupted') return 2
  return CANDIDATES.length
}

const errorOf = (
  code: string,
  message: string,
  atMs: number,
  extra: Pick<OptimizationErrorDto, 'failedPhase' | 'lastStatus'> = {},
): OptimizationErrorDto => ({
  code,
  message,
  retryable: false,
  details: null,
  occurredAt: iso(atMs),
  ...extra,
})

function evaluationOf(
  rec: OptimizationRecord,
  index: number,
): CandidateEvaluationDto {
  const spec = CANDIDATES[index]
  const outcome = outcomeOf(rec.scenario, index)
  const atMs = rec.createdAtMs + EVAL_START_MS + (index + 1) * EVAL_STEP_MS
  const base: CandidateEvaluationDto = {
    candidateId: spec.candidateId,
    candidateOrder: index,
    label: spec.label,
    role: spec.role,
    semanticClarityRank: spec.rank,
    siteInstanceId: spec.siteInstanceId,
    candidateValidity: 'VALID',
    invalidReasons: [],
    evaluationStatus: 'COMPLETED',
    probabilities: null,
    targetOptionProbability: null,
    goalPathProbability: null,
    goalPathBasis: null,
    metricNullReasons: {},
    modelLatencyMs: 900 + index * 120,
    error: null,
    evaluatedAt: iso(atMs),
  }
  if (outcome === 'skipped') {
    return {
      ...base,
      siteInstanceId: null,
      candidateValidity: 'INVALID_CANDIDATE',
      invalidReasons: ['SITE_INSTANCE_MISSING'],
      evaluationStatus: 'SKIPPED',
      modelLatencyMs: null,
      evaluatedAt: null,
    }
  }
  if (outcome === 'failed') {
    return {
      ...base,
      candidateValidity: null,
      evaluationStatus: 'FAILED',
      modelLatencyMs: null,
      error: errorOf('BROWSER_ERROR', '후보 화면을 열지 못했습니다.', atMs),
    }
  }
  if (outcome === 'timeout') {
    return {
      ...base,
      evaluationStatus: 'FAILED',
      error: errorOf('MODEL_TIMEOUT', '모델 응답이 제한 시간을 넘겼습니다.', atMs),
    }
  }
  const second = round4((1 - spec.target) * 0.6)
  return {
    ...base,
    probabilities: {
      [SEMANTIC_KEY]: spec.target,
      '상단 메뉴>/shop/mypage#1': second,
      '상단 메뉴>/shop/support#1': round4(1 - spec.target - second),
    },
    targetOptionProbability: spec.target,
    goalPathProbability: spec.goalPath,
    goalPathBasis: 'ALLOWED_PATHS',
  }
}

/** 이 시각까지 평가가 끝난 후보 수(실패·건너뜀 포함) */
function evaluatedCount(rec: OptimizationRecord, nowMs: number): number {
  const done = Math.floor((nowMs - rec.createdAtMs - EVAL_START_MS) / EVAL_STEP_MS)
  return Math.min(evaluatedTotal(rec), Math.max(0, done))
}

/** 후보 선정 결과. 완료된 후보 중 C2가 가장 높다. 실패·건너뛴 후보는 제외 이유와 함께 남긴다 */
function selectionOf(rec: OptimizationRecord): OptimizationSelectionDto {
  const excluded: { candidateId: string; reasonCodes: string[] }[] = []
  CANDIDATES.forEach((spec, index) => {
    const outcome = outcomeOf(rec.scenario, index)
    if (outcome === 'failed') excluded.push({ candidateId: spec.candidateId, reasonCodes: ['EVALUATION_FAILED'] })
    if (outcome === 'skipped') excluded.push({ candidateId: spec.candidateId, reasonCodes: ['INVALID_CANDIDATE'] })
  })
  return {
    recommendedCandidateId: 'C2',
    verificationCandidateId: 'C2',
    recommendationStatus: 'RECOMMENDED',
    selectionPolicyVersion: 'selection-v1',
    selectionReasonCode: 'HIGHEST_TARGET_OPTION_PROBABILITY',
    excludedCandidates: excluded,
  }
}

// ---- 검증 ----

/** 검증을 시작한 기록에서 만드는 검증 Run. 기준(`before`)이 끝난 뒤 후보(`after`)를 만든다. 사이트가 바뀐 시나리오는 Run을 만들지 않는다 */
export function verificationRuns(rec: OptimizationRecord): RunRecord[] {
  if (rec.verifyAtMs === undefined || rec.scenario === 'site-changed') return []
  const context = (index: number, role: 'BASELINE' | 'CANDIDATE') => ({
    optimizationId: rec.optimizationId,
    candidateId: CANDIDATES[index].candidateId,
    label: CANDIDATES[index].label,
    siteInstanceId: CANDIDATES[index].siteInstanceId,
    executionRole: role,
  })
  const common = {
    experimentKey: rec.optimizationId,
    goalId: 'refund',
    personaId: 'novice-shopper',
    maxSteps: 8,
  }
  const baseline: RunRecord = {
    ...common,
    runId: baselineRunId(rec.optimizationId),
    variant: 'before',
    createdAtMs: rec.verifyAtMs + RECHECK_MS,
    optimizationContext: context(0, 'BASELINE'),
  }
  const candidate: RunRecord = {
    ...common,
    runId: candidateRunId(rec.optimizationId),
    variant: 'after',
    createdAtMs: getTiming(baseline, 0).finishedAtMs + GAP_MS,
    optimizationContext: context(2, 'CANDIDATE'),
  }
  return [baseline, candidate]
}

interface VerificationState {
  status: OptimizationStatus
  phase: VerificationPhase | null
  baselineRun: RunRecord | null
  candidateRun: RunRecord | null
  failed: boolean
}

function verificationState(rec: OptimizationRecord, nowMs: number): VerificationState {
  const empty = { baselineRun: null, candidateRun: null }
  if (rec.verifyAtMs === undefined || nowMs < rec.verifyAtMs) {
    return { ...empty, status: 'EVALUATED', phase: null, failed: false }
  }
  if (rec.scenario === 'site-changed') {
    return nowMs >= rec.verifyAtMs + RECHECK_MS
      ? { ...empty, status: 'FAILED', phase: null, failed: true }
      : { ...empty, status: 'VERIFYING', phase: 'BASELINE', failed: false }
  }
  const [baseline, candidate] = verificationRuns(rec)
  const baselineRun = nowMs >= baseline.createdAtMs ? baseline : null
  const candidateRun = nowMs >= candidate.createdAtMs ? candidate : null
  const doneAtMs = getTiming(candidate, 0).finishedAtMs + GAP_MS
  if (nowMs >= doneAtMs) {
    return { status: 'COMPLETED', phase: null, baselineRun, candidateRun, failed: false }
  }
  return {
    status: 'VERIFYING',
    phase: candidateRun ? 'CANDIDATE' : 'BASELINE',
    baselineRun,
    candidateRun,
    failed: false,
  }
}

/** 상태가 `CREATED`·`EVALUATING`·`VERIFYING`이면 진행 중이다(BE `ACTIVE_STATUSES`). `EVALUATED`는 작업이 없어 진행 중이 아니다 */
export const isActiveStatus = (status: string) =>
  status === 'CREATED' || status === 'EVALUATING' || status === 'VERIFYING'

export function statusOf(rec: OptimizationRecord, nowMs: number): OptimizationStatus {
  return buildOptimization(rec, nowMs).status
}

/** 검증을 시작할 수 있는지: 평가가 끝났고 아직 검증을 시작하지 않았다 */
export const canStartVerification = (rec: OptimizationRecord, nowMs: number) =>
  statusOf(rec, nowMs) === 'EVALUATED'

export function buildOptimization(rec: OptimizationRecord, nowMs: number): OptimizationDto {
  const elapsed = nowMs - rec.createdAtMs
  const total = evaluatedTotal(rec)
  const count = evaluatedCount(rec, nowMs)
  const evaluations = Array.from({ length: count }, (_, i) => evaluationOf(rec, i))
  const evaluationDone = count >= total
  const evalFailAtMs = rec.createdAtMs + EVAL_START_MS + total * EVAL_STEP_MS

  let status: OptimizationStatus
  let phase: VerificationPhase | null = null
  let error: OptimizationErrorDto | null = null
  let baselineRun: RunRecord | null = null
  let candidateRun: RunRecord | null = null

  if (!evaluationDone) {
    status = elapsed < EVAL_START_MS ? 'CREATED' : 'EVALUATING'
  } else if (rec.scenario === 'eval-timeout') {
    status = 'FAILED'
    error = errorOf('MODEL_TIMEOUT', '모델 응답이 제한 시간을 넘겼습니다.', evalFailAtMs, {
      failedPhase: 'EVALUATING',
      lastStatus: 'EVALUATING',
    })
  } else if (rec.scenario === 'interrupted') {
    status = 'FAILED'
    error = errorOf('OPTIMIZATION_INTERRUPTED', '서버 재시작으로 중단되었습니다.', evalFailAtMs, {
      failedPhase: 'EVALUATING',
      lastStatus: 'EVALUATING',
    })
  } else {
    const v = verificationState(rec, nowMs)
    status = v.status
    phase = v.phase
    baselineRun = v.baselineRun
    candidateRun = v.candidateRun
    if (v.failed) {
      error = errorOf(
        'SITE_INSTANCE_CHANGED',
        '후보 C2의 화면이 평가 때와 다릅니다.',
        (rec.verifyAtMs ?? 0) + RECHECK_MS,
        { failedPhase: 'VERIFYING', lastStatus: 'VERIFYING' },
      )
    }
  }

  const selected = status === 'EVALUATED' || status === 'VERIFYING' || status === 'COMPLETED'
    || (status === 'FAILED' && error?.failedPhase === 'VERIFYING')
  const selection = selected ? selectionOf(rec) : null
  const completed = status === 'COMPLETED'

  return {
    schemaVersion: '1.0',
    optimizationId: rec.optimizationId,
    status,
    verificationPhase: phase,
    sourceRunId: rec.sourceRunId,
    target: { pageKey: 'home', semanticKey: SEMANTIC_KEY, originalLabel: '이용정보' },
    candidateLabels: CANDIDATES.map((c, i) => ({
      candidateId: c.candidateId,
      label: c.label,
      role: c.role,
      candidateOrder: i,
    })),
    evaluations,
    progress: { evaluatedCount: count, totalCount: CANDIDATES.length },
    selection,
    recommendedCandidateId: selection?.recommendedCandidateId ?? null,
    verificationCandidateId: selection?.verificationCandidateId ?? null,
    recommendationStatus: selection?.recommendationStatus ?? null,
    baselineRunId: baselineRun?.runId ?? null,
    validationRunId: candidateRun?.runId ?? null,
    verification: completed
      ? {
          finalDecision: 'IMPROVEMENT_CONFIRMED',
          reasonCode: 'GOAL_REACHED_WITH_LOWER_COST',
          verificationPolicyVersion: 'verification-v1',
        }
      : null,
    finalDecision: completed ? 'IMPROVEMENT_CONFIRMED' : null,
    resultOrigin: 'MOCK',
    error,
    createdAt: iso(rec.createdAtMs),
    updatedAt: elapsed >= EVAL_START_MS ? iso(Math.min(nowMs, rec.createdAtMs + EVAL_START_MS)) : null,
  }
}

function outcomeOfRun(rec: RunRecord, nowMs: number): OptimizerRunOutcomeDto {
  const run = buildRun(rec, nowMs)
  const summary = run.summary
  return {
    runId: run.runId,
    variant: run.variant,
    executionRole: rec.optimizationContext?.executionRole ?? null,
    label: rec.optimizationContext?.label ?? null,
    status: run.status,
    terminationReason: run.terminationReason,
    validity: run.validity,
    resultOrigin: run.resultOrigin,
    goalReached: summary?.goalReached ?? null,
    stepCount: summary?.stepCount ?? null,
    navigationCost: summary?.navigationCost ?? null,
    backCount: summary?.backCount ?? null,
    path: summary?.path.map((visit) => visit.pageKey) ?? [],
    executionTimeMs: summary?.executionTimeMs ?? null,
  }
}

/** 완료된 Optimization의 보고서. 완료되지 않았으면 `null`(호출하는 쪽이 `409 OPTIMIZATION_NOT_READY`로 바꾼다) */
export function buildReport(
  rec: OptimizationRecord,
  nowMs: number,
): OptimizationReportDto | null {
  const dto = buildOptimization(rec, nowMs)
  const [baseline, candidate] = verificationRuns(rec)
  if (dto.status !== 'COMPLETED' || !baseline || !candidate) return null
  return {
    schemaVersion: '1.0',
    optimizationId: dto.optimizationId,
    status: dto.status,
    finalDecision: dto.finalDecision,
    resultOrigin: dto.resultOrigin,
    target: dto.target,
    selection: dto.selection,
    recommendationStatus: dto.recommendationStatus,
    recommendedCandidateId: dto.recommendedCandidateId,
    verificationCandidateId: dto.verificationCandidateId,
    evaluations: dto.evaluations,
    verification: dto.verification,
    runs: { baseline: outcomeOfRun(baseline, nowMs), candidate: outcomeOfRun(candidate, nowMs) },
    policyVersions: { selection: 'selection-v1', verification: 'verification-v1' },
    modelMetadata: { modelVersion: 'mock', modelEndpointId: 'mock-endpoint', promptVersion: 'v2' },
    frozenConditions: {
      goal: '환불 신청 화면 찾기',
      persona: '쇼핑몰을 처음 쓰는 사용자',
      startPath: '/shop/home',
    },
    executionMetadata: {
      modelCallCount: dto.evaluations.filter((e) => e.evaluationStatus === 'COMPLETED').length,
      evaluationTimeMs: evaluatedTotal(rec) * EVAL_STEP_MS,
      verificationTimeMs: 20000,
    },
    limitations: {
      baselineRunCount: 1,
      candidateRunCount: 1,
      repeated: false,
      note: 'MOCK 데이터입니다. 기준·후보를 각각 한 번 실행한 결과라 반복 실행으로 확인하지 않았습니다.',
    },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

/** 처음부터 있는 시드. 현재 시각과 상관없이 종료·대기 상태로 시작한다 */
const seed = (
  id: string,
  scenario: OptimizationScenario,
  offsetMin: number,
  verified = false,
): OptimizationRecord => ({
  optimizationId: id,
  scenario,
  sourceRunId: null,
  createdAtMs: SEED_AT_MS + offsetMin * 60_000,
  ...(verified ? { verifyAtMs: SEED_AT_MS + offsetMin * 60_000 + 60_000 } : {}),
})

export const OPTIMIZATION_SEEDS: OptimizationRecord[] = [
  seed('opt_mock_evaluated', 'success', 40),
  seed('opt_mock_completed', 'success', 42, true),
  seed('opt_mock_partial', 'partial', 44),
  seed('opt_mock_eval_timeout', 'eval-timeout', 46),
  seed('opt_mock_site_changed', 'site-changed', 48, true),
  seed('opt_mock_interrupted', 'interrupted', 50),
]
