import type {
  CandidateComparisonDto,
  ComparisonResultDto,
  RunOutcomeDto,
  ScreenComparisonDto,
  ScreenMetricComparisonDto,
  StepDto,
} from '../../api/dto/index.ts'
import type { RunRecord } from '../store.ts'
import { buildSteps, buildSummary } from './run.ts'
import { STEP_PAGES } from './scenario.ts'

export type ComparisonMode = 'COMPLETED' | 'PARTIAL' | 'MISMATCH'

const round = (value: number) => Math.round(value * 10000) / 10000
const delta = (before: number | null, after: number | null) =>
  before === null || after === null ? null : round(after - before)

function metrics(
  before: StepDto,
  after: StepDto,
  matched: boolean,
): ScreenMetricComparisonDto {
  const b = before.decision
  const a = after.decision
  const d = (x: number | null, y: number | null) => (matched ? delta(x, y) : null)
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
  matched: boolean,
): CandidateComparisonDto[] {
  const beforeByKey = new Map(
    before.candidateSet.candidates.map((c) => [c.semanticKey, c]),
  )
  const afterByKey = new Map(
    after.candidateSet.candidates.map((c) => [c.semanticKey, c]),
  )
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])]
  return keys.map((semanticKey) => {
    const b = beforeByKey.get(semanticKey)
    const a = afterByKey.get(semanticKey)
    const comparable = matched && b !== undefined && a !== undefined
    return {
      semanticKey,
      beforeLabel: b?.label ?? null,
      afterLabel: a?.label ?? null,
      beforeProbability: b?.probability ?? null,
      afterProbability: a?.probability ?? null,
      deltaProbability: comparable ? delta(b.probability, a.probability) : null,
      comparable,
      reason: comparable ? null : matched ? 'CANDIDATE_NOT_IN_BOTH' : null,
    }
  })
}

function outcome(rec: RunRecord): RunOutcomeDto {
  const s = buildSummary(rec)
  return {
    goalReached: s.goalReached,
    status: 'SUCCESS',
    terminationReason: 'GOAL_REACHED',
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

/** Before/After가 모두 종료된 뒤의 비교 결과. `mode`로 응답 종류를 고른다. */
export function buildComparison(
  before: RunRecord,
  after: RunRecord,
  mode: ComparisonMode,
): ComparisonResultDto {
  const matched = mode !== 'MISMATCH'
  const beforeSteps = buildSteps(before, 99)
  const afterSteps = buildSteps(after, 99)

  const screens: ScreenComparisonDto[] = []
  const afterPages = STEP_PAGES.after
  STEP_PAGES.before.forEach((pageKey, index) => {
    const b = beforeSteps[index]
    const afterIndex = afterPages.indexOf(pageKey)
    const a = afterIndex >= 0 ? afterSteps[afterIndex] : undefined
    if (!a) {
      // 한쪽만 방문한 화면. PARTIAL 응답에서만 보여 준다.
      if (mode === 'PARTIAL') {
        screens.push({
          pageKey,
          beforeStepId: b.stepId,
          afterStepId: null,
          screenComparable: false,
          reason: 'PAGE_NOT_VISITED_IN_AFTER', // 가정한 코드(OI-9)
          candidateSetMatched: false,
          actionSetIncludesBack: null,
          candidateComparisons: [],
          metrics: null,
        })
      }
      return
    }
    screens.push({
      pageKey,
      beforeStepId: b.stepId,
      afterStepId: a.stepId,
      screenComparable: matched,
      reason: matched ? null : 'GLOBAL_CONDITIONS_MISMATCH',
      candidateSetMatched: matched,
      actionSetIncludesBack:
        matched ? b.candidateSet.actionSetIncludesBack : null,
      candidateComparisons: candidateComparisons(b, a, matched),
      metrics: matched ? metrics(b, a, true) : metrics(b, a, false),
    })
  })

  return {
    schemaVersion: '1.3.2',
    experimentKey: before.experimentKey,
    beforeRunId: before.runId,
    afterRunId: after.runId,
    comparisonStatus: mode === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED',
    conditionsMatched: matched,
    // 조건 코드 문자열은 가정한 값이다(OI-9)
    conditionChecks: [
      { code: 'SAME_GOAL', matched: true, message: null },
      { code: 'SAME_PERSONA', matched: true, message: null },
      {
        code: 'SAME_MAX_STEPS',
        matched,
        message: matched ? null : '최대 탐색 횟수가 다릅니다',
      },
    ],
    layoutMatched: matched,
    screenComparisons: screens,
    runComparison: { before: outcome(before), after: outcome(after) },
    beforeResultOrigin: 'MOCK',
    afterResultOrigin: 'MOCK',
    resultOrigin: 'MOCK',
    createdAt: new Date().toISOString(),
  }
}
