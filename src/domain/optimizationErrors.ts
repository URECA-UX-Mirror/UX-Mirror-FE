import { hasHangul } from '../shared/hangul.ts'

// UX Optimizer의 오류 코드를 화면 문구로 바꾼다. 문구는 이 파일 한 곳에서만 정한다(임시, OI-12).
// 같은 코드가 상황마다 뜻이 달라서(예: `MODEL_TIMEOUT`은 후보 하나의 평가 오류이면서 평가 전체의 실패 원인이고,
// `BROWSER_ERROR`는 후보 화면 오류이면서 검증 시작의 503이다) 어디서 온 코드인지에 따라 함수를 나눈다.
//   1. API 오류 응답(`ApiError.code`)            → `optimizationApiErrorMessage`   서버 메시지가 우선
//   2. `FAILED`인 Optimization의 `error.code`     → `optimizationFailureMessage`    실패 원인 코드
//   3. 후보 평가의 `evaluations[].error.code`     → `candidateErrorMessage`         그 후보 하나의 오류
// 모르는 코드는 서버 `message`(비어 있지 않으면, 2·3은 한글이 있을 때만), 그것도 없으면 일반 안내를 쓴다. 서버 `details`는 쓰지 않는다.

const GENERIC_MESSAGE = '요청을 처리하지 못했습니다.'

const serverOr = (serverMessage: string | null | undefined, fallback: string) =>
  serverMessage?.trim() ? serverMessage.trim() : fallback

/** 서버 문구가 한국어(한글 포함)일 때만 쓴다. 영어 예외 문구(`baseline invalid` 등)는 화면에 보이지 않는다 */
const koreanOr = (serverMessage: string | null | undefined, fallback: string) =>
  hasHangul(serverMessage) ? serverMessage!.trim() : fallback

const lookup = (
  table: Readonly<Record<string, string>>,
  code: string | null,
): string | null =>
  code !== null && Object.hasOwn(table, code) ? table[code] : null

// 1. API 오류. 같은 코드도 요청에 따라 서버 메시지가 더 정확하므로(예: `OPTIMIZATION_NOT_READY`는 평가 전·후보 미선정·보고서 요청에 모두 쓰인다)
//    서버 메시지가 있으면 그것을 쓰고, 이 표는 메시지가 비어 있을 때의 대체 문구다.
const API_FALLBACKS: Readonly<Record<string, string>> = {
  OPTIMIZATION_NOT_FOUND: '후보 평가를 찾을 수 없습니다.',
  OPTIMIZATION_NOT_READY: '아직 이 작업을 할 수 없는 단계입니다.',
  OPTIMIZATION_ALREADY_PROCESSED: '이미 검증 중이거나 완료된 후보 평가입니다.',
  RUN_ALREADY_ACTIVE: '다른 실행이나 후보 평가가 진행 중입니다. 끝난 뒤 다시 시도해 주세요.',
  INVALID_SITE_INSTANCE: '후보 사이트가 서버에 등록되어 있지 않아 검증할 수 없습니다.',
  EXPERIMENT_CONDITION_MISMATCH: '목표·사용자 유형·모델 설정이 서버에 설정된 값과 달라 진행할 수 없습니다. 설정을 확인한 뒤 다시 시작해 주세요.',
  MODEL_UNAVAILABLE: '모델을 사용할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',
  OPTIMIZER_POLICY_UNAVAILABLE: '후보 선정·판단 모듈을 사용할 수 없습니다. 서버 설정을 확인해 주세요.',
}

/** API 오류 응답의 문구. 서버 `message`가 있으면 그대로, 없으면 코드별 대체 문구, 그것도 없으면 일반 안내다 */
export function optimizationApiErrorMessage(
  code: string | null,
  serverMessage?: string | null,
): string {
  return serverOr(serverMessage, lookup(API_FALLBACKS, code) ?? GENERIC_MESSAGE)
}

// 2. 상태가 `FAILED`인 Optimization의 실패 원인(`error.failedPhase`가 단계를 알려 준다). 이 코드들은 이 맥락에서만 온다.
const FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  BASELINE_INVALID: '기준 화면이 후보 평가 설정과 달라 평가를 멈췄습니다.',
  BASELINE_NOT_EVALUATED: '기준 화면을 평가하지 못해 후보 평가를 멈췄습니다.',
  MODEL_TIMEOUT: '모델 응답이 제한 시간을 넘겨 후보 평가를 멈췄습니다.',
  SITE_INSTANCE_CHANGED: '평가한 뒤 후보 사이트가 바뀌어 검증을 시작하지 못했습니다.',
  SITE_RECHECK_FAILED: '검증 전에 후보 화면을 다시 확인하지 못했습니다.',
  RUN_TIMEOUT: '검증 실행이 제한 시간 안에 끝나지 않았습니다.',
  OPTIMIZATION_INTERRUPTED: '서버가 다시 시작되어 진행이 중단되었습니다.',
  OPTIMIZATION_FAILED: '후보 평가·검증 중 오류가 발생했습니다.',
}

/** `FAILED`인 Optimization의 실패 원인 문구. 모르는 코드는 한국어 서버 `message`, 아니면 일반 안내다 */
export function optimizationFailureMessage(
  code: string | null,
  serverMessage?: string | null,
): string {
  return lookup(FAILURE_MESSAGES, code) ?? koreanOr(serverMessage, '후보 비교를 끝내지 못했습니다. 다시 시작해 주세요.')
}

// 3. 후보 하나의 평가 오류. 다른 후보의 평가는 계속되므로 "평가를 멈췄다"고 쓰지 않는다.
const CANDIDATE_MESSAGES: Readonly<Record<string, string>> = {
  BROWSER_ERROR: '후보 화면을 열지 못했습니다.',
  MODEL_TIMEOUT: '모델 응답이 제한 시간을 넘겨 이 후보를 평가하지 못했습니다.',
  MODEL_RESPONSE_INVALID: '모델 응답이 올바르지 않아 이 후보를 평가하지 못했습니다.',
  LEAK_CHECK_FAILED: '모델 요청에 내부 정보가 섞여 이 후보를 평가하지 않았습니다.',
}

/** 후보 평가 오류(`evaluations[].error`) 문구. 모르는 코드는 한국어 서버 `message`, 아니면 일반 안내다 */
export function candidateErrorMessage(
  code: string | null,
  serverMessage?: string | null,
): string {
  return lookup(CANDIDATE_MESSAGES, code) ?? koreanOr(serverMessage, '이 후보를 평가하지 못했습니다.')
}
