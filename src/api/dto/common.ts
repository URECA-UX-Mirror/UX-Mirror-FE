// 서버 응답 타입(DTO). 필드명과 의미는 인터페이스·데이터 계약서 v1.3.5를 그대로 따른다.
// 설명은 docs/contracts/data-model.md 참고. 계약서에 없는 필드는 만들지 않는다.

export type RunStatus =
  | 'READY'
  | 'RUNNING'
  | 'SUCCESS'
  | 'BLOCKED'
  | 'MAX_STEPS'
  | 'TIMEOUT'
  | 'ERROR' // 계약 §4.1
export type Variant = 'before' | 'after' // §4.2
export type ResultOrigin = 'LIVE' | 'MOCK' | 'SAVED_MEASURED' // §2.1
export type GoalJudgmentMode = 'DOM_ONLY' | 'MODEL_AND_DOM' // §4.4
export type ActionType = 'CLICK' | 'GO_BACK' // §4.6
export type ActionResultCode =
  | 'NAVIGATED'
  | 'NO_CHANGE'
  | 'CLICK_FAILED'
  | 'BACK_FAILED' // §4.8
export type IssueType =
  | 'CHOICE_AMBIGUITY'
  | 'REFERENCE_PATH_DEVIATION'
  | 'REPEATED_VISIT'
  | 'EXTRA_STEPS'
  | 'GOAL_NOT_REACHED' // §4.10
export type AnalysisStatus = 'PENDING' | 'COMPLETED' | 'FAILED' // §4.11
export type ComparisonStatus = 'COMPLETED' | 'PARTIAL' // §4.12
export type ReviewPriority = 'PRIORITY_REVIEW' | 'GENERAL_REVIEW' // §4.13

export interface Size {
  width: number
  height: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/** 계약 §16.1 */
export interface ErrorDetailDto {
  code: string
  message: string
  retryable: boolean
  details: Record<string, unknown> | null
  occurredAt: string
}

export interface ErrorResponseDto {
  error: ErrorDetailDto
}
