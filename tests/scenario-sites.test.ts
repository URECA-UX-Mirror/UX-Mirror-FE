import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from './setup.ts'
import { apiUrl, isApiError } from '../src/api/client.ts'
import { createRun, getRun, listRuns } from '../src/api/runs.ts'
import { listSites } from '../src/api/sites.ts'
import { toRun, toRunList } from '../src/adapters/run.ts'
import { toSite } from '../src/adapters/site.ts'
import { isScenarioRun, pageLabel } from '../src/domain/site.ts'
import { buildRun } from '../src/mocks/fixtures/run.ts'
import { addRun, allRuns } from '../src/mocks/store.ts'
import type { CreateRunInput } from '../src/domain/types.ts'
import type { SiteDto } from '../src/api/dto/index.ts'

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

const scenarioInput = (overrides: Partial<CreateRunInput> = {}): CreateRunInput => ({
  experimentKey: `scn_${Math.random().toString(36).slice(2, 10)}`,
  variant: 'before',
  goal: { goal: '구매후기 화면 찾기', verification: { path: '/board/review/4/', text: '구매후기' } },
  persona: { persona: '처음 방문한 사용자' },
  siteId: 'cafe24-ons',
  ...overrides,
})

/** createRun이 서버로 보낸 본문을 잡는다 */
async function capturedBody(input: CreateRunInput): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> = {}
  server.use(
    http.post(apiUrl('/api/runs'), async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        { runId: 'run_x', experimentKey: 'x', variant: 'before', status: 'READY', maxSteps: 8, createdAt: '2026-11-19T00:00:00Z' },
        { status: 201 },
      )
    }),
  )
  await createRun(input)
  return body
}

async function rejection(input: CreateRunInput) {
  try {
    await createRun(input)
  } catch (error) {
    if (isApiError(error)) return error
    throw error
  }
  throw new Error('요청이 거부되어야 합니다')
}

describe('createRun 요청 본문', () => {
  it('siteId가 없으면 본문에 siteId 키가 없다 (버전 비교 요청 불변)', async () => {
    const { siteId: _omit, ...input } = scenarioInput()
    void _omit
    const body = await capturedBody({ ...input, goal: { goalId: 'refund' }, persona: { personaId: 'novice-shopper' }, maxSteps: 5 })
    expect(body).toEqual({ experimentKey: input.experimentKey, variant: 'before', goalId: 'refund', personaId: 'novice-shopper', maxSteps: 5 })
    expect('siteId' in body).toBe(false)
  })

  it('siteId가 있으면 본문에 싣는다', async () => {
    const input = scenarioInput()
    const body = await capturedBody(input)
    expect(body.siteId).toBe('cafe24-ons')
    expect(body.variant).toBe('before')
  })
})

describe('GET /api/sites (mock)', () => {
  it('등록 사이트를 돌려주고 MORO MARKET은 없다', async () => {
    const sites = await listSites()
    expect(sites.map((site) => site.siteId)).toEqual(['cafe24-ons', 'demo-no-map'])
    expect(sites.every((site) => site.mode === 'SCENARIO')).toBe(true)
    expect(JSON.stringify(sites)).not.toMatch(/MORO/)
  })

  it('시연 사이트는 화면 9개, 선택 가능한 도착 화면은 products·review·event·basket뿐이다', async () => {
    const demo = (await listSites()).find((site) => site.siteId === 'cafe24-ons')!
    expect(demo.name).toBe('ONS 공식몰 (cafe24 데모)')
    expect(demo.pages.map((page) => page.pageKey)).toEqual(
      ['home', 'products', 'review', 'qna', 'event', 'guide', 'company', 'basket', 'brand'],
    )
    expect(demo.pages.filter((page) => page.goalSelectable).map((page) => page.pageKey)).toEqual(
      ['products', 'review', 'event', 'basket'],
    )
    // goalText가 null이면 선택할 수 없다
    expect(demo.pages.filter((page) => page.goalText === null).every((page) => !page.goalSelectable)).toBe(true)
  })

  it('siteMap.available이 true인 사이트와 false인 사이트가 모두 있다', async () => {
    const sites = await listSites()
    expect(sites.map((site) => site.siteMapAvailable)).toEqual([true, false])
  })
})

