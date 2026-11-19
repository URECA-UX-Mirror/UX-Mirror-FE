import type {
  CandidateEvaluationDto,
  CreateOptimizationResponseDto,
  OptimizationDto,
  OptimizationErrorDto,
  OptimizationReportDto,
  OptimizationSelectionDto,
  OptimizationVerificationDto,
  OptimizerRunOutcomeDto,
  StartVerificationResponseDto,
} from '../api/dto/index.ts'
import type {
  CandidateEvaluation,
  CreatedOptimization,
  Optimization,
  OptimizationError,
  OptimizationReport,
  OptimizationSelection,
  OptimizationVerification,
  OptimizerRunOutcome,
  StartedVerification,
} from '../domain/types.ts'

// 임시(OI-12): 계약 v1.3.8 §17.12·§4.9·§6.1과 BE README 기준이다. 모르는 상태·이유 코드는 오류로 만들지 않고 원문을 그대로 둔다.

/** 계산할 수 없는 지표는 `null`이다. 숫자가 아닌 값(문자열·`NaN`)을 0으로 바꾸지 않는다 */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** `details`는 화면에 표시하지 않으므로 가져오지 않는다 */
function toOptimizationError(
  dto: OptimizationErrorDto | null | undefined,
): OptimizationError | null {
  if (!dto) return null
  return {
    code: dto.code,
    message: dto.message,
    retryable: dto.retryable === true,
    occurredAt: dto.occurredAt ?? null,
    failedPhase: stringOrNull(dto.failedPhase),
    lastStatus: stringOrNull(dto.lastStatus),
  }
}

function toProbabilities(
  value: CandidateEvaluationDto['probabilities'] | undefined,
): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null
  const result: Record<string, number> = {}
  for (const [key, probability] of Object.entries(value)) {
    const parsed = numberOrNull(probability)
    if (parsed !== null) result[key] = parsed
  }
  return result
}

function toNullReasons(
  value: CandidateEvaluationDto['metricNullReasons'] | undefined,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!value || typeof value !== 'object') return result
  for (const [metric, reason] of Object.entries(value)) {
    if (typeof reason === 'string') result[metric] = reason
  }
  return result
}

export function toCandidateEvaluation(
  dto: CandidateEvaluationDto,
): CandidateEvaluation {
  const error = toOptimizationError(dto.error)
  return {
    candidateId: dto.candidateId,
    candidateOrder: dto.candidateOrder,
    label: dto.label,
    role: dto.role,
    semanticClarityRank: numberOrNull(dto.semanticClarityRank),
    siteInstanceId: dto.siteInstanceId ?? null,
    candidateValidity: dto.candidateValidity ?? null,
    invalidReasons: stringList(dto.invalidReasons),
    evaluationStatus: dto.evaluationStatus ?? null,
    probabilities: toProbabilities(dto.probabilities),
    targetOptionProbability: numberOrNull(dto.targetOptionProbability),
    goalPathProbability: numberOrNull(dto.goalPathProbability),
    goalPathBasis: stringOrNull(dto.goalPathBasis),
    metricNullReasons: toNullReasons(dto.metricNullReasons),
    modelLatencyMs: numberOrNull(dto.modelLatencyMs),
    error: error && {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      occurredAt: error.occurredAt,
    },
    evaluatedAt: dto.evaluatedAt ?? null,
  }
}

/** 선정 결과가 없으면 `null`. 이유 코드는 정책 모듈이 정하는 값이라 문자열 원문을 그대로 둔다 */
export function toSelection(
  dto: OptimizationSelectionDto | null | undefined,
): OptimizationSelection | null {
  if (!dto || typeof dto !== 'object') return null
  return {
    recommendedCandidateId: stringOrNull(dto.recommendedCandidateId),
    verificationCandidateId: stringOrNull(dto.verificationCandidateId),
    recommendationStatus: stringOrNull(dto.recommendationStatus),
    policyVersion: stringOrNull(dto.selectionPolicyVersion),
    reasonCode: stringOrNull(dto.selectionReasonCode),
    excludedCandidates: (dto.excludedCandidates ?? []).map((item) => ({
      candidateId: item.candidateId,
      reasonCodes: stringList(item.reasonCodes),
    })),
  }
}

/** 최종 판단은 `finalDecision`이 우선이고, 없으면 `decision`(BE가 둘 중 하나로 받는다) */
export function toVerification(
  dto: OptimizationVerificationDto | null | undefined,
): OptimizationVerification | null {
  if (!dto || typeof dto !== 'object') return null
  return {
    decision: stringOrNull(dto.finalDecision ?? dto.decision),
    reasonCode: stringOrNull(dto.reasonCode),
    policyVersion: stringOrNull(dto.verificationPolicyVersion),
  }
}

