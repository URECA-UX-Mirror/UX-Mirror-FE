import { expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { buildIssues, buildRun, buildSteps, siteMapGoalProbability, specsOf } from '../src/mocks/fixtures/run.ts'
import * as siteMap from '../src/mocks/fixtures/siteMap.ts'
import { scenarioForGoal, textVisibleOn, VISIBLE_TEXTS } from '../src/mocks/fixtures/scenario.ts'
import { GOAL_PAGES } from '../src/features/new-analysis/constants.ts'
import { buildOptimization, buildReport, EVAL_START_MS, EVAL_STEP_MS, RECHECK_MS, verificationRuns } from '../src/mocks/fixtures/optimization.ts'
import { allRuns, findRun } from '../src/mocks/store.ts'
import { resetMockOptimizations } from '../src/mocks/store.ts'
import type { OptimizationRecord, OptimizationScenario, RunRecord } from '../src/mocks/store.ts'

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

it('사이트 지도 목표 확률은 모든 후보의 거리를 확인한다', () => {
  const candidates = [{ leadsTo: 'orders' as const, probability: 0.4 }, { leadsTo: 'mypage' as const, probability: 0.6 }]
  expect(siteMapGoalProbability({ home: 1, orders: 1, mypage: 2 }, 'home', candidates)).toBe(0)
  expect(siteMapGoalProbability({ home: 1, orders: 0 }, 'home', candidates)).toBeNull()
  expect(siteMapGoalProbability({ orders: 0, mypage: 2 }, 'home', candidates)).toBeNull()
  expect(siteMapGoalProbability({ home: 1, orders: 0, mypage: 2 }, 'home', candidates)).toBe(0.4)
  expect(siteMapGoalProbability({ home: 1, orders: 0, mypage: null }, 'home', candidates)).toBe(0.4)
  expect(siteMapGoalProbability({ home: 1, orders: null, mypage: null }, 'home', candidates)).toBe(0)
  expect(siteMapGoalProbability({ home: null, orders: 0, mypage: null }, 'home', candidates)).toBe(0.4)
})

it('허용 경로 기준의 목표 확률은 기존 후보 확률의 합이다', () => {
  const rec = findRun('run_mock_done_before')!
  const step = buildSteps(rec, 1)[0]
  expect(step.decision.goalPathProbability).toBe(0.684)
})

it('Step 생성에도 사이트 지도 목표 확률의 0과 null이 반영된다', () => {
  const rec = findRun('run_mock_sitemap')!
  const spec = specsOf(rec)[0]
  const config = siteMap.siteMapConfig('orders')
  const distances = Object.fromEntries(spec.choices.candidates.map((c) => [c.leadsTo, 1]))
  distances[spec.pageKey] = 1
  const spy = vi.spyOn(siteMap, 'siteMapConfig')
  try {
    spy.mockReturnValue({ ...config, distances })
    expect(buildSteps(rec, 1)[0].decision.goalPathProbability).toBe(0)
    delete distances[spec.choices.candidates[0].leadsTo]
    expect(buildSteps(rec, 1)[0].decision.goalPathProbability).toBeNull()
  } finally {
    spy.mockRestore()
  }
})

// ---- UX Optimizer mock (FE #68, 임시 OI-12) ----

const OPT_SECOND = 1000
const optRec = (scenario: OptimizationScenario, patch: Partial<OptimizationRecord> = {}): OptimizationRecord => ({
  optimizationId: `opt_t_${scenario}`, scenario, sourceRunId: null, createdAtMs: 0, ...patch,
})
/** 평가가 모두 끝나는 시각(성공 시나리오) */
const EVALUATED_AT = EVAL_START_MS + 5 * EVAL_STEP_MS

it('Optimizer mock: 후보 5개(C0 기준 이용정보, C1 주문·배송, C2 주문·환불, C3 주문·반품, C4 주문 관리)가 시간에 따라 평가된다', () => {
  const at = (ms: number) => buildOptimization(optRec('success'), ms)
  expect(at(0)).toMatchObject({ status: 'CREATED', progress: { evaluatedCount: 0, totalCount: 5 }, evaluations: [] })
  expect(at(0).candidateLabels.map((c) => [c.candidateId, c.label, c.role])).toEqual([
    ['C0', '이용정보', 'BASELINE'], ['C1', '주문·배송', 'CANDIDATE'], ['C2', '주문·환불', 'CANDIDATE'],
    ['C3', '주문·반품', 'CANDIDATE'], ['C4', '주문 관리', 'CANDIDATE'],
  ])
  const mid = at(EVAL_START_MS + 2 * EVAL_STEP_MS + 1)
  expect(mid).toMatchObject({ status: 'EVALUATING', progress: { evaluatedCount: 2 }, selection: null })
  expect(mid.evaluations.map((e) => e.candidateId)).toEqual(['C0', 'C1'])
  const done = at(EVALUATED_AT)
  expect(done).toMatchObject({ status: 'EVALUATED', verificationPhase: null, recommendedCandidateId: 'C2', verificationCandidateId: 'C2' })
  expect(done.evaluations).toHaveLength(5)
  // 확률은 semanticKey 기준으로 합이 1이고 대상 메뉴 확률이 targetOptionProbability와 같다
  for (const ev of done.evaluations) {
    expect(Object.values(ev.probabilities!).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4)
    expect(ev.probabilities!['상단 메뉴>/shop/orders#1']).toBe(ev.targetOptionProbability)
  }
})

it('Optimizer mock: 후보 하나가 FAILED(BROWSER_ERROR)·SKIPPED(INVALID_CANDIDATE)여도 나머지로 선정된다', () => {
  const dto = buildOptimization(optRec('partial'), EVALUATED_AT)
  const byId = Object.fromEntries(dto.evaluations.map((e) => [e.candidateId, e]))
  expect(byId.C3).toMatchObject({ evaluationStatus: 'FAILED', error: { code: 'BROWSER_ERROR' }, targetOptionProbability: null })
  expect(byId.C4).toMatchObject({ evaluationStatus: 'SKIPPED', candidateValidity: 'INVALID_CANDIDATE', invalidReasons: ['SITE_INSTANCE_MISSING'] })
  expect(dto.status).toBe('EVALUATED')
  expect(dto.selection?.excludedCandidates.map((c) => c.candidateId)).toEqual(['C3', 'C4'])
  expect(dto.progress).toEqual({ evaluatedCount: 5, totalCount: 5 })
})

it('Optimizer mock: 평가 단계 실패(MODEL_TIMEOUT)와 서버 재시작(OPTIMIZATION_INTERRUPTED)은 FAILED로 끝난다', () => {
  const timeout = buildOptimization(optRec('eval-timeout'), 60 * OPT_SECOND)
  expect(timeout).toMatchObject({ status: 'FAILED', selection: null, error: { code: 'MODEL_TIMEOUT', failedPhase: 'EVALUATING', lastStatus: 'EVALUATING' } })
  expect(timeout.evaluations.map((e) => e.candidateId)).toEqual(['C0', 'C1', 'C2'])
  expect(timeout.evaluations[2]).toMatchObject({ evaluationStatus: 'FAILED', error: { code: 'MODEL_TIMEOUT' } })
  const interrupted = buildOptimization(optRec('interrupted'), 60 * OPT_SECOND)
  expect(interrupted).toMatchObject({ status: 'FAILED', error: { code: 'OPTIMIZATION_INTERRUPTED', failedPhase: 'EVALUATING' } })
  expect(interrupted.evaluations).toHaveLength(2)
  // 실패 전에는 평가 중이다(종료로 보이지 않는다)
  expect(buildOptimization(optRec('eval-timeout'), EVAL_START_MS + EVAL_STEP_MS).status).toBe('EVALUATING')
})

it('Optimizer mock: 검증은 기준 Run → 후보 Run → COMPLETED로 진행하고 report가 열린다', () => {
  const rec = optRec('success', { verifyAtMs: EVALUATED_AT })
  const [baseline, candidate] = verificationRuns(rec)
  expect(baseline).toMatchObject({ experimentKey: rec.optimizationId, variant: 'before', optimizationContext: { executionRole: 'BASELINE', candidateId: 'C0', label: '이용정보' } })
  expect(candidate).toMatchObject({ experimentKey: rec.optimizationId, variant: 'after', optimizationContext: { executionRole: 'CANDIDATE', candidateId: 'C2', label: '주문·환불' } })
  const at = (ms: number) => buildOptimization(rec, ms)
  expect(at(EVALUATED_AT - 1).status).toBe('EVALUATING')   // 평가가 끝나기 전에는 검증 시작 시각이 있어도 평가 중이다
  expect(at(EVALUATED_AT + 1)).toMatchObject({ status: 'VERIFYING', verificationPhase: 'BASELINE', baselineRunId: null })
  expect(at(baseline.createdAtMs + 1)).toMatchObject({ status: 'VERIFYING', verificationPhase: 'BASELINE', baselineRunId: baseline.runId, validationRunId: null })
  expect(at(candidate.createdAtMs + 1)).toMatchObject({ status: 'VERIFYING', verificationPhase: 'CANDIDATE', validationRunId: candidate.runId })
  const end = candidate.createdAtMs + 60 * OPT_SECOND
  expect(at(end)).toMatchObject({ status: 'COMPLETED', verificationPhase: null, finalDecision: expect.any(String), verification: { reasonCode: expect.any(String) } })
  expect(buildReport(rec, candidate.createdAtMs + 1)).toBeNull()
  expect(buildReport(rec, end)).toMatchObject({ status: 'COMPLETED', runs: { baseline: { runId: baseline.runId, goalReached: true }, candidate: { runId: candidate.runId, goalReached: true } } })
  // 검증 Run 응답은 optimizationContext를 담는다
  expect(buildRun(candidate, end).optimizationContext).toMatchObject({ optimizationId: rec.optimizationId, siteInstanceId: 'site-c2' })
})

it('Optimizer mock: 검증 중 사이트가 바뀌면 SITE_INSTANCE_CHANGED로 FAILED이고 Run은 만들지 않는다', () => {
  const rec = optRec('site-changed', { verifyAtMs: EVALUATED_AT })
  expect(verificationRuns(rec)).toEqual([])
  expect(buildOptimization(rec, EVALUATED_AT + 1).status).toBe('VERIFYING')
  expect(buildOptimization(rec, EVALUATED_AT + 60 * OPT_SECOND)).toMatchObject({
    status: 'FAILED', baselineRunId: null, validationRunId: null,
    error: { code: 'SITE_INSTANCE_CHANGED', failedPhase: 'VERIFYING', lastStatus: 'VERIFYING' },
  })
})

const optApi = (path: string, init?: RequestInit) => fetch(apiUrl(`/api/optimizations${path}`), init)
const post = (path: string, body?: unknown) =>
  optApi(path, { method: 'POST', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
const errorCode = async (response: Response) => ((await response.json()) as { error: { code: string } }).error.code

it('Optimizer mock API: 오류 코드(404·409·422·503)를 BE README와 같게 돌려준다', async () => {
  expect(await errorCode(await optApi('/opt_none'))).toBe('OPTIMIZATION_NOT_FOUND')
  expect((await optApi('/opt_none/report')).status).toBe(404)
  expect((await post('/opt_none/verify')).status).toBe(404)
  // 완료되지 않은 Optimization의 보고서
  const notReady = await optApi('/opt_mock_evaluated/report')
  expect([notReady.status, await errorCode(notReady)]).toEqual([409, 'OPTIMIZATION_NOT_READY'])
  // 평가가 끝나지 않았거나 실패한 Optimization은 검증할 수 없다
  const failed = await post('/opt_mock_eval_timeout/verify')
  expect([failed.status, await errorCode(failed)]).toEqual([409, 'OPTIMIZATION_NOT_READY'])
  // 이미 완료된 Optimization
  const processed = await post('/opt_mock_completed/verify')
  expect([processed.status, await errorCode(processed)]).toEqual([409, 'OPTIMIZATION_ALREADY_PROCESSED'])
  // 생성 오류
  for (const [sourceRunId, status, code] of [
    ['mock-opt-model-unavailable', 503, 'MODEL_UNAVAILABLE'],
    ['mock-opt-policy-unavailable', 503, 'OPTIMIZER_POLICY_UNAVAILABLE'],
    ['mock-opt-condition-mismatch', 422, 'EXPERIMENT_CONDITION_MISMATCH'],
    ['run_does_not_exist', 404, 'RUN_NOT_FOUND'],
  ] as const) {
    const response = await post('', { sourceRunId })
    expect([sourceRunId, response.status, await errorCode(response)]).toEqual([sourceRunId, status, code])
  }
})

it('Optimizer mock API: 생성 → 진행 조회 → (평가 뒤) 검증 시작·중복 거부, 한 번에 하나만 진행하고 일반 Run도 막는다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const t0 = Date.parse('2030-01-01T00:00:00Z')
    vi.setSystemTime(t0)
    const created = await post('', { sourceRunId: 'mock-opt-invalid-site' })
    expect(created.status).toBe(202)
    const { optimizationId, status } = (await created.json()) as { optimizationId: string; status: string }
    expect(status).toBe('CREATED')

    // 진행 중에는 다른 Optimization도 일반 Run도 시작할 수 없고 health에 보인다
    const second = await post('')
    expect([second.status, await errorCode(second)]).toEqual([409, 'RUN_ALREADY_ACTIVE'])
    const run = await fetch(apiUrl('/api/runs'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentKey: 'x1', variant: 'before', goalId: 'refund', personaId: 'novice-shopper' }) })
    expect([run.status, await errorCode(run)]).toEqual([409, 'RUN_ALREADY_ACTIVE'])
    const health = (await (await fetch(apiUrl('/api/health'))).json()) as { activeOptimization: { optimizationId: string; status: string } | null }
    expect(health.activeOptimization).toEqual({ optimizationId, status: 'CREATED' })

    // 평가가 끝나기 전에는 검증할 수 없다
    vi.setSystemTime(t0 + EVAL_START_MS + EVAL_STEP_MS)
    const early = await post(`/${optimizationId}/verify`)
    expect([early.status, await errorCode(early)]).toEqual([409, 'OPTIMIZATION_NOT_READY'])
    const progress = (await (await optApi(`/${optimizationId}`)).json()) as { status: string; progress: { evaluatedCount: number } }
    expect(progress).toMatchObject({ status: 'EVALUATING', progress: { evaluatedCount: 1 } })

    // 평가가 끝나면 진행 중이 아니고(health null) 후보 사이트가 없는 시나리오는 422 INVALID_SITE_INSTANCE
    vi.setSystemTime(t0 + EVALUATED_AT)
    expect(((await (await fetch(apiUrl('/api/health'))).json()) as { activeOptimization: unknown }).activeOptimization).toBeNull()
    const invalid = await post(`/${optimizationId}/verify`)
    expect([invalid.status, await errorCode(invalid)]).toEqual([422, 'INVALID_SITE_INSTANCE'])
  } finally {
    vi.useRealTimers()
    resetMockOptimizations()   // 미래 시각(2030)에 만든 기록이 뒤 테스트에서 진행 중으로 보이지 않게 한다
  }
})