describe('Adapter', () => {
  const dto: SiteDto = {
    siteId: 's',
    name: '사이트',
    mode: 'SCENARIO',
    startPage: 'home',
    pages: [
      { pageKey: 'home', path: '/', label: '홈', goalText: '홈 글자' },
      { pageKey: 'a', path: '/a', label: '화면 A', goalText: '에이' },
      { pageKey: 'b', path: '/b', label: '화면 B', goalText: null },
      { pageKey: 'c', path: '/c', label: '화면 C', goalText: '씨', goalSelectable: false },
    ],
    siteMap: { available: false },
  }

  it('goalSelectable이 없으면 확인 글자가 있고 시작 화면이 아닌 화면을 선택 가능으로 본다', () => {
    const site = toSite(dto)
    expect(site.pages.map((page) => [page.pageKey, page.goalSelectable])).toEqual([
      ['home', false], ['a', true], ['b', false], ['c', false],
    ])
    expect(site.siteMapAvailable).toBe(false)
  })

  it('서버가 준 goalSelectable은 그대로 쓴다', () => {
    const site = toSite({ ...dto, pages: [{ ...dto.pages[1], goalSelectable: false }] })
    expect(site.pages[0].goalSelectable).toBe(false)
  })

  it('화면 이름 조회는 없는 화면이나 사이트면 pageKey를 돌려준다', () => {
    const site = toSite(dto)
    expect(pageLabel(site, 'a')).toBe('화면 A')
    expect(pageLabel(site, 'zzz')).toBe('zzz')
    expect(pageLabel(undefined, 'a')).toBe('a')
  })

  it('시나리오 필드가 없는 Run은 버전 비교 Run으로 읽는다', () => {
    const rec = allRuns().find((run) => !run.siteId)!
    const dtoRun = buildRun(rec, FAR_FUTURE)
    expect('siteId' in dtoRun).toBe(false)
    const run = toRun(dtoRun)
    expect(run.siteId).toBeNull()
    expect(run.mode).toBeNull()
    expect(isScenarioRun(run)).toBe(false)
    const withNull = toRun({ ...dtoRun, siteId: null, mode: null })
    expect(isScenarioRun(withNull)).toBe(false)
  })

  it('mode가 SCENARIO인 Run만 시나리오 Run이다', () => {
    const rec = allRuns()[0]
    const run = toRun({ ...buildRun(rec, FAR_FUTURE), siteId: 'cafe24-ons', mode: 'SCENARIO' })
    expect(run.siteId).toBe('cafe24-ons')
    expect(isScenarioRun(run)).toBe(true)
    expect(isScenarioRun(toRun({ ...buildRun(rec, FAR_FUTURE), siteId: 'cafe24-ons', mode: null }))).toBe(false)
  })

  it('목록 항목도 siteId·mode를 받고 없으면 null이다', () => {
    const [item] = toRunList({
      count: 1,
      items: [{
        runId: 'r', experimentKey: 'k', variant: 'before', status: 'SUCCESS', terminationReason: null,
        validity: 'VALID', replacementRunId: null, resultOrigin: 'MOCK', goalReached: true,
        createdAt: 't', finishedAt: null,
      }],
    })
    expect([item.siteId, item.mode]).toEqual([null, null])
  })
})

describe('시나리오 Run mock', () => {
  it('siteId가 있는 POST /api/runs는 시나리오 Run을 만들고 상세·목록에 siteId·mode가 온다', async () => {
    const input = scenarioInput()
    const created = await createRun(input)
    const run = await getRun(created.runId)
    expect([run.siteId, run.mode, run.variant, run.resultOrigin]).toEqual(['cafe24-ons', 'SCENARIO', 'before', 'MOCK'])
    expect(isScenarioRun(run)).toBe(true)
    expect(run.verification?.path).toBe('/board/review/4/')
    const listed = (await listRuns({ experimentKey: input.experimentKey }))[0]
    expect([listed.siteId, listed.mode]).toEqual(['cafe24-ons', 'SCENARIO'])
  })

  it('버전 비교 Run은 상세에 siteId·mode가 null이다', async () => {
    const run = await getRun('run_mock_done_before')
    expect([run.siteId, run.mode]).toEqual([null, null])
  })

  it.each([
    ['등록되지 않은 siteId', { siteId: 'unknown-site' }],
    ['사이트 화면 밖의 도착 화면', { goal: { goal: '없는 화면', verification: { path: '/nowhere', text: '구매후기' } } }],
    ['goalSelectable이 false인 화면', { goal: { goal: '이용안내', verification: { path: '/board/guide/3/', text: '이용안내' } } }],
    ['시작 화면', { goal: { goal: '홈', verification: { path: '/', text: '홈' } } }],
    ['exact인데 부분 일치뿐인 글자', { goal: { goal: '구매후기', verification: { path: '/board/review/4/', text: '구매', exact: true } } }],
    ['도착 화면에 없는 글자', { goal: { goal: '구매후기', verification: { path: '/board/review/4/', text: '없는글자' } } }],
    ['variant after', { variant: 'after' as const }],
    ['preset 목표', { goal: { goalId: 'refund' } }],
  ] satisfies [string, Partial<CreateRunInput>][])('%s는 422이고 메시지에 Before/After가 없다', async (_name, override) => {
    const error = await rejection(scenarioInput(override))
    expect([error.status, error.code]).toEqual([422, 'CONTRACT_VALIDATION_ERROR'])
    expect(error.message).not.toMatch(/Before|After/)
  })

  it('실행 전 확인 실패(503)에도 Before/After가 붙지 않는다', async () => {
    const error = await rejection(scenarioInput({ experimentKey: 'mock-preflight-503' }))
    expect([error.status, error.code, error.retryable]).toEqual([503, 'BROWSER_ERROR', true])
    expect(error.message).not.toMatch(/Before|After/)
  })

  it('시나리오 Run만 있는 experimentKey의 비교는 404 RUN_NOT_FOUND다', async () => {
    // 시계를 건드리지 않도록 이미 끝난 시각(createdAtMs: 0)의 시나리오 Run을 store에 직접 넣는다
    addRun({
      runId: 'run_test_scenario_only', experimentKey: 'scn_only', variant: 'before', scenario: 'to-mypage', siteId: 'cafe24-ons',
      goalId: null, goal: '구매후기 화면 찾기', personaId: null, persona: '처음 방문한 사용자', maxSteps: 8, createdAtMs: 0,
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/board/review/4/', text: '구매후기', exact: false, scope: 'page' },
    })
    const response = await fetch(apiUrl('/api/comparisons/scn_only'))
    expect(response.status).toBe(404)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('RUN_NOT_FOUND')
  })

  it('버전 비교 Run과 시나리오 Run은 같은 experimentKey를 쓸 수 없다', async () => {
    const error = await rejection(scenarioInput({ experimentKey: 'mock-done' }))
    expect([error.status, error.code]).toEqual([422, 'CONTRACT_VALIDATION_ERROR'])
  })
})
