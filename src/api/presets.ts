import { toPreset } from '../adapters/misc.ts'
import type { Preset } from '../domain/types.ts'
import { request } from './client.ts'
import type { PresetsDto } from './dto/index.ts'

/** GET /api/presets (계약 §17.9) */
export async function getPresets(signal?: AbortSignal): Promise<Preset> {
  return toPreset(await request<PresetsDto>('/api/presets', { signal }))
}
