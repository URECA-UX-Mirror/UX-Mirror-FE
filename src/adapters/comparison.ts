import type {
  ComparisonResultDto,
  RunOutcomeDto,
  ScreenComparisonDto,
  ScreenMetricComparisonDto,
} from '../api/dto/index.ts'
import type {
  Comparison,
  RunOutcome,
  ScreenComparison,
  ScreenMetrics,
} from '../domain/types.ts'
import { toPathVisits } from './run.ts'

function toScreenMetrics(dto: ScreenMetricComparisonDto): ScreenMetrics {
  return {
    normalizedEntropy: {
      before: dto.beforeNormalizedEntropy,
      after: dto.afterNormalizedEntropy,
      delta: dto.deltaNormalizedEntropy,
    },
    clickOnlyNormalizedEntropy: {
      before: dto.beforeClickOnlyNormalizedEntropy,
      after: dto.afterClickOnlyNormalizedEntropy,
      delta: dto.deltaClickOnlyNormalizedEntropy,
    },
    top2Margin: {
      before: dto.beforeTop2Margin,
      after: dto.afterTop2Margin,
      delta: dto.deltaTop2Margin,
    },
    clickOnlyTop2Margin: {
      before: dto.beforeClickOnlyTop2Margin,
      after: dto.afterClickOnlyTop2Margin,
      delta: dto.deltaClickOnlyTop2Margin,
    },
    goBackProbability: {
      before: dto.beforeGoBackProbability,
      after: dto.afterGoBackProbability,
      delta: dto.deltaGoBackProbability,
    },
    goalPathProbability: {
      before: dto.beforeGoalPathProbability,
      after: dto.afterGoalPathProbability,
      delta: dto.deltaGoalPathProbability,
    },
  }
}

function toScreenComparison(dto: ScreenComparisonDto): ScreenComparison {
  return {
    pageKey: dto.pageKey,
    beforeStepId: dto.beforeStepId,
    afterStepId: dto.afterStepId,
    screenComparable: dto.screenComparable,
    reason: dto.reason,
    candidateSetMatched: dto.candidateSetMatched,
    actionSetIncludesBack: dto.actionSetIncludesBack,
    candidateComparisons: dto.candidateComparisons.map((c) => ({
      semanticKey: c.semanticKey,
      beforeLabel: c.beforeLabel,
      afterLabel: c.afterLabel,
      beforeProbability: c.beforeProbability,
      afterProbability: c.afterProbability,
      deltaProbability: c.deltaProbability,
      comparable: c.comparable,
      reason: c.reason,
    })),
    metrics: dto.metrics ? toScreenMetrics(dto.metrics) : null,
  }
}

function toRunOutcome(dto: RunOutcomeDto): RunOutcome {
  return {
    goalReached: dto.goalReached,
    status: dto.status,
    terminationReason: dto.terminationReason,
    stepCount: dto.stepCount,
    successfulNavigationClickCount: dto.successfulNavigationClickCount,
    modelBackCount: dto.modelBackCount,
    systemBackCount: dto.systemBackCount,
    backCount: dto.backCount,
    navigationCost: dto.navigationCost,
    extraSteps: dto.extraSteps,
    extraNavigationCost: dto.extraNavigationCost,
    referencePathDeviationCount: dto.referencePathDeviationCount,
    detourMoveCount: dto.detourMoveCount ?? null,
    path: toPathVisits(dto.path),
    detectedIssueTypes: dto.detectedIssueTypes,
  }
}

export function toComparison(dto: ComparisonResultDto): Comparison {
  return {
    experimentKey: dto.experimentKey,
    beforeRunId: dto.beforeRunId,
    afterRunId: dto.afterRunId,
    comparisonStatus: dto.comparisonStatus,
    conditionsMatched: dto.conditionsMatched,
    conditionChecks: dto.conditionChecks.map((check) => ({
      code: check.code,
      matched: check.matched,
      message: check.message,
    })),
    layoutMatched: dto.layoutMatched,
    screenComparisons: dto.screenComparisons.map(toScreenComparison),
    runComparison: {
      before: toRunOutcome(dto.runComparison.before),
      after: toRunOutcome(dto.runComparison.after),
    },
    beforeResultOrigin: dto.beforeResultOrigin,
    afterResultOrigin: dto.afterResultOrigin,
    resultOrigin: dto.resultOrigin,
    createdAt: dto.createdAt,
  }
}
