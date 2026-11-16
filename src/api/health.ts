import { toHealth } from '../adapters/misc.ts'
import type { Health } from '../domain/types.ts'
import { request } from './client.ts'
import type { HealthDto } from './dto/index.ts'

/** GET /api/health (계약 §17.8) */
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  return toHealth(await request<HealthDto>('/api/health', { signal }))
}
