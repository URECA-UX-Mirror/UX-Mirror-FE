import { toComparison } from '../adapters/comparison.ts'
import type { Comparison } from '../domain/types.ts'
import { request } from './client.ts'
import type { ComparisonResultDto } from './dto/index.ts'

/** GET /api/comparisons/{experimentKey} (계약 §17.6) */
export async function getComparison(
  experimentKey: string,
  signal?: AbortSignal,
): Promise<Comparison> {
  return toComparison(
    await request<ComparisonResultDto>(
      `/api/comparisons/${encodeURIComponent(experimentKey)}`,
      { signal },
    ),
  )
}
