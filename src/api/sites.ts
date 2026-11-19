import { toSiteList } from '../adapters/site.ts'
import type { Site } from '../domain/types.ts'
import { request } from './client.ts'
import type { SiteListDto } from './dto/index.ts'

/**
 * GET /api/sites (임시, OI-11). 시나리오 테스트에 쓸 수 있는 등록 사이트 목록이다.
 * 계약서 v1.3.5에 없는 endpoint라 mock 형식을 기준으로 한다.
 */
export async function listSites(signal?: AbortSignal): Promise<Site[]> {
  return toSiteList(await request<SiteListDto>('/api/sites', { signal }))
}
