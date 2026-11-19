import { delay, http, HttpResponse } from 'msw'
import type { SiteListDto } from '../../api/dto/index.ts'
import { apiUrl } from '../../api/client.ts'
import { SITES } from '../fixtures/sites.ts'

export const sitesHandlers = [
  // 시나리오 테스트용 사이트 목록(임시, OI-11). MORO MARKET은 나오지 않는다.
  http.get(apiUrl('/api/sites'), async () => {
    await delay(150)
    const body: SiteListDto = { items: SITES }
    return HttpResponse.json(body)
  }),
]
