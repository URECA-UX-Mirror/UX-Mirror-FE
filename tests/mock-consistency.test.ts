import { expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { buildIssues, buildRun } from '../src/mocks/fixtures/run.ts'
import { scenarioForGoal, textVisibleOn, VISIBLE_TEXTS } from '../src/mocks/fixtures/scenario.ts'
import { GOAL_PAGES } from '../src/features/new-analysis/constants.ts'
import { allRuns, findRun } from '../src/mocks/store.ts'
import type { RunRecord } from '../src/mocks/store.ts'

// MOCK의 goalReached는 시나리오가 끝났는지로 정해진다. 저장된 성공 조건(verification)과 어긋나지 않게,
// 목표에 도달한 시드는 마지막 방문 화면이 성공 조건의 도착 화면이어야 한다 (FE #27 리뷰).
const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

it('목표에 도달한 MOCK 시드는 마지막 방문 화면이 성공 조건의 도착 화면이다', () => {
  const reached = allRuns().map((rec) => buildRun(rec, FAR_FUTURE)).filter((run) => run.summary?.goalReached)
  expect(reached.length).toBeGreaterThan(0)
  for (const run of reached) {
    const last = run.summary!.path.at(-1)!
    expect([run.runId, last.path]).toEqual([run.runId, run.verification!.path])
  }
})

it('직접 입력 시드의 성공 조건 글자는 도착 화면의 실제 제목과 같다', () => {
  const direct = allRuns().map((rec) => buildRun(rec, FAR_FUTURE)).filter((run) => run.goalId === null)
  expect(direct.length).toBeGreaterThan(0)
  for (const run of direct) {
    const page = GOAL_PAGES.find((item) => item.path === run.verification!.path)
    expect([run.runId, run.verification!.text]).toEqual([run.runId, page?.text])
  }
})

it('화면에서 새로 만든 직접 입력 Run도 도착 화면마다 성공 조건과 같은 화면에서 끝난다', () => {
  for (const page of GOAL_PAGES) {
    for (const variant of ['before', 'after'] as const) {
      const scenario = scenarioForGoal(variant, page.path)
      expect(scenario).not.toBeNull()
      const rec: RunRecord = {
        runId: `run_test_${variant}_${page.path}`, experimentKey: 'test', variant, scenario: scenario!,
        goalId: null, goal: '테스트 목표', personaId: null, persona: '테스트 사용자', maxSteps: 8, createdAtMs: 0,
        verification: { type: 'PATH_AND_VISIBLE_TEXT', path: page.path, text: page.text, exact: false, scope: 'page' },
      }
      const run = buildRun(rec, FAR_FUTURE)
      expect([page.path, variant, run.summary?.goalReached]).toEqual([page.path, variant, true])
      expect([page.path, variant, run.summary!.path.at(-1)!.path]).toEqual([page.path, variant, page.path])
    }
  }
  expect(scenarioForGoal('before', '/shop/home')).toBeNull()   // 시작 화면은 도착 화면이 될 수 없다
})

it('POST /api/runs로 만든 직접 입력 Run은 도착 화면 시나리오를 쓴다', async () => {
  const response = await fetch(apiUrl('/api/runs'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ experimentKey: 'mock-direct-new', variant: 'after', goal: '주문 내역 화면 찾기', persona: '테스트 사용자',
      verification: { path: '/shop/orders', text: '주문 / 배송 조회' } }),
  })
  expect(response.status).toBe(201)
  const { runId } = (await response.json()) as { runId: string }
  expect(findRun(runId)?.scenario).toBe('to-orders-after')
})

it('허용 경로가 없는 Run은 요약의 추가 단계가 null이고 EXTRA_STEPS 이슈도 없다', () => {
  for (const rec of allRuns().filter((item) => item.goalId === null && item.reference !== 'site-map')) {
    const run = buildRun(rec, FAR_FUTURE)
    expect([rec.runId, run.referencePathConfig, run.summary?.extraSteps]).toEqual([rec.runId, null, null])
    const types = buildIssues(rec, FAR_FUTURE).items.map((issue) => issue.issueType)
    expect([rec.runId, types.includes('EXTRA_STEPS'), types.includes('REFERENCE_PATH_DEVIATION')]).toEqual([rec.runId, false, false])
  }
  // 같은 경로라도 preset Run이면 EXTRA_STEPS가 생긴다(조건이 허용 경로 유무로만 갈리는지 확인)
  const preset = { ...allRuns().find((item) => item.runId === 'run_mock_direct_before')!, goalId: 'refund', scenario: 'before' as const }
  expect(buildIssues(preset, FAR_FUTURE).items.map((issue) => issue.issueType)).toContain('EXTRA_STEPS')
})

/** POST /api/runs 직접 입력 요청 */
async function createDirect(experimentKey: string, verification: Record<string, unknown>) {
  const response = await fetch(apiUrl('/api/runs'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ experimentKey, variant: 'before', goal: '주문 내역 화면 찾기', persona: '테스트 사용자', verification }),
  })
  return { status: response.status, body: (await response.json()) as { error?: { message: string } } }
}

it('화면에 없는 글자를 성공 조건으로 넣으면 MOCK은 Run을 만들지 않는다 (성공으로 표시하지 않음)', async () => {
  const before = allRuns().length
  for (const [key, verification] of [
    ['mock-text-missing', { path: '/shop/orders', text: '화면에 없는 글자' }],
    ['mock-text-spacing', { path: '/shop/orders', text: '주문/배송 조회' }],   // 탭 제목에만 있는 글자
    ['mock-text-exact', { path: '/shop/orders', text: '배송 조회', exact: true }],   // 부분만 맞는데 정확 일치
    ['mock-text-other-page', { path: '/shop/orders', text: '환불 / 반품 신청' }],   // 다른 화면의 제목
  ] as const) {
    const { status, body } = await createDirect(key, verification)
    expect([key, status]).toEqual([key, 422])
    expect(body.error?.message).toContain('글자가 없습니다')
  }
  expect(allRuns().length).toBe(before)
})

it('도착 화면 제목과 맞는 글자는 부분 일치·정확 일치·찾는 범위와 관계없이 받는다', async () => {
  expect(textVisibleOn('/shop/orders', '배송 조회', false)).toBe(true)
  expect(textVisibleOn('/shop/orders', '주문 / 배송 조회', true)).toBe(true)
  expect(textVisibleOn('/shop/orders', '배송 조회', true)).toBe(false)
  // 앞에서 만든 Run이 진행 중이면 409가 나므로, 시각을 1시간씩 앞당겨 이전 Run을 끝난 상태로 만든다
  const base = Date.now()
  try {
    for (const [i, scope] of ['page', 'main'].entries()) {
      vi.spyOn(Date, 'now').mockReturnValue(base + (i + 1) * 3_600_000)
      const { status } = await createDirect(`mock-text-ok-${scope}`, { path: '/shop/orders', text: '배송 조회', scope })
      expect([scope, status]).toEqual([scope, 201])
    }
  } finally {
    vi.restoreAllMocks()
  }
})

it('화면이 자동으로 채우는 도착 화면 제목은 모두 MOCK이 판정할 수 있다', () => {
  for (const page of GOAL_PAGES) {
    expect([page.path, VISIBLE_TEXTS[page.path]]).toEqual([page.path, [page.text]])
    expect(textVisibleOn(page.path, page.text, true)).toBe(true)
  }
})
