import { delay, http, HttpResponse } from 'msw'
import type { HealthDto, PresetsDto } from '../../api/dto/index.ts'
import { apiUrl } from '../../api/client.ts'
import { GOAL, PERSONAS } from '../fixtures/scenario.ts'
import { getTiming } from '../fixtures/run.ts'
import { allRuns, getMockActiveOptimization } from '../store.ts'

export const presetsHandlers = [
  // `?includeTest=true`와 `testOnly` 목표는 화면에서 쓰지 않으므로 mock에 두지 않는다.
  http.get(apiUrl('/api/presets'), async () => {
    await delay(150)
    const body: PresetsDto = { goals: [GOAL], personas: PERSONAS }
    return HttpResponse.json(body)
  }),

  // 종료되지 않은 Run이 있으면 `activeRun`에 그 runId 문자열을 담는다(BE `runner.active_run_id`).
  http.get(apiUrl('/api/health'), async () => {
    await delay(100)
    const now = Date.now()
    const active = allRuns().find((run) => !getTiming(run, now).terminal)
    const body: HealthDto = {
      status: 'READY',
      backend: { ready: true },
      model: { ready: true, modelVersion: 'mock', endpointId: 'mock-endpoint' },
      browser: { ready: true },
      agent: { ready: true },
      activeRun: active?.runId ?? null,
      activeOptimization: getMockActiveOptimization(),
      checkedAt: new Date(now).toISOString(),
    }
    return HttpResponse.json(body)
  }),
]
