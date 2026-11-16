import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from './setup.ts'
import { isTerminalStatus } from '../src/domain/runStatus.ts'
import { toRun } from '../src/adapters/run.ts'
import { buildRun } from '../src/mocks/fixtures/run.ts'
import { request, apiUrl, NETWORK_ERROR_MESSAGE } from '../src/api/client.ts'
import { toBoxStyle } from '../src/shared/screenshot/boxStyle.ts'

describe('상태 및 변환', () => {
  it.each(['SUCCESS', 'BLOCKED', 'MAX_STEPS', 'TIMEOUT', 'ERROR'])('%s는 종료 상태', (status) => {
    expect(isTerminalStatus(status)).toBe(true)
  })
  it('모르는 상태는 진행 중이다', () => expect(isTerminalStatus('FUTURE')).toBe(false))
  it('null 지표와 알 수 없는 상태를 보존한다', () => {
    const dto = buildRun({ runId: 'r', experimentKey: 'e', variant: 'before', goalId: 'g', personaId: 'p', maxSteps: 1, createdAtMs: 0 }, 100000)
    dto.status = 'FUTURE_STATUS'
    expect(toRun(dto).status).toBe('FUTURE_STATUS')
    expect(toRun(dto).summary?.extraSteps).toBeNull()
  })
  it('문서의 축소 예와 화면 밖 좌표를 변환한다', () => {
    const base = { width: 1440, height: 900 }
    const style = toBoxStyle({ x: 570, y: 26, width: 84, height: 28 }, { x: 0, y: 0 }, base)
    ;[style.left * 720 / 100, style.top * 450 / 100, style.width * 720 / 100, style.height * 450 / 100].forEach((value, index) => expect(value).toBeCloseTo([285, 13, 42, 14][index]))
    expect(toBoxStyle({ x: 1400, y: -10, width: 100, height: 40 }, { x: 0, y: 0 }, base)).toMatchObject({ top: -10 / 900 * 100, width: 100 / 1440 * 100 })
    expect(toBoxStyle({ x: 1400, y: 0, width: 100, height: 40 }, { x: 0, y: 0 }, base).left + 100 / 1440 * 100).toBeGreaterThan(100)
  })
})
describe('API client', () => {
  it('기존 MSW handler를 사용한다', async () => {
    const result = await request<{ goals: unknown[] }>('/api/presets')
    expect(result.goals.length).toBeGreaterThan(0)
  })
  it('서버 오류와 일반 오류를 구분한다', async () => {
    server.use(http.get(apiUrl('/test'), () => HttpResponse.json({ error: { code: 'BAD', message: '실패', retryable: false } }, { status: 400 })))
    await expect(request('/test')).rejects.toMatchObject({ status: 400, code: 'BAD', message: '실패', retryable: false })
    server.use(http.get(apiUrl('/test'), () => new HttpResponse('bad gateway', { status: 502 })))
    await expect(request('/test')).rejects.toMatchObject({ status: 502, code: null, message: NETWORK_ERROR_MESSAGE, retryable: true })
  })
})
