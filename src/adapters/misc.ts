import type { HealthDto, PresetsDto } from '../api/dto/index.ts'
import type { Health, Preset } from '../domain/types.ts'

export function toPreset(dto: PresetsDto): Preset {
  return {
    goals: dto.goals.map(({ goalId, goal }) => ({ goalId, goal })),
    personas: dto.personas.map(({ personaId, persona }) => ({
      personaId,
      persona,
    })),
  }
}

export function toHealth(dto: HealthDto): Health {
  return {
    status: dto.status,
    backendReady: dto.backend.ready,
    modelReady: dto.model.ready,
    browserReady: dto.browser.ready,
    agentReady: dto.agent.ready,
    activeRunId: dto.activeRun ?? null,
    activeOptimization: toActiveOptimization(dto.activeOptimization),
    checkedAt: dto.checkedAt,
  }
}

/** 필드가 없거나 `optimizationId`가 문자열이 아니면 진행 중인 Optimizer가 없는 것으로 본다. 모르는 `status`는 그대로 둔다 */
function toActiveOptimization(
  dto: HealthDto['activeOptimization'],
): Health['activeOptimization'] {
  if (!dto || typeof dto.optimizationId !== 'string') return null
  return {
    optimizationId: dto.optimizationId,
    status: typeof dto.status === 'string' ? dto.status : '',
  }
}
