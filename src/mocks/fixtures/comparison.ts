import type {
  CandidateComparisonDto,
  ComparisonResultDto,
  RunOutcomeDto,
  ScreenComparisonDto,
  ScreenMetricComparisonDto,
  StepDto,
} from '../../api/dto/index.ts'
import type { RunRecord } from '../store.ts'
import { buildSteps, buildSummary, isMaxStepsStopped } from './run.ts'

const round = (value: number) => Math.round(value * 10000) / 10000
const delta = (before: number | null, after: number | null) =>
  before === null || after === null ? null : round(after - before)

// 계약 §15.2의 필수 조건 코드 21개
const CONDITION_CODES = [
  'MODEL_VERSION_MATCHED',
  'MODEL_ENDPOINT_MATCHED',
  'DECISION_MODE_MATCHED',
  'PROMPT_VERSION_MATCHED',
  'GOAL_MATCHED',
  'PERSONA_MATCHED',
  'GOAL_JUDGMENT_MODE_MATCHED',
  'MAX_STEPS_MATCHED',
  'BACK_LIMITS_MATCHED',
  'START_PATH_MATCHED',
  'BROWSER_STATE_MATCHED',
  'VIEWPORT_MATCHED',
  'SITE_VERSION_MATCHED',
  'LAYOUT_MATCHED',
  'MODEL_PAYLOAD_LEAK_CHECK_PASSED',
  'TEMPERATURE_MATCHED',
  'THRESHOLD_CONFIG_MATCHED',
  'ANALYSIS_VERSION_MATCHED',
  'REFERENCE_PATH_CONFIG_MATCHED',
  'CANDIDATE_POLICY_MATCHED',
  'RESULT_ORIGIN_MATCHED',
] as const

/** 지표 delta. `conditionsMatched=false`이면 값은 남기고 delta만 null이다(계약 §15.5). */
function metrics(
  before: StepDto,
  after: StepDto,
  deltas: boolean,
): ScreenMetricComparisonDto {
  const b = before.decision
  const a = after.decision
  const d = (x: number | null, y: number | null) => (deltas ? delta(x, y) : null)
  return {
    beforeNormalizedEntropy: b.normalizedEntropy,
    afterNormalizedEntropy: a.normalizedEntropy,
    deltaNormalizedEntropy: d(b.normalizedEntropy, a.normalizedEntropy),
    beforeClickOnlyNormalizedEntropy: b.clickOnlyNormalizedEntropy,
    afterClickOnlyNormalizedEntropy: a.clickOnlyNormalizedEntropy,
    deltaClickOnlyNormalizedEntropy: d(
      b.clickOnlyNormalizedEntropy,
      a.clickOnlyNormalizedEntropy,
    ),
    beforeTop2Margin: b.top2Margin,
    afterTop2Margin: a.top2Margin,
    deltaTop2Margin: d(b.top2Margin, a.top2Margin),
    beforeClickOnlyTop2Margin: b.clickOnlyTop2Margin,
    afterClickOnlyTop2Margin: a.clickOnlyTop2Margin,
    deltaClickOnlyTop2Margin: d(b.clickOnlyTop2Margin, a.clickOnlyTop2Margin),
    beforeGoBackProbability: b.goBackProbability,
    afterGoBackProbability: a.goBackProbability,
    deltaGoBackProbability: d(b.goBackProbability, a.goBackProbability),
    beforeGoalPathProbability: b.goalPathProbability,
    afterGoalPathProbability: a.goalPathProbability,
    deltaGoalPathProbability: d(b.goalPathProbability, a.goalPathProbability),
  }
}

function candidateComparisons(
  before: StepDto,
  after: StepDto,
  screenReason: string | null,
): CandidateComparisonDto[] {
  const beforeByKey = new Map(
    before.candidateSet.candidates.map((c) => [c.semanticKey, c]),
  )
  const afterByKey = new Map(
    after.candidateSet.candidates.map((c) => [c.semanticKey, c]),
  )
  // Before 순서 먼저, After에만 있는 후보는 뒤에(계약 §15.4)
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])]
  return keys.map((semanticKey) => {
    const b = beforeByKey.get(semanticKey)
    const a = afterByKey.get(semanticKey)
    const bothHave = b !== undefined && a !== undefined
    const comparable = screenReason === null && bothHave
    return {
      semanticKey,
      beforeLabel: b?.label ?? null,
      afterLabel: a?.label ?? null,
      beforeProbability: b?.probability ?? null,
      afterProbability: a?.probability ?? null,
      deltaProbability: comparable ? delta(b.probability, a.probability) : null,
      comparable,
      reason: comparable
        ? null
        : (screenReason ?? 'CANDIDATE_SET_MISMATCH'),
    }
  })
}