export function toOptimization(dto: OptimizationDto): Optimization {
  return {
    optimizationId: dto.optimizationId,
    status: dto.status,
    verificationPhase: dto.verificationPhase ?? null,
    sourceRunId: dto.sourceRunId ?? null,
    target: {
      pageKey: dto.target.pageKey,
      semanticKey: dto.target.semanticKey,
      originalLabel: dto.target.originalLabel,
    },
    candidates: (dto.candidateLabels ?? []).map((item) => ({
      candidateId: item.candidateId,
      label: item.label,
      role: item.role,
      candidateOrder: item.candidateOrder,
    })),
    evaluations: (dto.evaluations ?? []).map(toCandidateEvaluation),
    progress: {
      evaluatedCount: numberOrNull(dto.progress?.evaluatedCount) ?? 0,
      totalCount: numberOrNull(dto.progress?.totalCount) ?? 0,
    },
    selection: toSelection(dto.selection),
    recommendedCandidateId: dto.recommendedCandidateId ?? null,
    verificationCandidateId: dto.verificationCandidateId ?? null,
    recommendationStatus: dto.recommendationStatus ?? null,
    baselineRunId: dto.baselineRunId ?? null,
    validationRunId: dto.validationRunId ?? null,
    verification: toVerification(dto.verification),
    finalDecision: dto.finalDecision ?? null,
    resultOrigin: dto.resultOrigin,
    error: toOptimizationError(dto.error),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? null,
  }
}

export function toCreatedOptimization(
  dto: CreateOptimizationResponseDto,
): CreatedOptimization {
  return {
    optimizationId: dto.optimizationId,
    status: dto.status,
    createdAt: dto.createdAt,
  }
}

export function toStartedVerification(
  dto: StartVerificationResponseDto,
): StartedVerification {
  return {
    optimizationId: dto.optimizationId,
    status: dto.status,
    verificationPhase: dto.verificationPhase ?? null,
    baselineRunId: dto.baselineRunId ?? null,
    validationRunId: dto.validationRunId ?? null,
  }
}

function toRunOutcome(dto: OptimizerRunOutcomeDto): OptimizerRunOutcome {
  return {
    runId: dto.runId,
    variant: dto.variant,
    executionRole: dto.executionRole ?? null,
    label: dto.label ?? null,
    status: dto.status,
    terminationReason: dto.terminationReason ?? null,
    validity: dto.validity ?? null,
    resultOrigin: dto.resultOrigin,
    goalReached: typeof dto.goalReached === 'boolean' ? dto.goalReached : null,
    stepCount: numberOrNull(dto.stepCount),
    navigationCost: numberOrNull(dto.navigationCost),
    backCount: numberOrNull(dto.backCount),
    path: stringList(dto.path),
    executionTimeMs: numberOrNull(dto.executionTimeMs),
  }
}

export function toOptimizationReport(
  dto: OptimizationReportDto,
): OptimizationReport {
  return {
    optimizationId: dto.optimizationId,
    status: dto.status,
    finalDecision: dto.finalDecision ?? null,
    resultOrigin: dto.resultOrigin,
    target: {
      pageKey: dto.target.pageKey,
      semanticKey: dto.target.semanticKey,
      originalLabel: dto.target.originalLabel,
    },
    selection: toSelection(dto.selection),
    recommendationStatus: dto.recommendationStatus ?? null,
    recommendedCandidateId: dto.recommendedCandidateId ?? null,
    verificationCandidateId: dto.verificationCandidateId ?? null,
    evaluations: (dto.evaluations ?? []).map(toCandidateEvaluation),
    verification: toVerification(dto.verification),
    runs: {
      baseline: toRunOutcome(dto.runs.baseline),
      candidate: toRunOutcome(dto.runs.candidate),
    },
    policyVersions: {
      selection: dto.policyVersions?.selection ?? null,
      verification: dto.policyVersions?.verification ?? null,
    },
    model: {
      modelVersion: dto.modelMetadata?.modelVersion ?? null,
      modelEndpointId: dto.modelMetadata?.modelEndpointId ?? null,
      promptVersion: dto.modelMetadata?.promptVersion ?? null,
    },
    conditions: {
      goal: dto.frozenConditions.goal,
      persona: dto.frozenConditions.persona,
      startPath: dto.frozenConditions.startPath,
    },
    executionMetadata: {
      modelCallCount: numberOrNull(dto.executionMetadata?.modelCallCount) ?? 0,
      evaluationTimeMs: numberOrNull(dto.executionMetadata?.evaluationTimeMs),
      verificationTimeMs: numberOrNull(dto.executionMetadata?.verificationTimeMs),
    },
    limitations: {
      baselineRunCount: dto.limitations.baselineRunCount,
      candidateRunCount: dto.limitations.candidateRunCount,
      repeated: dto.limitations.repeated,
      note: dto.limitations.note,
    },
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt ?? null,
  }
}
