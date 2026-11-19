import type { Open } from '../../domain/types.ts'

// UX Optimizer 화면 문구(임시, OI-12). 상태·이유 코드 목록이 확정되지 않았으므로 모르는 값은 원문을 그대로 보인다.

/** 원문 코드를 문구 표에서 찾는다. 없으면 원문을 그대로 돌려준다 */
function labelOf(table: Readonly<Record<string, string>>, code: string): string {
  return Object.hasOwn(table, code) ? table[code] : code
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  CREATED: '평가 대기 중',
  EVALUATING: '후보 평가 중',
  EVALUATED: '후보 평가 완료',
  VERIFYING: '후보 검증 중',
  COMPLETED: '검증 완료',
  FAILED: '실패',
}

export const optimizationStatusLabel = (status: Open<string>) =>
  labelOf(STATUS_LABELS, status)

export { optimizerRoleLabel as roleLabel } from '../../shared/optimizerRun.ts'

const EVALUATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  COMPLETED: '평가 완료',
  FAILED: '평가 실패',
  SKIPPED: '평가 제외',
}

export const evaluationStatusLabel = (status: Open<string>) =>
  labelOf(EVALUATION_STATUS_LABELS, status)

const PHASE_LABELS: Readonly<Record<string, string>> = {
  EVALUATING: '후보 평가',
  VERIFYING: '후보 검증',
}

export const phaseLabel = (phase: string) => labelOf(PHASE_LABELS, phase)

// 검증 중(`verificationPhase`)에 지금 어느 Run을 실행하는지. `error.failedPhase`와 값이 다르다
const VERIFICATION_PHASE_LABELS: Readonly<Record<string, string>> = {
  BASELINE: '기준 실행',
  CANDIDATE: '후보 실행',
}

export const verificationPhaseLabel = (phase: string) =>
  labelOf(VERIFICATION_PHASE_LABELS, phase)

const METRIC_LABELS: Readonly<Record<string, string>> = {
  targetOptionProbability: '대상 메뉴 확률',
  goalPathProbability: '목표 경로 확률',
}

export const metricLabel = (metric: string) => labelOf(METRIC_LABELS, metric)

const SELECTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  SELECTED: '검증 후보 선정',
  NOT_SELECTABLE: '선정할 수 있는 후보 없음',
}

export const selectionStatusLabel = (status: string) =>
  labelOf(SELECTION_STATUS_LABELS, status)

const RECOMMENDATION_LABELS: Readonly<Record<string, string>> = {
  RECOMMENDED: '추천 후보 있음',
  NO_RECOMMENDATION: '추천 후보 없음',
}

export const recommendationLabel = (status: string) =>
  labelOf(RECOMMENDATION_LABELS, status)

// 실서버·정책 모듈에서 확인한 이유 코드만 풀이를 붙인다(OI-12). 나머지는 코드 원문만 보인다.
const REASON_LABELS: Readonly<Record<string, string>> = {
  TOP_TARGET_PROBABILITY: '대상 메뉴 확률이 가장 높은 후보',
  NO_VALID_CANDIDATE: '적격 후보 없음',
  EVALUATION_NOT_COMPLETED: '평가를 마치지 못함',
  GOAL_PATH_DECREASE_EXCEEDED: '목표 경로 확률 감소가 허용 범위를 넘음',
  TIE_BREAK: '동률이라 의미 명확성 순위로 선정',
  NO_REFERENCE_PATH: '경로 기준이 없어 계산하지 않음',
  SITE_INSTANCE_MISSING: '후보 사이트가 등록되지 않음',
}

/** 이유 코드의 풀이. 모르는 코드는 `null`이라 호출하는 쪽이 원문만 보인다 */
export const reasonLabel = (code: string): string | null =>
  Object.hasOwn(REASON_LABELS, code) ? REASON_LABELS[code] : null

// 최종 판단·판단 이유 코드(임시, OI-12). 실서버에서 확인한 값만 풀이를 붙이고 나머지는 원문을 그대로 보인다.
const FINAL_DECISION_LABELS: Readonly<Record<string, string>> = {
  IMPROVEMENT_OBSERVED: '사전 정의한 개선 조건이 관찰됨',
}

export const finalDecisionLabel = (decision: string): string | null =>
  Object.hasOwn(FINAL_DECISION_LABELS, decision) ? FINAL_DECISION_LABELS[decision] : null

const VERIFICATION_REASON_LABELS: Readonly<Record<string, string>> = {
  NAVIGATION_COST: '이동 비용 기준',
}

export const verificationReasonLabel = (code: string): string | null =>
  Object.hasOwn(VERIFICATION_REASON_LABELS, code) ? VERIFICATION_REASON_LABELS[code] : null
