import type { StepDto, StepListDto } from '../api/dto/index.ts'
import type { Step } from '../domain/types.ts'
import { toErrorInfoOrNull } from './common.ts'

export function toStep(dto: StepDto): Step {
  const { page, candidateSet, decision, action } = dto
  return {
    stepId: dto.stepId,
    timestamp: dto.timestamp,
    page: {
      pageKey: page.pageKey,
      path: page.path,
      title: page.title,
      viewport: page.viewport,
      screenshotSize: page.screenshotSize,
      scroll: page.scroll,
    },
    candidates: candidateSet.candidates.map((candidate) => ({
      optionId: candidate.optionId,
      label: candidate.label,
      region: candidate.region,
      context: candidate.context,
      href: candidate.href,
      bbox: candidate.bbox,
      semanticKey: candidate.semanticKey,
      probability: candidate.probability,
      selected: candidate.selected,
    })),
    backOptionId: candidateSet.backOptionId,
    decision: {
      selectedOptionId: decision.selectedOptionId,
      selectedActionType: decision.selectedActionType,
      resultOrigin: decision.resultOrigin,
      goalJudgmentMode: decision.goalJudgmentMode,
      modelGoalReached: decision.modelGoalReached,
      modelGoalYesProb: decision.modelGoalYesProb,
      verifiedGoalReached: decision.verifiedGoalReached,
      goalJudgmentMismatch: decision.goalJudgmentMismatch,
      normalizedEntropy: decision.normalizedEntropy,
      clickOnlyNormalizedEntropy: decision.clickOnlyNormalizedEntropy,
      goBackProbability: decision.goBackProbability,
      top2Margin: decision.top2Margin,
      clickOnlyTop2Margin: decision.clickOnlyTop2Margin,
      goalPathProbability: decision.goalPathProbability,
      modelLatencyMs: decision.modelLatencyMs,
      metricWarnings: decision.metricWarnings,
    },
    action: {
      selectedOptionId: action.selectedOptionId,
      executedOptionId: action.executedOptionId,
      actionType: action.actionType,
      result: action.result,
      reason: action.reason,
      executed: action.executed,
      fromPath: action.fromPath,
      toPath: action.toPath,
    },
    statusAfterStep: dto.statusAfterStep,
    error: toErrorInfoOrNull(dto.error),
  }
}

/** 서버 순서(실행 순서)를 그대로 유지한다. `stepId`로 다시 정렬하지 않는다(계약 §3.7). */
export function toStepList(dto: StepListDto): Step[] {
  return dto.items.map(toStep)
}
