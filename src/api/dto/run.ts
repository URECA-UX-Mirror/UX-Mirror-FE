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
  /** 경로 지표 기준 설정. 필드가 없으면 과거 Run(`ALLOWED_PATHS`), 명시적 `null`이면 기준 없음(경로 기반 지표 계산 안 함) */
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
  /** 임시(OI-11). 시나리오 Run의 사이트. 버전 비교 Run은 `null`이거나 필드가 없다 */
  siteId?: string | null
  /** 임시(OI-11). `SCENARIO`면 시나리오 Run. `null`이거나 필드가 없으면 버전 비교 Run */
  mode?: string | null
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
  /** 사이트 지도 기준의 우회 이동 수. 백엔드가 아직 주지 않으면 없다 */
  detourMoveCount?: number | null
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
  /** 임시(OI-11). `RunDto`와 같다 */
  siteId?: string | null
  mode?: string | null
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

/** 경로 지표 기준. `basis`가 없는 값은 `ALLOWED_PATHS`로 해석한다 (설계 v2.1 4.1) */
export type ReferenceBasis = 'ALLOWED_PATHS' | 'SITE_MAP'

export interface AllowedPathsConfigDto {
  /** 없으면 `ALLOWED_PATHS` */
  basis?: 'ALLOWED_PATHS'
  version: string
  allowedPaths: string[][]
  shortestAllowedSteps: number
}

/**
 * 사이트 지도 기준 (설계 v2.1 4.1, OI-10). 값은 서버가 계산하며 FE는 읽기만 한다.
 * `distances`는 화면(`pageKey`)별 목표까지의 클릭 수이고, 도달할 수 없는 화면은 `null`이다.
 */
export interface SiteMapConfigDto {
  basis: 'SITE_MAP'
  siteMapVersion: string
  siteMapHash: string
  startPageKey: string
  goalPageKey: string
  shortestSteps: number
  distances: Record<string, number | null>
}

export type ReferencePathConfigDto = AllowedPathsConfigDto | SiteMapConfigDto

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
  /** 임시(OI-11). 시나리오 Run을 만들 때만 보낸다 */
  siteId?: string
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
