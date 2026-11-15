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
    activeRunId: dto.activeRun?.runId ?? null,
    checkedAt: dto.checkedAt,
  }
}
