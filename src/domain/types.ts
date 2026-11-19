// 화면이 쓰는 도메인 모델. 서버 DTO와 분리되어 있고 변환은 src/adapters/에서만 한다.
// 프론트가 쓰지 않는 필드(schemaVersion, 저장 전용 설정 등)는 가지고 오지 않는다.
// 서버가 모르는 enum 값을 보내도 오류로 만들지 않도록 문자열을 함께 허용한다(`Open`).

import type {
  ActionResultCode,
  ActionType,
  AnalysisStatus,
  BoundingBox,
  ComparisonStatus,
  GoalJudgmentMode,
  IssueType,
  ResultOrigin,
  ReviewPriority,
  RunStatus,
  Size,
  Variant,
} from '../api/dto/common.ts'
import type { ReferenceBasis } from '../api/dto/run.ts'

export type Open<T extends string> = T | (string & {})

export type {
  ActionResultCode,
  ActionType,
  AnalysisStatus,
  BoundingBox,
  ComparisonStatus,
  GoalJudgmentMode,
  IssueType,
  ResultOrigin,
  ReviewPriority,
  RunStatus,
  Size,
  Variant,
}

/** 사용자에게 보여 줄 수 있는 오류. 서버의 `details`는 가져오지 않는다. */
export interface ErrorInfo {
  code: string
  message: string
  retryable: boolean
  occurredAt: string | null
}

// ---- 프리셋·상태 ----

export interface Preset {
  goals: { goalId: string; goal: string }[]
  personas: { personaId: string; persona: string }[]
}

export interface Health {
  /** `READY`(모델·브라우저·에이전트 모두 준비) 또는 `NOT_READY`. 모르는 값은 준비되지 않은 것으로 본다 */
  status: string
  backendReady: boolean
  modelReady: boolean
  browserReady: boolean
  agentReady: boolean
  /** 실행 중인 Run이 있으면 그 `runId`, 없으면 `null` */
  activeRunId: string | null
  checkedAt: string
}

// ---- Run ----

export interface RunProgress {
  stepRecordCount: number
  /** 탐색 비용 기준 단계 수. `stepRecordCount`와 다를 수 있다 */
  stepCount: number
  maxSteps: number
  currentPageKey: string | null
  lastUpdatedAt: string | null
}

export interface PathVisit {
  sequence: number
  pageKey: string
  path: string
  enteredBy: ActionType | null
  visitCause: Open<
    'RUN_START' | 'MODEL_NAVIGATION' | 'MODEL_BACK' | 'SYSTEM_BACK_RECOVERY'
  >
  /** 시작 화면·시스템 BACK은 `null` */
  stepId: number | null
}

export interface RunSummary {
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
  /** 목표에 도달하지 못하면 `null`. 0으로 바꾸지 않는다 */
  extraSteps: number | null
  extraNavigationCost: number | null
  attemptedExtraSteps: number | null
  /** 사이트 지도 기준의 우회 이동 수. 값이 없으면 `null`이며 0으로 바꾸지 않는다 */
  detourMoveCount: number | null
  executionTimeMs: number
  path: PathVisit[]
  detectedIssueTypes: Open<IssueType>[]
}

export interface Run {
  runId: string
  experimentKey: string
  variant: Open<Variant>
  resultOrigin: Open<ResultOrigin>
  /** 직접 입력한 목표면 `null` */
  goalId: string | null
  goal: string
  /** 직접 입력한 사용자 유형이면 `null` */
  personaId: string | null
  persona: string
  /** 저장된 성공 조건. 과거 Run에는 없을 수 있다(`null`) */
  verification: Verification | null
  /**
   * 경로 지표 기준. `null`이면 기준이 없어 경로 이탈·추가 단계·목표 경로 확률을 계산하지 않는다.
   * 필드가 없는 과거 Run은 `ALLOWED_PATHS`다.
   */
  referenceBasis: Open<ReferenceBasis> | null
  viewport: Size
  maxSteps: number
  status: Open<RunStatus>
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  terminationReason: string | null
  progress: RunProgress
  /** 종료 후에만 있다 */
  summary: RunSummary | null
  error: ErrorInfo | null
  /** 종료 전에는 `null` */
  validity: 'VALID' | 'INVALID' | null
  invalidReason: string | null
  replacementRunId: string | null
  /** 시나리오 Run의 사이트. 버전 비교 Run은 `null`. 사이트 이름은 `listSites()`의 `name`으로 찾는다 */
  siteId: string | null
  /** 임시(OI-11). `SCENARIO`일 때만 시나리오 Run이다(`isScenarioRun`) */
  mode: Open<'SCENARIO'> | null
}

/** Run 목록의 한 줄 (`GET /api/runs`). 전체 Run은 `getRun`으로 조회한다 */
export interface RunListItem {
  runId: string
  experimentKey: string
  variant: Open<Variant>
  status: Open<RunStatus>
  terminationReason: string | null
  validity: 'VALID' | 'INVALID' | null
  replacementRunId: string | null
  resultOrigin: Open<ResultOrigin>
  /** `summary`가 없으면 `null` */
  goalReached: boolean | null
  createdAt: string
  finishedAt: string | null
  siteId: string | null
  mode: Open<'SCENARIO'> | null
}

export interface CreatedRun {
  runId: string
  experimentKey: string
  variant: Open<Variant>
  status: Open<RunStatus>
  maxSteps: number
  createdAt: string
}

export interface Verification {
  type: string
  path: string
  text: string
  exact: boolean
  scope: string
}

export interface VerificationInput {
  path: string
  text: string
  exact?: boolean
  scope?: 'page' | 'main'
}

