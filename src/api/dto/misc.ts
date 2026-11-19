/** GET /api/presets 응답 (계약 §17.9). 사이트·버전·maxSteps 범위는 응답에 없다. */
export interface PresetsDto {
  goals: { goalId: string; goal: string }[]
  personas: { personaId: string; persona: string }[]
}

/**
 * GET /api/health 응답 (계약 §17.8, v1.3.5).
 * `status`는 모델·브라우저·에이전트가 모두 준비되면 `READY`, 아니면 `NOT_READY`다.
 * `activeRun`은 실행 중인 Run의 `runId` 문자열이고 없으면 `null`이다(계약서는 `null` 예시만 있고
 * 값이 있을 때의 형식은 적지 않았다. UX-Mirror-BE `api/main.py`의 `runner.active_run_id` 기준).
 * `activeOptimization`은 UX Optimizer가 후보를 평가·검증 중일 때의 `{optimizationId, status}`이고 없으면 `null`이다
 * (계약 v1.3.8 §17.8, BE README). 이 동안 일반 Run 시작은 `409 RUN_ALREADY_ACTIVE`다. 응답에 필드가 없는 서버도 있어 optional이다.
 */
export interface HealthDto {
  status: 'READY' | 'NOT_READY'
  backend: { ready: boolean }
  model: {
    ready: boolean
    modelVersion: string | null
    endpointId: string | null
  }
  browser: { ready: boolean }
  agent: { ready: boolean }
  activeRun: string | null
  activeOptimization?: ActiveOptimizationDto | null
  /** Run 잠금을 잡은 작업 (BE #122·#130). 다른 프로세스의 검증·AI 개선도 보인다. 없는 서버도 있어 optional */
  activeRunOwner?: ActiveRunOwnerDto | null
  checkedAt: string
}

/** `kind`: `RUN`·`IMPROVEMENT`·`IMPROVEMENT_VERIFICATION`·`OPTIMIZATION_EVALUATING` 등. 값 목록이 열려 있어 문자열로 받는다 */
export interface ActiveRunOwnerDto {
  kind: string | null
  runId: string | null
  external?: boolean
  improvementId?: string | null
}

/** `status`는 `CREATED`·`EVALUATING`·`VERIFYING`·`MODEL_CALL_PENDING` 등이다. 값 목록이 열려 있어 문자열로 받는다 */
export interface ActiveOptimizationDto {
  optimizationId: string
  status: string
}
