// 자동 개선 결과(`improvement.json`, `schemaVersion: improvement-v1`)의 도메인 타입. 계약서에 없는 형식이며 팀이 확정한
// 샘플(`public/improvements/imp_SAMPLE_0001.json`)이 정본이다([OI-13](../../docs/operations/open_issue.md#oi-13)).

export const IMPROVEMENT_SCHEMA_VERSION = 'improvement-v1'

/** 알려진 값 목록. 모르는 값은 오류로 만들지 않고 원문 문자열로 둔다(`(string & {})`가 그 자리) */
export const IMPROVEMENT_RESULTS = ['IMPROVED', 'NO_IMPROVEMENT'] as const
export const VERIFICATION_STATUSES = ['COMPLETED', 'NOT_RUN', 'FAILED'] as const
export const EVALUATION_STATUSES = ['COMPLETED', 'SKIPPED', 'FAILED'] as const
export const CANDIDATE_DECISIONS = ['ADOPTED', 'REJECTED'] as const
export const CANDIDATE_SOURCES = ['HUMAN', 'AI'] as const

type OpenEnum<T extends string> = T | (string & {})

export type ImprovementResult = OpenEnum<(typeof IMPROVEMENT_RESULTS)[number]>
export type VerificationStatus = OpenEnum<(typeof VERIFICATION_STATUSES)[number]>
export type EvaluationStatus = OpenEnum<(typeof EVALUATION_STATUSES)[number]>
export type CandidateDecision = OpenEnum<(typeof CANDIDATE_DECISIONS)[number]>
export type CandidateSource = OpenEnum<(typeof CANDIDATE_SOURCES)[number]>

export function isKnownValue<T extends string>(
  known: readonly T[],
  value: string | null,
): value is T {
  return value !== null && (known as readonly string[]).includes(value)
}

/** 점수는 0~1이다. `null`은 "값 없음"이며 0점이나 실패가 아니다 */
export type Score = number | null

/** 목표 키(`S1` 등)별 점수 */
export type GuardScores = Record<string, number>

export interface ImprovementScoreLine {
  goalKey: string | null
  name: string | null
  before: number
  /** `NO_IMPROVEMENT`이면 `null` */
  after: Score
  delta: Score
}

/** 영역 1: 개선 요약(report) */
export interface ImprovementReport {
  schemaVersion: string
  improvementId: string
  status: string
  /** 샘플 데이터이면 `true`. 없으면 `false` */
  sample: boolean
  createdAt: string | null
  finishedAt: string | null
  result: ImprovementResult
  target: { pageKey: string | null; semanticKey: string | null; region: string | null } | null
  beforeLabel: string
  /** `IMPROVED`이면 있고 `NO_IMPROVEMENT`이면 `null` */
  afterLabel: string | null
  afterSource: CandidateSource | null
  roundsRun: number | null
  main: ImprovementScoreLine
  guards: ImprovementScoreLine[]
  scoreSource: string | null
  headline: string | null
}

/** 영역 2: 공식 평가(official). 공식 평가 전이면 영역 값이 `null`이다 */
export interface ImprovementScores {
  mainScore: number
  guardScores: GuardScores
}

export interface ImprovementOfficial {
  method: string | null
  label: string
  siteLabel: string | null
  buildCheck: string | null
  scores: ImprovementScores
  scoresA: ImprovementScores | null
  maxDiffAvsB: Score
  chosen: string | null
  rejected: string[]
}

export interface ImprovementCandidate {
  candidateId: string
  label: string
  source: CandidateSource | null
  order: number | null
  method: string | null
  evaluationStatus: EvaluationStatus | null
  layoutValid: boolean | null
  layoutReasons: string[]
  /** 평가 실패·건너뜀이면 `null`. 0으로 바꾸지 않는다 */
  mainScore: Score
  guardScores: GuardScores | null
  decision: CandidateDecision
  reason: string | null
}

export interface ImprovementButton {
  semanticKey: string | null
  label: string | null
  region: string | null
  probability: Score
}

export interface ImprovementDiagnosis {
  bottleneckPage: string | null
  blockScore: Score
  targetButton: ImprovementButton | null
  rivalButton: ImprovementButton | null
  text: string | null
}

export interface ImprovementProposalLabel {
  label: string
  accepted: boolean
  rejectedReason: string | null
}

export interface ImprovementRound {
  round: number
  diagnosis: ImprovementDiagnosis | null
  baseline: { label: string | null; mainScore: Score; guardScores: GuardScores | null } | null
  proposal: ImprovementProposalLabel[]
  candidates: ImprovementCandidate[]
  /** 그 회차에 채택한 후보 ID. 채택이 없으면 `null` */
  adopted: string | null
}

export interface VerificationRun {
  label: string | null
  variant: string | null
  runId: string | null
  resultPath: string | null
  progressPath: string | null
  status: string | null
  validity: string | null
  goalReached: boolean | null
  path: string[]
  stepCount: number | null
  issues: string[]
  resultOrigin: string | null
  modelEndpointId: string | null
}

export interface VerificationPair {
  goalKey: string | null
  name: string | null
  experimentKey: string | null
  comparisonPath: string | null
  /** 그 Run을 만들지 못했으면 `null` */
  before: VerificationRun | null
  after: VerificationRun | null
}

/** 영역 3: 실제 검증(verification) */
export interface ImprovementVerification {
  status: VerificationStatus
  /** 실패가 아니면 `null` */
  error: { code: string | null; message: string | null } | null
  method: string | null
  pairs: VerificationPair[]
}

export interface ImprovementStop {
  reason: string | null
  detail: string | null
}

/** 영역별 결과. 한 영역이 오류여도 다른 영역은 정상 변환한다 */
export type Area<T> = { ok: true; data: T } | { ok: false; reason: string }

export interface ImprovementView {
  report: Area<ImprovementReport>
  official: Area<ImprovementOfficial | null>
  rounds: Area<ImprovementRound[]>
  verification: Area<ImprovementVerification>
  /** 필수 영역이 아니므로 없거나 형식이 다르면 `null` */
  stop: ImprovementStop | null
  plan: ImprovementPlan | null
  limitations: string | null
}

export interface ImprovementPlan {
  planId: string | null
  persona: string | null
  mainGoal: ImprovementGoal | null
  guardGoals: ImprovementGoal[]
  site: { siteId: string | null; variant: string | null; name: string | null } | null
  rules: Record<string, unknown> | null
  model: Record<string, unknown> | null
}

export interface ImprovementGoal {
  goalKey: string
  name: string | null
  goal: string | null
  goalPage: string | null
  shortestSteps: number | null
}
