import type {
  CreateRunResponseDto,
  PathVisitDto,
  RunDto,
  RunSummaryDto,
} from '../api/dto/index.ts'
import type {
  CreatedRun,
  PathVisit,
  Run,
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
    executionTimeMs: dto.executionTimeMs,
    path: toPathVisits(dto.path),
    detectedIssueTypes: dto.detectedIssueTypes,
  }
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
  }
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
