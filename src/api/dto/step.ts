import type {
  ActionResultCode,
  ActionType,
  BoundingBox,
  ErrorDetailDto,
  GoalJudgmentMode,
  ResultOrigin,
  RunStatus,
  Size,
} from './common.ts'

/** 계약 §12 */
export interface StepDto {
  schemaVersion: string
  runId: string
  stepId: number
  timestamp: string
  page: PageObservationDto
  candidateSet: CandidateSetDto
  decision: StepDecisionDto
  action: ActionRecordDto
  statusAfterStep: RunStatus
  error: ErrorDetailDto | null
}

/** GET /api/runs/{runId}/steps 응답 (계약 §17.4) */
export interface StepListDto {
  runId: string
  count: number
  items: StepDto[]
}

/** 계약 §7.1 */
export interface PageObservationDto {
  pageKey: string
  pageSignature: string
  path: string
  title: string
  viewport: Size
  screenshotSize: Size
  scroll: { x: number; y: number }
  screenshotRef: string
  overlayScreenshotRef: string | null
  capturedAt: string
}

/** 계약 §8.2 */
export interface CandidateSetDto {
  candidateSetId: string
  candidateSetChanged: boolean
  candidateScope: string[]
  actionSetIncludesBack: boolean
  backOptionId: string | null
  candidates: StepCandidateDto[]
}

/** 계약 §8.1 */
export interface StepCandidateDto {
  optionId: string
  label: string
  region: string
  context: string | null
  /** 정규화된 쇼핑몰 내부 경로 (예: `/shop/orders`). v1.3.4부터 프론트에 전달된다 */
  href: string
  bbox: BoundingBox
  semanticKey: string
  actionType: 'CLICK'
  probability: number
  selected: boolean
}

/** 계약 §12.3 */
export interface StepDecisionDto {
  selectedOptionId: string
  selectedActionType: ActionType
  resultOrigin: ResultOrigin
  goalJudgmentMode: GoalJudgmentMode
  modelGoalReached: boolean | null
  modelGoalYesProb: number | null
  verifiedGoalReached: boolean
  goalJudgmentMismatch: boolean
  normalizedEntropy: number | null
  clickOnlyNormalizedEntropy: number | null
  goBackProbability: number | null
  top2Margin: number | null
  clickOnlyTop2Margin: number | null
  goalPathProbability: number | null
  modelLatencyMs: number | null
  metricWarnings: { code: string; message: string }[]
}

/** 계약 §11.2 */
export interface ActionRecordDto {
  selectedOptionId: string
  executedOptionId: string | null
  actionType: ActionType
  eventOrigin: 'MODEL_DECISION' | 'SYSTEM_RECOVERY'
  result: ActionResultCode
  reason: string | null
  executed: boolean
  fromPath: string
  toPath: string | null
  startedAt: string
  finishedAt: string
  error: ErrorDetailDto | null
}
