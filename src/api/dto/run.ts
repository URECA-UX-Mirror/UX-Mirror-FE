import type {
  ActionType,
  ErrorDetailDto,
  GoalJudgmentMode,
  IssueType,
  ResultOrigin,
  RunStatus,
  Size,
  Variant,
} from './common.ts'

/** 계약 §6 */
export interface RunDto {
  schemaVersion: string
  runId: string
  experimentKey: string
  variant: Variant
  resultOrigin: ResultOrigin
  modelVersion: string | null
  promptVersion: string
  temperature: number
  goalJudgmentMode: GoalJudgmentMode
  goalId: string
  goal: string
  personaId: string
  persona: string
  startPath: string
  viewport: Size
  limits: { maxSteps: number; modelTimeoutMs: number; runTimeoutMs: number }
  status: RunStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  terminationReason: string | null
  progress: RunProgressDto
  summary: RunSummaryDto | null
  error: ErrorDetailDto | null
  validity: 'VALID' | 'INVALID' | null
  invalidReason: string | null
  replacementRunId: string | null
}

export interface RunProgressDto {
  stepRecordCount: number
  stepCount: number
  maxSteps: number
  currentPageKey: string | null
  lastUpdatedAt: string | null
}

export interface RunSummaryDto {
  goalReached: boolean
  stepCount: number
  stepRecordCount: number
  modelCallCount: number
  clickCount: number
  successfulNavigationClickCount: number
  modelBackCount: number
  systemBackCount: number
  backCount: number
  revisitCount: number
  referencePathDeviationCount: number
  navigationCost: number
  extraSteps: number | null
  extraNavigationCost: number | null
  attemptedExtraSteps: number | null
  executionTimeMs: number
  path: PathVisitDto[]
  detectedIssueTypes: IssueType[]
}

export interface PathVisitDto {
  sequence: number
  pageKey: string
  pageSignature: string
  path: string
  enteredBy: ActionType | null
  visitCause:
    | 'RUN_START'
    | 'MODEL_NAVIGATION'
    | 'MODEL_BACK'
    | 'SYSTEM_BACK_RECOVERY'
  stepId: number | null
}

/** GET /api/runs 응답의 원소 (계약 §17.10). 최신 Run이 먼저 온다. */
export interface RunListItemDto {
  runId: string
  experimentKey: string
  variant: Variant
  status: RunStatus
  terminationReason: string | null
  validity: 'VALID' | 'INVALID' | null
  replacementRunId: string | null
  resultOrigin: ResultOrigin
  /** `summary`가 없으면 `null` */
  goalReached: boolean | null
  createdAt: string
  finishedAt: string | null
}

export interface RunListDto {
  count: number
  items: RunListItemDto[]
}

/** POST /api/runs 요청 (계약 §5.1, §17.2). 선택 필드는 보내지 않는다. */
export interface CreateRunRequestDto {
  experimentKey: string
  variant: Variant
  goalId: string
  personaId: string
  maxSteps?: number
}

/** POST /api/runs 201 응답 (계약 §17.2) */
export interface CreateRunResponseDto {
  runId: string
  experimentKey: string
  variant: Variant
  status: RunStatus
  maxSteps: number
  createdAt: string
}
