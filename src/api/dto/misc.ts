/** GET /api/presets 응답 (계약 §17.9). 사이트·버전·maxSteps 범위는 응답에 없다(OI-6). */
export interface PresetsDto {
  goals: { goalId: string; goal: string }[]
  personas: { personaId: string; persona: string }[]
}

/**
 * GET /api/health 응답 (계약 §17.8).
 * `activeRun`의 세부 필드와 `status` 값은 계약서 확인 전까지 프론트가 쓰는 부분만 정의한다(OI-9).
 */
export interface HealthDto {
  status: string
  backend: { ready: boolean }
  model: { ready: boolean }
  browser: { ready: boolean }
  activeRun: { runId: string } | null
  checkedAt: string
}
