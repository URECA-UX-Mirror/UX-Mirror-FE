import type {
  ComparisonStatus,
  IssueType,
  ResultOrigin,
  RunStatus,
} from './common.ts'
import type { PathVisitDto } from './run.ts'

/** 계약 §15. GET /api/comparisons/{experimentKey} 응답 (§17.6) */
export interface ComparisonResultDto {
  schemaVersion: string
  experimentKey: string
  beforeRunId: string
  afterRunId: string
  comparisonStatus: ComparisonStatus
  conditionsMatched: boolean
  conditionChecks: {
    code: string
    matched: boolean
    message: string | null
  }[]
  layoutMatched: boolean
  screenComparisons: ScreenComparisonDto[]
  runComparison: { before: RunOutcomeDto; after: RunOutcomeDto }
  beforeResultOrigin: ResultOrigin
  afterResultOrigin: ResultOrigin
  resultOrigin: ResultOrigin | null
  createdAt: string
}

export interface ScreenComparisonDto {
  pageKey: string
  beforeStepId: number | null
  afterStepId: number | null
  screenComparable: boolean
  reason: string | null
  candidateSetMatched: boolean
  actionSetIncludesBack: boolean | null
  candidateComparisons: CandidateComparisonDto[]
  metrics: ScreenMetricComparisonDto | null
}

export interface CandidateComparisonDto {
  semanticKey: string
  beforeLabel: string | null
  afterLabel: string | null
  beforeProbability: number | null
  afterProbability: number | null
  deltaProbability: number | null
  comparable: boolean
  reason: string | null
}

/** 계약 §15.7. 지표마다 before/after/delta 세 필드 */
export interface ScreenMetricComparisonDto {
  beforeNormalizedEntropy: number | null
  afterNormalizedEntropy: number | null
  deltaNormalizedEntropy: number | null
  beforeClickOnlyNormalizedEntropy: number | null
  afterClickOnlyNormalizedEntropy: number | null
  deltaClickOnlyNormalizedEntropy: number | null
  beforeTop2Margin: number | null
  afterTop2Margin: number | null
  deltaTop2Margin: number | null
  beforeClickOnlyTop2Margin: number | null
  afterClickOnlyTop2Margin: number | null
  deltaClickOnlyTop2Margin: number | null
  beforeGoBackProbability: number | null
  afterGoBackProbability: number | null
  deltaGoBackProbability: number | null
  beforeGoalPathProbability: number | null
  afterGoalPathProbability: number | null
  deltaGoalPathProbability: number | null
}

/** 계약 §15.8. Run.summary에서 복사된 값 */
export interface RunOutcomeDto {
  goalReached: boolean
  status: RunStatus
  terminationReason: string | null
  stepCount: number
  successfulNavigationClickCount: number
  modelBackCount: number
  systemBackCount: number
  backCount: number
  navigationCost: number
  extraSteps: number | null
  extraNavigationCost: number | null
  referencePathDeviationCount: number | null
  path: PathVisitDto[]
  detectedIssueTypes: IssueType[]
}