/** pageKey마다 대표 Step 하나: `candidateSetChanged=false`인 가장 이른 Step, 없으면 가장 이른 Step */
function representatives(steps: StepDto[]): Map<string, StepDto> {
  const result = new Map<string, StepDto>()
  for (const step of steps) {
    const key = step.page.pageKey
    const current = result.get(key)
    if (!current) result.set(key, step)
    else if (
      current.candidateSet.candidateSetChanged &&
      !step.candidateSet.candidateSetChanged
    ) {
      result.set(key, step)
    }
  }
  return result
}

function outcome(rec: RunRecord): RunOutcomeDto {
  const s = buildSummary(rec)
  const stopped = isMaxStepsStopped(rec)
  return {
    goalReached: s.goalReached,
    status: stopped ? 'MAX_STEPS' : 'SUCCESS',
    terminationReason: stopped ? 'MAX_STEPS_REACHED' : 'GOAL_VERIFIED',
    stepCount: s.stepCount,
    successfulNavigationClickCount: s.successfulNavigationClickCount,
    modelBackCount: s.modelBackCount,
    systemBackCount: s.systemBackCount,
    backCount: s.backCount,
    navigationCost: s.navigationCost,
    extraSteps: s.extraSteps,
    extraNavigationCost: s.extraNavigationCost,
    referencePathDeviationCount: s.referencePathDeviationCount,
    path: s.path,
    detectedIssueTypes: s.detectedIssueTypes,
  }
}

/**
 * Before/After가 모두 종료된 뒤의 비교 결과(계약 §15). `conditionsMatched=false`이면 모든 화면이
 * 비교 불가다. `comparisonStatus`는 §4.12의 결정 규칙으로 정한다.
 */
export function buildComparison(
  before: RunRecord,
  after: RunRecord,
  conditionsMatched: boolean,
): ComparisonResultDto {
  const beforeReps = representatives(buildSteps(before, 99))
  const afterReps = representatives(buildSteps(after, 99))
  const pageKeys = [...new Set([...beforeReps.keys(), ...afterReps.keys()])]

  const screenComparisons: ScreenComparisonDto[] = pageKeys.map((pageKey) => {
    const b = beforeReps.get(pageKey)
    const a = afterReps.get(pageKey)
    if (!b || !a) {
      return {
        pageKey,
        beforeStepId: b?.stepId ?? null,
        afterStepId: a?.stepId ?? null,
        screenComparable: false,
        reason: b ? 'NOT_VISITED_IN_AFTER' : 'NOT_VISITED_IN_BEFORE',
        candidateSetMatched: false,
        actionSetIncludesBack: null,
        candidateComparisons: [],
        metrics: null,
      }
    }
    const beforeKeys = b.candidateSet.candidates.map((c) => c.semanticKey)
    const afterKeys = a.candidateSet.candidates.map((c) => c.semanticKey)
    const candidateSetMatched =
      beforeKeys.length === afterKeys.length &&
      beforeKeys.every((key, index) => key === afterKeys[index])
    const bothBack = b.candidateSet.actionSetIncludesBack
    const sameBackSet = bothBack === a.candidateSet.actionSetIncludesBack
    const reason = !conditionsMatched
      ? 'GLOBAL_CONDITIONS_MISMATCH'
      : !candidateSetMatched
        ? 'CANDIDATE_SET_MISMATCH'
        : !sameBackSet
          ? 'ACTION_SET_MISMATCH'
          : null
    return {
      pageKey,
      beforeStepId: b.stepId,
      afterStepId: a.stepId,
      screenComparable: reason === null,
      reason,
      candidateSetMatched,
      actionSetIncludesBack: sameBackSet ? bothBack : null,
      candidateComparisons: candidateComparisons(b, a, reason),
      metrics: metrics(b, a, reason === null),
    }
  })

  const comparisonStatus =
    conditionsMatched &&
    screenComparisons.some((s) => s.pageKey === 'home') &&
    screenComparisons.every((s) => s.screenComparable)
      ? 'COMPLETED'
      : 'PARTIAL'

  return {
    schemaVersion: '1.3.5',
    experimentKey: before.experimentKey,
    beforeRunId: before.runId,
    afterRunId: after.runId,
    comparisonStatus,
    conditionsMatched,
    conditionChecks: CONDITION_CODES.map((code) => {
      const failed = !conditionsMatched && code === 'MAX_STEPS_MATCHED'
      return {
        code,
        matched: !failed,
        message: failed ? '최대 탐색 횟수가 다릅니다 (before 8, after 5)' : null,
      }
    }),
    layoutMatched: conditionsMatched,
    screenComparisons,
    runComparison: { before: outcome(before), after: outcome(after) },
    beforeResultOrigin: 'MOCK',
    afterResultOrigin: 'MOCK',
    resultOrigin: 'MOCK',
    createdAt: new Date().toISOString(),
  }
}
