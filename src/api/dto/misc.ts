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
  checkedAt: string
}
