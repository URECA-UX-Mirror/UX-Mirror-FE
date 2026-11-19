// UX Optimizer의 오류 코드를 화면 문구로 바꾼다. 문구는 이 파일 한 곳에서만 정한다(임시, OI-12).
// 두 종류의 코드를 함께 다룬다: API 오류 응답의 `error.code`(HTTP 4xx·5xx)와
// 상태가 `FAILED`인 Optimization의 `error.code`(실패 원인). 모르는 코드는 서버 메시지를 그대로 쓴다.

const MESSAGES: Readonly<Record<string, string>> = {
  // API 오류 (BE README "UX Optimizer API" 오류)
  OPTIMIZATION_NOT_FOUND: '후보 평가를 찾을 수 없습니다.',
  OPTIMIZATION_NOT_READY: '아직 이 작업을 할 수 없는 단계입니다. 후보 평가가 끝난 뒤에 검증하고, 보고서는 검증이 끝난 뒤에 볼 수 있습니다.',
  OPTIMIZATION_ALREADY_PROCESSED: '이미 검증 중이거나 완료된 후보 평가입니다.',
  RUN_ALREADY_ACTIVE: '다른 실행이나 후보 평가가 진행 중입니다. 끝난 뒤 다시 시도해 주세요.',
  INVALID_SITE_INSTANCE: '후보 사이트가 서버에 등록되어 있지 않아 검증할 수 없습니다.',
  EXPERIMENT_CONDITION_MISMATCH: '목표·사용자 유형·모델 설정이 서버에 설정된 값과 달라 진행할 수 없습니다. 설정을 확인한 뒤 다시 시작해 주세요.',
  MODEL_UNAVAILABLE: '모델을 사용할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',
  OPTIMIZER_POLICY_UNAVAILABLE: '후보 선정·판단 모듈을 사용할 수 없습니다. 서버 설정을 확인해 주세요.',
  // 실패한 Optimization의 원인 (`error.failedPhase`가 단계를 알려 준다)
  BASELINE_INVALID: '기준 화면이 후보 평가 설정과 달라 평가를 멈췄습니다.',
  BASELINE_NOT_EVALUATED: '기준 화면을 평가하지 못해 후보 평가를 멈췄습니다.',
  MODEL_TIMEOUT: '모델 응답이 제한 시간을 넘겨 후보 평가를 멈췄습니다.',
  SITE_INSTANCE_CHANGED: '평가한 뒤 후보 사이트가 바뀌어 검증을 시작하지 못했습니다.',
  SITE_RECHECK_FAILED: '검증 전에 후보 화면을 다시 확인하지 못했습니다.',
  RUN_TIMEOUT: '검증 실행이 제한 시간 안에 끝나지 않았습니다.',
  OPTIMIZATION_INTERRUPTED: '서버가 다시 시작되어 진행이 중단되었습니다.',
  OPTIMIZATION_FAILED: '후보 평가·검증 중 오류가 발생했습니다.',
  // 후보 하나의 평가 오류 (`evaluations[].error.code`)
  BROWSER_ERROR: '후보 화면을 열지 못했습니다.',
}

const GENERIC_MESSAGE = '요청을 처리하지 못했습니다.'

/** 정의된 문구가 있는 코드인지. 없으면 서버 메시지를 쓴다 */
export function hasOptimizationErrorMessage(code: string | null): boolean {
  return code !== null && Object.hasOwn(MESSAGES, code)
}

/**
 * 오류 코드를 화면 문구로 바꾼다. 알려진 코드는 정해 둔 문구, 모르는 코드는 서버 `message`(비어 있지 않으면),
 * 그것도 없으면 일반 안내다. 서버 `details`는 쓰지 않는다.
 */
export function optimizationErrorMessage(
  code: string | null,
  serverMessage?: string | null,
): string {
  if (code !== null && Object.hasOwn(MESSAGES, code)) return MESSAGES[code]
  const message = serverMessage?.trim()
  return message ? message : GENERIC_MESSAGE
}