it('Optimizer mock API: 평가가 끝난 시드를 검증하면 202와 Run ID를 주고, 같은 실험 키로 비교가 열린다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const t0 = Date.parse('2030-06-01T00:00:00Z')
    vi.setSystemTime(t0)
    const started = await post('/opt_mock_evaluated/verify')
    expect(started.status).toBe(202)
    const body = (await started.json()) as Record<string, unknown>
    // 실서버처럼 시작 응답에는 아직 만들지 않은 Run의 ID가 없다
    expect(body).toEqual({
      optimizationId: 'opt_mock_evaluated', status: 'VERIFYING', verificationPhase: 'BASELINE',
      baselineRunId: null, validationRunId: null,
    })
    // 시작 직후 다시 시작하면 이미 진행 중이다
    const again = await post('/opt_mock_evaluated/verify')
    expect([again.status, await errorCode(again)]).toEqual([409, 'OPTIMIZATION_ALREADY_PROCESSED'])

    // 검증 Run이 끝나고 Issue 분석까지 끝나면 `/api/comparisons/{optimizationId}`가 열린다
    vi.setSystemTime(t0 + 5 * 60 * OPT_SECOND)
    const done = (await (await optApi('/opt_mock_evaluated')).json()) as { status: string; baselineRunId: string; validationRunId: string }
    expect(done.status).toBe('COMPLETED')
    const report = await optApi('/opt_mock_evaluated/report')
    expect(report.status).toBe(200)
    const comparison = await fetch(apiUrl('/api/comparisons/opt_mock_evaluated'))
    expect(comparison.status).toBe(200)
    const runs = (await (await fetch(apiUrl('/api/runs?experimentKey=opt_mock_evaluated'))).json()) as { items: { runId: string; variant: string }[] }
    expect(runs.items.map((r) => [r.runId, r.variant]).sort()).toEqual([
      [done.baselineRunId, 'before'], [done.validationRunId, 'after'],
    ])
    const candidate = (await (await fetch(apiUrl(`/api/runs/${done.validationRunId}`))).json()) as { optimizationContext: { executionRole: string } }
    expect(candidate.optimizationContext.executionRole).toBe('CANDIDATE')
  } finally {
    vi.useRealTimers()
    resetMockOptimizations()   // 미래 시각(2030)에 만든 기록이 뒤 테스트에서 진행 중으로 보이지 않게 한다
  }
})

