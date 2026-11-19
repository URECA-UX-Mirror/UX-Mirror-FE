import type {
  CreateRunResponseDto,
  PathVisitDto,
  ReferenceBasis,
  ReferencePathConfigDto,
  RunDto,
  RunListDto,
  RunSummaryDto,
} from '../api/dto/index.ts'
import type {
  CreatedRun,
  Open,
  PathVisit,
  Run,
  RunListItem,
  RunSummary,
} from '../domain/types.ts'
import { toErrorInfoOrNull } from './common.ts'

function toPathVisit(dto: PathVisitDto): PathVisit {
  return {
    sequence: dto.sequence,
    pageKey: dto.pageKey,
    path: dto.path,
    enteredBy: dto.enteredBy,
    visitCause: dto.visitCause,
    stepId: dto.stepId,
  }
}

export function toPathVisits(dtos: PathVisitDto[]): PathVisit[] {
  return dtos.map(toPathVisit)
}

// null 가능 필드(extraSteps 등)는 null 그대로 둔다. 0으로 바꾸지 않는다(계약 §6.4).
function toRunSummary(dto: RunSummaryDto): RunSummary {
  return {
    goalReached: dto.goalReached,
    stepCount: dto.stepCount,
    stepRecordCount: dto.stepRecordCount,
    modelCallCount: dto.modelCallCount,
    clickCount: dto.clickCount,
    successfulNavigationClickCount: dto.successfulNavigationClickCount,
    modelBackCount: dto.modelBackCount,
    systemBackCount: dto.systemBackCount,
    backCount: dto.backCount,
    revisitCount: dto.revisitCount,
    referencePathDeviationCount: dto.referencePathDeviationCount,
    navigationCost: dto.navigationCost,
    extraSteps: dto.extraSteps,
    extraNavigationCost: dto.extraNavigationCost,
    attemptedExtraSteps: dto.attemptedExtraSteps,
    detourMoveCount: dto.detourMoveCount ?? null,
    executionTimeMs: dto.executionTimeMs,
    path: toPathVisits(dto.path),
    detectedIssueTypes: dto.detectedIssueTypes,
  }
}

/** 설정이 없거나 null이면 기준 없음이고, 설정에 basis가 없으면 ALLOWED_PATHS다. */
export function toReferenceBasis(
  config: ReferencePathConfigDto | null | undefined,
): Open<ReferenceBasis> | null {
  if (config == null) return null
  return config.basis ?? 'ALLOWED_PATHS'
}

export function toRun(dto: RunDto): Run {
  return {
    runId: dto.runId,
    experimentKey: dto.experimentKey,
    variant: dto.variant,
    resultOrigin: dto.resultOrigin,
    goalId: dto.goalId,
    goal: dto.goal,
    personaId: dto.personaId,
    persona: dto.persona,
    verification: dto.verification ?? null,
    referenceBasis: toReferenceBasis(dto.referencePathConfig),
    viewport: dto.viewport,
    maxSteps: dto.limits.maxSteps,
    status: dto.status,
    createdAt: dto.createdAt,
    startedAt: dto.startedAt,
    finishedAt: dto.finishedAt,
    terminationReason: dto.terminationReason,
    progress: {
      stepRecordCount: dto.progress.stepRecordCount,
      stepCount: dto.progress.stepCount,
      maxSteps: dto.progress.maxSteps,
      currentPageKey: dto.progress.currentPageKey,
      lastUpdatedAt: dto.progress.lastUpdatedAt,
    },
    summary: dto.summary ? toRunSummary(dto.summary) : null,
    error: toErrorInfoOrNull(dto.error),
    validity: dto.validity,
    invalidReason: dto.invalidReason,
    replacementRunId: dto.replacementRunId,
    siteId: dto.siteId ?? null,
    mode: dto.mode ?? null,
    optimizationContext: toOptimizationContext(dto.optimizationContext),
    improvementContext: toImprovementContext(dto.improvementContext),
  }
}

/** 필드가 없거나 `null`이거나 `improvementId`·`label`이 문자열이 아니면 일반 Run이다 */
function toImprovementContext(dto: RunDto['improvementContext']): Run['improvementContext'] {
  if (!dto || typeof dto.improvementId !== 'string' || typeof dto.label !== 'string') return null
  return {
    improvementId: dto.improvementId,
    goalId: dto.goalId,
    label: dto.label,
    siteInstanceId: dto.siteInstanceId,
    executionRole: dto.executionRole,
  }
}

/** 필드가 없거나 `null`이거나 `optimizationId`가 문자열이 아니면 일반 Run이다. 모르는 `executionRole`은 그대로 둔다 */
function toOptimizationContext(
  dto: RunDto['optimizationContext'],
): Run['optimizationContext'] {
  if (!dto || typeof dto.optimizationId !== 'string') return null
  return {
    optimizationId: dto.optimizationId,
    candidateId: dto.candidateId,
    label: dto.label,
    siteInstanceId: dto.siteInstanceId,
    executionRole: dto.executionRole,
  }
}

/** 서버 순서(최신순)를 그대로 유지한다. */
export function toRunList(dto: RunListDto): RunListItem[] {
  return dto.items.map((item) => ({
    runId: item.runId,
    experimentKey: item.experimentKey,
    variant: item.variant,
    status: item.status,
    terminationReason: item.terminationReason,
    validity: item.validity,
    replacementRunId: item.replacementRunId,
    resultOrigin: item.resultOrigin,
    goalReached: item.goalReached,
    createdAt: item.createdAt,
    finishedAt: item.finishedAt,
    siteId: item.siteId ?? null,
    mode: item.mode ?? null,
    optimizationContext: toOptimizationContext(item.optimizationContext),
  }))
}

export function toCreatedRun(dto: CreateRunResponseDto): CreatedRun {
  return {
    runId: dto.runId,
    experimentKey: dto.experimentKey,
    variant: dto.variant,
    status: dto.status,
    maxSteps: dto.maxSteps,
    createdAt: dto.createdAt,
  }
}
