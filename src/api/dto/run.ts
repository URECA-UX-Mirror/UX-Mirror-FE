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
  /** 직접 입력한 목표면 `null` */
  goalId: string | null
  goal: string
  /** 직접 입력한 사용자 유형이면 `null` */
  personaId: string | null
  persona: string
  /** 저장된 성공 조건. 과거 Run에는 없을 수 있다 */
  verification?: VerificationDto | null
  /** 허용 경로 설정. 직접 입력한 목표는 `null`(경로 기반 지표 계산 안 함) */
  referencePathConfig?: ReferencePathConfigDto | null
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
  /** 허용 경로가 없으면 `null` */
  referencePathDeviationCount: number | null
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

/** 성공 조건 (계약 §2.3). Run에는 `exact`·`scope` 기본값을 채워 저장한다 */
export interface VerificationDto {
  type: string
  path: string
  text: string
  exact: boolean
  scope: string
}

export interface ReferencePathConfigDto {
  version: string
  allowedPaths: string[][]
  shortestAllowedSteps: number
}

/** 직접 입력한 목표의 성공 조건. `exact`·`scope`는 생략하면 서버 기본값 */
export interface VerificationInputDto {
  path: string
  text: string
  exact?: boolean
  scope?: 'page' | 'main'
}

/**
 * POST /api/runs 요청 (계약 §5.1, §17.2). 선택 필드는 보내지 않는다.
 * 목표는 `goalId` 또는 `goal`+`verification`, 사용자 유형은 `personaId` 또는 `persona` 중 하나만 보낸다(UX-Mirror-BE #42).
 */
export interface CreateRunRequestDto {
  experimentKey: string
  variant: Variant
  goalId?: string
  goal?: string
  verification?: VerificationInputDto
  personaId?: string
  persona?: string
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