it('Optimizer mock API: 검증 시작 직후·기준 단계에는 아직 만들지 않은 후보 Run이 health·목록에 보이지 않는다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    const t0 = Date.parse('2031-01-01T00:00:00Z')
    vi.setSystemTime(t0)
    expect((await post('/opt_mock_evaluated/verify')).status).toBe(202)
    const baseline = 'run_opt_mock_evaluated_baseline'
    const activeRun = async () => ((await (await fetch(apiUrl('/api/health'))).json()) as { activeRun: string | null }).activeRun
    const listed = async () => ((await (await fetch(apiUrl('/api/runs?experimentKey=opt_mock_evaluated'))).json()) as { items: { runId: string }[] }).items.map((r) => r.runId)

    // 사이트 재확인 중: Run이 아직 없다
    vi.setSystemTime(t0 + RECHECK_MS - 1)
    expect([await activeRun(), await listed()]).toEqual([null, []])
    expect((await fetch(apiUrl(`/api/runs/${baseline}`))).status).toBe(404)
    // 기준 Run 실행 중: 기준 Run만 있고 activeRun도 기준 Run이다
    vi.setSystemTime(t0 + RECHECK_MS + 2000)
    expect([await activeRun(), await listed()]).toEqual([baseline, [baseline]])
    expect((await fetch(apiUrl('/api/runs/run_opt_mock_evaluated_candidate'))).status).toBe(404)
  } finally {
    vi.useRealTimers()
    resetMockOptimizations()
  }
})
