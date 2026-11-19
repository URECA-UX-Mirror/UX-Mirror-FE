import type { Open } from '../../domain/types.ts'

// 메뉴 이름 후보 비교 화면 문구(임시, OI-12). 상태·이유 코드 목록이 열려 있으므로 모르는 값은 원문 대신 `UNKNOWN_LABEL`을 보인다.
// 화면에는 서버 코드값을 그대로 보이지 않는다.

/** 모르는 코드의 문구 */
export const UNKNOWN_LABEL = '확인 필요'

/** 원문 코드를 문구 표에서 찾는다. 없으면 `UNKNOWN_LABEL`이다 */
function labelOf(table: Readonly<Record<string, string>>, code: string): string {
  return Object.hasOwn(table, code) ? table[code] : UNKNOWN_LABEL
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
  SELECTED: '확인할 후보를 정함',
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

// 선정·제외·무효·계산 불가 이유 코드(OI-12). 값은 BE `uxm/optimizer_policy.py`(선정·제외),
// `api/site_instances.py`(화면 검사), `api/optimizer.py`(평가 오류)를 따른다. 제외 이유에는 평가 오류 코드도 섞여 온다.
const REASON_LABELS: Readonly<Record<string, string>> = {
  TOP_TARGET_PROBABILITY: '대상 메뉴 확률이 가장 높은 후보',
  NO_VALID_CANDIDATE: '조건에 맞는 후보 없음',
  EVALUATION_NOT_COMPLETED: '평가를 마치지 못함',
  GOAL_PATH_DECREASE_EXCEEDED: '목표 경로 확률 감소가 허용 범위를 넘음',
  TIE_BREAK: '동률이라 의미가 더 분명한 이름을 선정',
  NO_REFERENCE_PATH: '경로 기준이 없어 계산하지 않음',
  SITE_INSTANCE_MISSING: '후보 화면이 준비되지 않음',
  BASELINE_METRIC_UNAVAILABLE: '기준 화면의 값을 계산하지 못함',
  CANDIDATE_METRIC_UNAVAILABLE: '이 후보의 값을 계산하지 못함',
  GOAL_PATH_BASIS_MISMATCH: '기준 화면과 경로 계산 기준이 다름',
  CANDIDATE_METADATA_UNAVAILABLE: '후보 정보를 확인하지 못함',
  DUPLICATE_CANDIDATE_ID: '같은 후보가 두 번 들어 있음',
  DUPLICATE_BASELINE_ID: '기준 화면이 두 번 들어 있음',
  INVALID_PROBABILITY_DISTRIBUTION: '확률 값이 올바르지 않음',
  TARGET_PROBABILITY_UNAVAILABLE: '대상 메뉴 확률을 확인하지 못함',
  TARGET_PROBABILITY_MISMATCH: '대상 메뉴 확률이 맞지 않음',
  SEMANTIC_KEY_MISSING: '화면의 메뉴를 알아보지 못함',
  SEMANTIC_KEY_DUPLICATE: '화면에 같은 메뉴가 두 번 있음',
  TARGET_NOT_FOUND: '바꿀 메뉴를 화면에서 찾지 못함',
  PAGE_MISMATCH: '다른 화면이 열림',
  TARGET_LABEL_MISMATCH: '메뉴 이름이 예상과 다름',
  DESTINATION_MISMATCH: '메뉴를 눌렀을 때 가는 곳이 다름',
  CANDIDATE_COUNT_MISMATCH: '화면의 메뉴 개수가 기준과 다름',
  CANDIDATE_ORDER_MISMATCH: '화면의 메뉴 순서가 기준과 다름',
  REGION_MISMATCH: '메뉴 위치 영역이 기준과 다름',
  OTHER_LABEL_CHANGED: '다른 메뉴 이름까지 바뀜',
  BBOX_MISMATCH: '메뉴 위치가 기준과 다름',
  LEAK_DETECTED: '요청에 내부 정보가 섞여 평가하지 않음',
  BROWSER_ERROR: '후보 화면을 열지 못함',
  MODEL_TIMEOUT: 'AI 응답이 제한 시간을 넘김',
  MODEL_RESPONSE_INVALID: 'AI 응답이 올바르지 않음',
  LEAK_CHECK_FAILED: '요청에 내부 정보가 섞여 평가하지 않음',
}

/** 이유 코드의 풀이. 모르는 코드는 `UNKNOWN_LABEL`이다 */
export const reasonLabel = (code: string): string => labelOf(REASON_LABELS, code)

// 최종 판단·판단 이유 코드(임시, OI-12). 모르는 값은 `UNKNOWN_LABEL`이다.
// 값 목록은 BE `uxm/optimizer_policy.py`의 `judge_verification`에 고정돼 있다.
const FINAL_DECISION_LABELS: Readonly<Record<string, string>> = {
  IMPROVEMENT_OBSERVED: '미리 정한 개선 조건이 관찰됨',
  HOLD: '보류',
  NEEDS_MORE_EVIDENCE: '근거가 더 필요함',
  INCONCLUSIVE: '판단할 수 없음',
}

export const finalDecisionLabel = (decision: string): string => labelOf(FINAL_DECISION_LABELS, decision)

const VERIFICATION_REASON_LABELS: Readonly<Record<string, string>> = {
  NAVIGATION_COST: '두 실행 모두 목표 화면에 도달해 이동 비용으로 비교',
  GOAL_REACHED_GAINED: '후보에서만 목표 화면에 도달',
  GOAL_REACHED_LOST: '후보에서 목표 화면에 도달하지 못함',
  BOTH_GOALS_NOT_REACHED: '두 실행 모두 목표 화면에 도달하지 못함',
  INVALID_OR_MISSING_RUN_DATA: '실행 데이터가 무효이거나 없음',
  RUN_CONDITIONS_MISMATCH_OR_MISSING: '두 실행의 조건이 다르거나 확인할 수 없음',
}

export const verificationReasonLabel = (code: string): string => labelOf(VERIFICATION_REASON_LABELS, code)