/** 목표: preset ID 또는 직접 입력 문장 + 성공 조건 */
export type GoalInput = { goalId: string } | { goal: string; verification: VerificationInput }
/** 사용자 유형: preset ID 또는 직접 입력 문장 */
export type PersonaInput = { personaId: string } | { persona: string }

export interface CreateRunInput {
  experimentKey: string
  variant: Variant
  goal: GoalInput
  persona: PersonaInput
  maxSteps?: number
  /** 시나리오 Run을 만들 때만 넣는다. 없으면 요청 본문은 버전 비교와 같다 */
  siteId?: string
}

// ---- Step ----

export interface Candidate {
  optionId: string
  label: string
  region: string
  context: string | null
  /** 목적지 경로. 화면에서 후보를 설명할 때만 쓴다 */
  href: string
  bbox: BoundingBox
  /** 버전 간 같은 의미의 후보를 잇는 키. `optionId`로 매칭하지 않는다 */
  semanticKey: string
  /** 0~1 */
  probability: number
  selected: boolean
}

export interface StepDecision {
  selectedOptionId: string
  selectedActionType: Open<ActionType>
  resultOrigin: Open<ResultOrigin>
  goalJudgmentMode: Open<GoalJudgmentMode>
  modelGoalReached: boolean | null
  modelGoalYesProb: number | null
  verifiedGoalReached: boolean
  goalJudgmentMismatch: boolean
  normalizedEntropy: number | null
  clickOnlyNormalizedEntropy: number | null
  /** `null`이면 GO_BACK이 선택지에 없었다 */
  goBackProbability: number | null
  top2Margin: number | null
  clickOnlyTop2Margin: number | null
  goalPathProbability: number | null
  modelLatencyMs: number | null
  metricWarnings: { code: string; message: string }[]
}

export interface StepAction {
  selectedOptionId: string
  /** 실행하지 못했으면 `null`. 모델의 선택과 실제 실행은 별개다 */
  executedOptionId: string | null
  actionType: Open<ActionType>
  result: Open<ActionResultCode>
  reason: string | null
  executed: boolean
  fromPath: string
  toPath: string | null
}

export interface Step {
  stepId: number
  timestamp: string
  page: {
    pageKey: string
    path: string
    title: string
    viewport: Size
    screenshotSize: Size
    scroll: { x: number; y: number }
  }
  /** GO_BACK 제외, 전달 순서 */
  candidates: Candidate[]
  /** GO_BACK 선택지 ID. 후보가 아니라서 박스가 없다 */
  backOptionId: string | null
  decision: StepDecision
  action: StepAction
  statusAfterStep: Open<RunStatus>
  error: ErrorInfo | null
}

// ---- Issue ----

export interface Issue {
  issueId: string
  issueType: Open<IssueType>
  stepId: number | null
  relatedStepIds: number[]
  pagePath: string | null
  pageKey: string | null
  title: string
  description: string
  /** `issueType`별 키가 다르고 값이 목록일 수 있다. 표시 이름과 타입 확인은 화면에서 한다 */
  evidence: Record<string, unknown>
  reviewPriority: Open<ReviewPriority>
  occurrenceCount: number
}

export interface IssueList {
  runId: string
  analysisStatus: Open<AnalysisStatus>
  items: Issue[]
}

// ---- 비교 ----

export interface ConditionCheck {
  code: string
  matched: boolean
  message: string | null
}

export interface CandidateComparison {
  semanticKey: string
  beforeLabel: string | null
  afterLabel: string | null
  beforeProbability: number | null
  afterProbability: number | null
  /** 비교 불가면 `null`. 0으로 바꾸지 않는다 */
  deltaProbability: number | null
  comparable: boolean
  reason: string | null
}

export interface MetricComparison {
  before: number | null
  after: number | null
  delta: number | null
}

export interface ScreenMetrics {
  normalizedEntropy: MetricComparison
  clickOnlyNormalizedEntropy: MetricComparison
  top2Margin: MetricComparison
  clickOnlyTop2Margin: MetricComparison
  goBackProbability: MetricComparison
  goalPathProbability: MetricComparison
}

export interface ScreenComparison {
  pageKey: string
  beforeStepId: number | null
  afterStepId: number | null
  screenComparable: boolean
  reason: string | null
  candidateSetMatched: boolean
  actionSetIncludesBack: boolean | null
  candidateComparisons: CandidateComparison[]
  /** 한쪽 미방문이면 `null` */
  metrics: ScreenMetrics | null
}

export interface RunOutcome {
  goalReached: boolean
  status: Open<RunStatus>
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
  detourMoveCount: number | null
  path: PathVisit[]
  detectedIssueTypes: Open<IssueType>[]
}

export interface Comparison {
  experimentKey: string
  beforeRunId: string
  afterRunId: string
  comparisonStatus: Open<ComparisonStatus>
  conditionsMatched: boolean
  conditionChecks: ConditionCheck[]
  layoutMatched: boolean
  screenComparisons: ScreenComparison[]
  runComparison: { before: RunOutcome; after: RunOutcome }
  beforeResultOrigin: Open<ResultOrigin>
  afterResultOrigin: Open<ResultOrigin>
  /** 두 출처가 다르면 `null` */
  resultOrigin: Open<ResultOrigin> | null
  createdAt: string
}

// ---- 시나리오 테스트 사이트 (임시, OI-11) ----

export interface SitePage {
  pageKey: string
  path: string
  label: string
  goalText: string | null
  /** 도착 화면으로 고를 수 있는지. 서버가 알려 주지 않으면 Adapter가 채운다 */
  goalSelectable: boolean
}

export interface Site {
  siteId: string
  name: string
  mode: Open<'SCENARIO'>
  startPage: string
  pages: SitePage[]
  /** `false`면 사이트 지도가 없다 */
  siteMapAvailable: boolean
}
