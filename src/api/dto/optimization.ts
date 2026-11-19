// UX Optimizer 응답 타입(DTO). 임시(OI-12): 이 저장소의 계약 문서는 v1.3.5라 계약 v1.3.8(§17.12, §4.9, §6.1)이 없고,
// 필드는 UX-Mirror-BE `api/optimizer.py`와 README "UX Optimizer API" 절을 기준으로 한다.
// 값 목록이 열려 있거나 정책 모듈(`uxm/optimizer_policy.py`)이 정하는 값은 `string`으로 받고, 모르는 값은 오류로 만들지 않는다.
// `baseUrl` 같은 내부 주소는 서버가 응답에 넣지 않으므로 타입에도 없다.

import type { ErrorDetailDto, ResultOrigin } from './common.ts'

/** `CREATED → EVALUATING → EVALUATED → VERIFYING → COMPLETED`, 실패는 `FAILED`. 모르는 값이 와도 오류로 만들지 않는다 */
export type OptimizationStatus =
  | 'CREATED'
  | 'EVALUATING'
  | 'EVALUATED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
export type VerificationPhase = 'BASELINE' | 'CANDIDATE'
export type CandidateRole = 'BASELINE' | 'CANDIDATE'
export type EvaluationStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type CandidateValidity = 'VALID' | 'INVALID_CANDIDATE'

/** POST /api/optimizations 요청. `sourceRunId`는 있을 때만 보낸다 */
export interface CreateOptimizationRequestDto {
  sourceRunId?: string
}

/** POST /api/optimizations 202 응답 */
export interface CreateOptimizationResponseDto {
  optimizationId: string
  status: OptimizationStatus
  createdAt: string
}

/**
 * POST /api/optimizations/{id}/verify 202 응답. README는 두 Run ID를 함께 적지만 서버는 Run을 만들기 전에 응답하므로
 * 시작 응답에서는 항상 `null`이다(UX-Mirror-BE `start_verification`). Run ID는 이후 `GET`에서 기준 Run → 후보 Run 순으로 채워진다.
 */
export interface StartVerificationResponseDto {
  optimizationId: string
  status: OptimizationStatus
  verificationPhase: VerificationPhase | null
  baselineRunId: string | null
  validationRunId: string | null
}

/** 실패한 Optimization·후보의 오류. 계약 §16.1 형식에 실패 위치(`failedPhase`)와 직전 상태(`lastStatus`)가 붙는다 */
export interface OptimizationErrorDto extends ErrorDetailDto {
  failedPhase?: string | null
  lastStatus?: string | null
}

export interface CandidateLabelDto {
  candidateId: string
  label: string
  role: CandidateRole
  candidateOrder: number
}

/**
 * 후보 하나의 평가. 계산할 수 없는 지표는 0이 아니라 `null`이고 사유는 `metricNullReasons`에 있다.
 * `snapshotHash`·`requestHash`·`rawRequestRef`·`rawResponseRef`는 화면이 쓰지 않아 타입에 두지 않는다.
 */
export interface CandidateEvaluationDto {
  candidateId: string
  candidateOrder: number
  label: string
  role: CandidateRole
  /** 동률일 때 쓰는 의미 명확성 순위(작을수록 우선). 기준(C0)은 `null` */
  semanticClarityRank: number | null
  siteInstanceId: string | null
  /** 평가 전이면 `null` */
  candidateValidity: CandidateValidity | null
  /** 유효하지 않은 이유 코드 목록(임시, 정책 모듈이 정한다). 없으면 빈 배열 */
  invalidReasons: string[]
  evaluationStatus: EvaluationStatus | null
  /** `semanticKey` → 확률. 평가가 끝나지 않았으면 `null` */
  probabilities: Record<string, number> | null
  targetOptionProbability: number | null
  goalPathProbability: number | null
  goalPathBasis: string | null
  metricNullReasons: Record<string, string>
  modelLatencyMs: number | null
  error: OptimizationErrorDto | null
  evaluatedAt: string | null
}

/**
 * 후보 선정 결과(임시, OI-12). 이유 코드와 근거 형식은 정책 모듈이 정하므로 목록이 확정되기 전까지
 * 모든 필드를 optional로 받고, 모르는 값은 원문을 그대로 쓴다.
 */
export interface OptimizationSelectionDto {
  /** 검증할 후보가 있으면 `SELECTED`, 적격 후보가 없으면 `NOT_SELECTABLE`(이때 `verificationCandidateId`는 `null`이라 검증을 시작할 수 없다) */
  selectionStatus?: string | null
  /** 적격 후보를 순위순으로 나열한 `candidateId` */
  rankedCandidates?: string[] | null
  recommendedCandidateId?: string | null
  verificationCandidateId?: string | null
  recommendationStatus?: string | null
  selectionPolicyVersion?: string | null
  selectionReasonCode?: string | null
  excludedCandidates?: { candidateId: string; reasonCodes?: string[] | null }[] | null
}

/** 검증 판단 결과(임시, OI-12). `OptimizationSelectionDto`와 같은 이유로 모두 optional이다 */
export interface OptimizationVerificationDto {
  finalDecision?: string | null
  decision?: string | null
  reasonCode?: string | null
  verificationPolicyVersion?: string | null
  /** 후보 − 기준 이동 비용 차이(임시). 계산할 수 없으면 `null` */
  navigationCostDelta?: number | null
}

export interface OptimizationTargetDto {
  pageKey: string
  semanticKey: string
  originalLabel: string
}

/** GET /api/optimizations/{id} 응답 */
export interface OptimizationDto {
  schemaVersion?: string
  optimizationId: string
  status: OptimizationStatus
  /** 검증 중이 아니면 `null` */
  verificationPhase: VerificationPhase | null
  sourceRunId: string | null
  target: OptimizationTargetDto
  /** 후보 풀. 평가 전에도 후보 목록이 필요한 화면이 쓴다 */
  candidateLabels: CandidateLabelDto[]
  evaluations: CandidateEvaluationDto[]
  progress: { evaluatedCount: number; totalCount: number }
  selection: OptimizationSelectionDto | null
  recommendedCandidateId: string | null
  verificationCandidateId: string | null
  recommendationStatus: string | null
  baselineRunId: string | null
  validationRunId: string | null
  verification: OptimizationVerificationDto | null
  /** 정책 모듈이 정하는 값(임시). 검증이 끝나기 전에는 `null` */
  finalDecision: string | null
  resultOrigin: ResultOrigin
  error: OptimizationErrorDto | null
  createdAt: string
  updatedAt: string | null
}

/** 보고서의 검증 Run 요약 */
export interface OptimizerRunOutcomeDto {
  runId: string
  variant: string
  executionRole: CandidateRole | null
  label: string | null
  status: string
  terminationReason: string | null
  validity: 'VALID' | 'INVALID' | null
  resultOrigin: ResultOrigin
  goalReached: boolean | null
  stepCount: number | null
  navigationCost: number | null
  backCount: number | null
  /** 방문한 화면(`pageKey`) 순서 */
  path: string[]
  executionTimeMs: number | null
}

/** GET /api/optimizations/{id}/report 응답. 완료된 Optimization만 받을 수 있다(`409 OPTIMIZATION_NOT_READY`) */
export interface OptimizationReportDto {
  schemaVersion?: string
  optimizationId: string
  status: OptimizationStatus
  finalDecision: string | null
  resultOrigin: ResultOrigin
  target: OptimizationTargetDto
  selection: OptimizationSelectionDto | null
  recommendationStatus: string | null
  recommendedCandidateId: string | null
  verificationCandidateId: string | null
  evaluations: CandidateEvaluationDto[]
  verification: OptimizationVerificationDto | null
  runs: { baseline: OptimizerRunOutcomeDto; candidate: OptimizerRunOutcomeDto }
  policyVersions: { selection: string | null; verification: string | null }
  modelMetadata: {
    modelVersion: string | null
    modelEndpointId: string | null
    promptVersion: string | null
  }
  frozenConditions: { goal: string; persona: string; startPath: string }
  executionMetadata: {
    modelCallCount: number
    evaluationTimeMs: number | null
    verificationTimeMs: number | null
  }
  limitations: {
    baselineRunCount: number
    candidateRunCount: number
    repeated: boolean
    note: string
  }
  createdAt: string
  updatedAt: string | null
}

/** Run의 Optimizer 검증 연결 정보. 일반 Run에는 필드가 없다. 어느 라벨 사이트인지는 `variant`가 아니라 이 값으로만 구분한다 */
export interface OptimizationContextDto {
  optimizationId: string
  candidateId: string
  label: string
  siteInstanceId: string
  executionRole: CandidateRole
}
