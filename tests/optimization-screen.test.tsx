import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { OptimizationDto } from '../src/api/dto/index.ts'
import { OptimizationPage } from '../src/features/optimization/OptimizationPage.tsx'
import { OptimizationStartPage } from '../src/features/optimization/OptimizationStartPage.tsx'
import { EngineStatus } from '../src/shared/EngineStatus.tsx'
import {
  buildOptimization,
  EVAL_START_MS,
  EVAL_STEP_MS,
} from '../src/mocks/fixtures/optimization.ts'
import {
  findOptimization,
  resetMockOptimizations,
  setMockActiveOptimization,
} from '../src/mocks/store.ts'
import { server } from './setup.ts'

// 메뉴 이름 후보 비교 화면 (FE #69). mock 시드와 시나리오는 src/mocks/fixtures/optimization.ts 주석을 따른다.

afterEach(() => {
  setMockActiveOptimization(null)
  resetMockOptimizations()
})

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')
const FAKE = { optimizationId: 'opt_x', scenario: 'success', sourceRunId: null, createdAtMs: 0 } as const

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

function renderOptimization(optimizationId: string) {
  return render(
    <MemoryRouter initialEntries={[`/optimizations/${optimizationId}`]}>
      <Routes>
        <Route path="/optimizations/:optimizationId" element={<OptimizationPage />} />
        <Route path="/optimizations" element={<p>시작 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 시드 Optimization을 끝난 시점의 응답으로 만든다 */
const seeded = (id: string): OptimizationDto => buildOptimization(findOptimization(id)!, FAR_FUTURE)

function serve(dto: OptimizationDto) {
  server.use(http.get(apiUrl(`/api/optimizations/${dto.optimizationId}`), () => HttpResponse.json(dto)))
}

/** 화면 글자에 서버 코드값·ID가 보이지 않는다 */
function expectNoCodes(...codes: string[]) {
  const text = document.body.textContent ?? ''
  for (const code of codes) expect(text).not.toContain(code)
}

const card = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-candidate="${id}"]`)
  if (!found) throw new Error(`후보 카드 ${id} 없음`)
  return within(found)
}

// ---- 시작 화면 ----

function renderStart(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/optimizations${search}`]}>
      <Routes>
        <Route path="/optimizations" element={<OptimizationStartPage />} />
        <Route
          path="/optimizations/:optimizationId"
          element={
            <>
              <LocationProbe />
              <OptimizationPage />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

it('시작: 후보 평가 시작을 누르면 Optimization 화면으로 이동해 대기 상태와 후보 5개를 보인다', async () => {
  renderStart()
  const button = (await screen.findByRole('button', { name: '후보 평가 시작' })) as HTMLButtonElement
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('메뉴 이름 후보 비교')
  expectNoCodes('Optimizer')
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/optimizations\/opt_mock_/))
  expect(await screen.findByText('평가 대기 중')).toBeTruthy()
  expect(document.querySelectorAll('.candidate-card')).toHaveLength(5)
  expect(card('C0').getByText('기준')).toBeTruthy()
  expect(card('C1').getByText('후보')).toBeTruthy()
})

it('시작: 엔진이 READY가 아니거나 진행 중인 Optimization·Run이 있으면 시작할 수 없다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'EVALUATING' })
  const view = renderStart()
  expect(await screen.findByText('진행 중인 후보 평가가 있어 시작할 수 없습니다.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '후보 평가 시작' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('link', { name: /진행 중인 후보 평가 보기/ }).getAttribute('href')).toBe('/optimizations/opt_mock_1')
  view.unmount()

  server.use(
    http.get(apiUrl('/api/health'), () =>
      HttpResponse.json({
        status: 'READY',
        backend: { ready: true },
        model: { ready: true, modelVersion: 'm', endpointId: 'e' },
        browser: { ready: true },
        agent: { ready: true },
        activeRun: { runId: 'run_1' },
        checkedAt: '2026-11-19T00:00:00Z',
      }),
    ),
  )
  renderStart()
  expect(await screen.findByText('진행 중인 분석이 있어 시작할 수 없습니다.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '후보 평가 시작' }) as HTMLButtonElement).disabled).toBe(true)
})

it('시작: 막힌 이유와 상관없이 다시 확인을 보이고, 상태가 풀리면 시작할 수 있다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'EVALUATING' })
  renderStart()
  expect(await screen.findByText('진행 중인 후보 평가가 있어 시작할 수 없습니다.')).toBeTruthy()
  setMockActiveOptimization(null)
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  const button = screen.getByRole('button', { name: '후보 평가 시작' }) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  expect(screen.queryByText('진행 중인 후보 평가가 있어 시작할 수 없습니다.')).toBeNull()
})

it('시작: 409로 실패하면 엔진 상태를 다시 읽는다', async () => {
  let healthCalls = 0
  server.use(
    http.get(apiUrl('/api/health'), () => {
      healthCalls += 1
      return HttpResponse.json({
        status: 'READY',
        backend: { ready: true },
        model: { ready: true, modelVersion: 'm', endpointId: 'e' },
        browser: { ready: true },
        agent: { ready: true },
        activeRun: null,
        checkedAt: '2026-11-19T00:00:00Z',
      })
    }),
    http.post(apiUrl('/api/optimizations'), () =>
      HttpResponse.json(
        { error: { code: 'RUN_ALREADY_ACTIVE', message: '다른 실행이 진행 중입니다.', retryable: true } },
        { status: 409 },
      ),
    ),
  )
  renderStart()
  const button = (await screen.findByRole('button', { name: '후보 평가 시작' })) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  expect(healthCalls).toBe(1)
  fireEvent.click(button)
  await screen.findByText('다른 실행이 진행 중입니다.')
  await waitFor(() => expect(healthCalls).toBe(2))
})

it('시작: 상태를 확인할 수 없으면 시작을 막고 다시 확인을 제공한다', async () => {
  server.use(http.get(apiUrl('/api/health'), () => HttpResponse.error()))
  renderStart()
  expect(await screen.findByText('엔진 상태를 확인할 수 없어 시작할 수 없습니다.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '후보 평가 시작' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '다시 확인' })).toBeTruthy()
})

it('시작 오류: 코드별 이유를 보이고 화면에 머문다', async () => {
  const cases: [string, RegExp][] = [
    ['mock-opt-model-unavailable', /모델을 사용할 수 없습니다/],
    ['mock-opt-policy-unavailable', /후보 선정·판단 모듈/],
    ['mock-opt-condition-mismatch', /목표·사용자 유형/],
  ]
  for (const [sourceRunId, message] of cases) {
    const view = renderStart(`?sourceRunId=${sourceRunId}`)
    expect(await screen.findByText('방금 본 진단 결과와 연결해 시작합니다.')).toBeTruthy()
    expectNoCodes(sourceRunId)
    const button = screen.getByRole('button', { name: '후보 평가 시작' }) as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(screen.queryByTestId('location')).toBeNull()
    view.unmount()
  }

  server.use(
    http.post(apiUrl('/api/optimizations'), () =>
      HttpResponse.json(
        { error: { code: 'RUN_ALREADY_ACTIVE', message: '다른 실행이 진행 중입니다.', retryable: true } },
        { status: 409 },
      ),
    ),
  )
  renderStart()
  const button = (await screen.findByRole('button', { name: '후보 평가 시작' })) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.click(button)
  expect((await screen.findByRole('alert')).textContent).toBe('다른 실행이 진행 중입니다.')
})

// ---- 진행 상태 ----

it('CREATED: 평가 전에도 후보 5개를 후보 순서대로 카드로 보인다', async () => {
  serve(buildOptimization(FAKE, 0))
  renderOptimization('opt_x')
  expect(await screen.findByText('평가 대기 중')).toBeTruthy()
  const ids = Array.from(document.querySelectorAll('.candidate-card')).map((el) => el.getAttribute('data-candidate'))
  expect(ids).toEqual(['C0', 'C1', 'C2', 'C3', 'C4'])
  expect(screen.getByText('0 / 5개')).toBeTruthy()
  expect(card('C0').getByText('평가 대기')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '선정 결과' })).toBeNull()
})

it('EVALUATING: 끝난 후보는 결과를, 다음 후보는 평가 중을, 나머지는 대기를 보인다', async () => {
  serve(buildOptimization(FAKE, EVAL_START_MS + EVAL_STEP_MS + 10))
  renderOptimization('opt_x')
  expect(await screen.findByText('후보 평가 중')).toBeTruthy()
  expect(screen.getByText('1 / 5개')).toBeTruthy()
  expect(card('C0').getByText('평가 완료')).toBeTruthy()
  expect(card('C0').getByText('12.0%')).toBeTruthy()
  expect(card('C1').getByText('평가 중')).toBeTruthy()
  expect(card('C2').getByText('평가 대기')).toBeTruthy()
})

it('EVALUATED: 추천·검증 후보와 선정 사유를 보이고 검증 시작 버튼을 켠다', async () => {
  serve(seeded('opt_mock_evaluated'))
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getAllByText('주문·환불', { selector: 'dd' })).toHaveLength(2)
  expect(within(panel).getByText('대상 메뉴 확률이 가장 높은 후보')).toBeTruthy()
  expectNoCodes('TOP_TARGET_PROBABILITY', 'SELECTED', 'RECOMMENDED', 'opt_mock_evaluated', 'Optimizer', 'MOCK')
  // 후보 ID는 카드의 data 속성에만 있고 글자로는 보이지 않는다
  expect(card('C2').queryByText('C2')).toBeNull()
  expect(card('C2').getByText('62.0%')).toBeTruthy()
  expect(card('C2').getByText('88.0%')).toBeTruthy()
  expect(card('C2').getByText('추천 후보')).toBeTruthy()
  expect(card('C2').getByText('검증 후보')).toBeTruthy()
  expect((screen.getByRole('button', { name: '검증 시작' }) as HTMLButtonElement).disabled).toBe(false)
})

it('추천 후보와 검증 후보가 다르면 각각 구분해 보인다', async () => {
  const dto = seeded('opt_mock_evaluated')
  dto.recommendedCandidateId = 'C3'
  dto.selection = { ...dto.selection!, recommendedCandidateId: 'C3' }
  serve(dto)
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getByText('주문·반품', { selector: 'dd' })).toBeTruthy()
  expect(within(panel).getByText('주문·환불', { selector: 'dd' })).toBeTruthy()
  expect(within(panel).getByText(/검증 후보는 전체 적격 후보 중 1위/)).toBeTruthy()
  expect(card('C3').getByText('추천 후보')).toBeTruthy()
  expect(card('C3').queryByText('검증 후보')).toBeNull()
  expect(card('C2').getByText('검증 후보')).toBeTruthy()
  expect(card('C2').queryByText('추천 후보')).toBeNull()
})

it('추천 후보가 없으면 추천 기준 안내를 보이고 알려진 사유 코드는 풀이를 붙인다', async () => {
  const dto = seeded('opt_mock_evaluated')
  dto.recommendedCandidateId = null
  dto.recommendationStatus = 'NO_RECOMMENDATION'
  dto.selection = { ...dto.selection!, recommendedCandidateId: null, recommendationStatus: 'NO_RECOMMENDATION', selectionReasonCode: 'TIE_BREAK' }
  serve(dto)
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getByText(/추천 기준\(\+5%p\)을 넘은 후보가 없어/)).toBeTruthy()
  expect(within(panel).queryByText(/추천 후보와 다를 수 있습니다/)).toBeNull()
  expect(within(panel).getByText('동률이라 의미가 더 분명한 이름을 선정')).toBeTruthy()
  expectNoCodes('TIE_BREAK', 'NO_RECOMMENDATION')
})

it('후보 FAILED·SKIPPED는 사유를, 제외된 후보는 이유를 문구로 보인다', async () => {
  serve(seeded('opt_mock_partial'))
  renderOptimization('opt_mock_partial')
  await screen.findByRole('region', { name: '선정 결과' })
  expect(card('C3').getByText('평가 실패')).toBeTruthy()
  expect(card('C3').getByText('후보 화면을 열지 못했습니다.')).toBeTruthy()
  expect(card('C3').queryByText(/%/)).toBeNull()
  expect(card('C4').getByText('평가 제외')).toBeTruthy()
  expect(card('C4').getByText('후보 화면이 준비되지 않음')).toBeTruthy()
  const excluded = within(screen.getByRole('list', { name: '제외된 후보' }))
  expect(excluded.getByText('주문·반품')).toBeTruthy()
  expect(excluded.getAllByText('평가를 마치지 못함')).toHaveLength(2)
  expect(excluded.getByText('후보 화면을 열지 못함')).toBeTruthy()
  expectNoCodes('BROWSER_ERROR', 'SITE_INSTANCE_MISSING', 'EVALUATION_NOT_COMPLETED', '오류 코드')
})

it('null 지표는 0이 아니라 계산 불가와 사유로 보인다', async () => {
  const dto = seeded('opt_mock_evaluated')
  dto.evaluations = dto.evaluations.map((e) =>
    e.candidateId === 'C1'
      ? {
          ...e,
          targetOptionProbability: null,
          goalPathProbability: 0.55,
          metricNullReasons: { targetOptionProbability: 'TARGET_OPTION_NOT_FOUND' },
        }
      : e,
  )
  serve(dto)
  renderOptimization('opt_mock_evaluated')
  await screen.findByRole('region', { name: '선정 결과' })
  const c1 = card('C1')
  expect(c1.getByText(/계산 불가/)).toBeTruthy()
  // 모르는 사유 코드는 원문 대신 "확인 필요"다
  expect(c1.getByText(/확인 필요/)).toBeTruthy()
  expectNoCodes('TARGET_OPTION_NOT_FOUND')
  expect(c1.getByText('55.0%')).toBeTruthy()
  expect(c1.queryByText('0.0%')).toBeNull()
  expect(c1.queryByText('0%')).toBeNull()
})

it('VERIFYING: 검증 단계를 한글로 보이고 선택 확률 안내 문구를 둔다', async () => {
  const dto = seeded('opt_mock_evaluated')
  dto.status = 'VERIFYING'
  dto.verificationPhase = 'BASELINE'
  dto.baselineRunId = 'run_base'
  serve(dto)
  renderOptimization('opt_mock_evaluated')
  expect(await screen.findByText('후보 검증 중 · 기준 실행')).toBeTruthy()
  expect(screen.queryByText(/BASELINE/)).toBeNull()
  expect(screen.getByText('모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다')).toBeTruthy()
})

it('FAILED이고 후보 목록이 비면 불러오는 중이 아니라 목록 없음을 보인다', async () => {
  const dto = seeded('opt_mock_interrupted')
  dto.candidateLabels = []
  dto.evaluations = []
  serve(dto)
  renderOptimization('opt_mock_interrupted')
  expect(await screen.findByText('후보 목록 없음')).toBeTruthy()
  expect(screen.queryByText('후보 목록을 불러오는 중')).toBeNull()
})

it('NOT_SELECTABLE: 검증 후보가 없으면 그렇게 보이고 검증 시작 버튼이 없다', async () => {
  const rec = { ...FAKE, scenario: 'not-selectable' } as const
  serve(buildOptimization(rec, FAR_FUTURE))
  renderOptimization('opt_x')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getByText('선정할 수 있는 후보 없음')).toBeTruthy()
  expect(within(panel).getByText('조건에 맞는 후보 없음')).toBeTruthy()
  expectNoCodes('NO_VALID_CANDIDATE', 'NOT_SELECTABLE')
  expect(within(panel).getByText('검증할 후보가 없어 검증을 시작할 수 없습니다.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '검증 시작' })).toBeNull()
})

// ---- 실패 ----

it('FAILED(평가 단계): 실패 원인·단계·직전 상태를 문구로 보이고 평가하지 못한 후보를 구분한다', async () => {
  serve(seeded('opt_mock_eval_timeout'))
  renderOptimization('opt_mock_eval_timeout')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('모델 응답이 제한 시간을 넘겨 후보 평가를 멈췄습니다.')
  expect(alert.textContent).not.toContain('MODEL_TIMEOUT')
  expect(alert.textContent).not.toContain('오류 코드')
  expect(alert.textContent).toContain('실패 단계 후보 평가')
  expect(alert.textContent).toContain('직전 상태 후보 평가 중')
  expect(card('C2').getByText('평가 실패')).toBeTruthy()
  expect(card('C3').getByText('평가하지 못함')).toBeTruthy()
  expect(card('C4').getByText('평가하지 못함')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '선정 결과' })).toBeNull()
})

it('FAILED(검증 단계): 선정 결과는 그대로 두고 실패를 보인다', async () => {
  serve(seeded('opt_mock_site_changed'))
  renderOptimization('opt_mock_site_changed')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('평가한 뒤 후보 사이트가 바뀌어 검증을 시작하지 못했습니다.')
  expect(alert.textContent).toContain('실패 단계 후보 검증')
  expect(screen.getByRole('region', { name: '선정 결과' })).toBeTruthy()
})

it('OPTIMIZATION_INTERRUPTED: 다시 시작하도록 안내하고 시작 화면으로 연결한다', async () => {
  serve(seeded('opt_mock_interrupted'))
  renderOptimization('opt_mock_interrupted')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('서버가 다시 시작되어 진행이 중단되었습니다.')
  fireEvent.click(within(alert).getByRole('link', { name: /다시 시작/ }))
  expect(await screen.findByText('시작 화면')).toBeTruthy()
})

it('BASELINE_INVALID: 기준 화면 평가를 하지 않았다는 점을 후보 카드와 실패 안내에 보인다', async () => {
  const dto = buildOptimization(FAKE, EVAL_START_MS + EVAL_STEP_MS + 10)
  dto.status = 'FAILED'
  dto.error = {
    code: 'BASELINE_INVALID',
    message: 'baseline invalid',
    retryable: false,
    details: null,
    occurredAt: '2026-11-19T00:00:00Z',
    failedPhase: 'EVALUATING',
    lastStatus: 'EVALUATING',
  }
  dto.evaluations = [
    {
      ...dto.evaluations[0],
      siteInstanceId: null,
      candidateValidity: 'INVALID_CANDIDATE',
      invalidReasons: ['BASELINE_LABEL_MISMATCH'],
      evaluationStatus: 'SKIPPED',
      probabilities: null,
      targetOptionProbability: null,
      goalPathProbability: null,
    },
  ]
  serve(dto)
  renderOptimization('opt_x')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('기준 화면이 후보 평가 설정과 달라 평가를 멈췄습니다.')
  expect(card('C0').getByText('기준 화면이 평가 설정과 달라 모델 평가를 하지 않았습니다.')).toBeTruthy()
  expect(card('C0').getByText('확인 필요')).toBeTruthy()
  expectNoCodes('BASELINE_LABEL_MISMATCH', 'BASELINE_INVALID')
  expect(card('C1').getByText('평가하지 못함')).toBeTruthy()
})

it('모르는 상태·이유 코드가 와도 화면이 깨지지 않고 원문 대신 확인 필요로 보인다', async () => {
  const dto = seeded('opt_mock_partial')
  dto.status = 'SOMETHING_NEW'
  dto.selection = {
    ...dto.selection!,
    selectionReasonCode: 'NEW_SELECTION_REASON',
    selectionStatus: 'NEW_SELECTION_STATUS',
    excludedCandidates: [{ candidateId: 'C9', reasonCodes: ['NEW_EXCLUDE_REASON'] }],
  }
  dto.recommendationStatus = 'NEW_RECOMMENDATION'
  dto.evaluations = dto.evaluations.map((e) =>
    e.candidateId === 'C3'
      ? { ...e, evaluationStatus: 'PAUSED', error: { code: 'NEW_ERROR', message: '', retryable: false, occurredAt: null } }
      : e,
  )
  serve(dto)
  renderOptimization('opt_mock_partial')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getAllByText('확인 필요').length).toBe(4)
  expect(within(panel).getByText('알 수 없는 후보')).toBeTruthy()
  expect(card('C3').getByText('확인 필요')).toBeTruthy()
  expect(card('C3').getByText('이 후보를 평가하지 못했습니다.')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('확인 필요')
  expectNoCodes('NEW_SELECTION_REASON', 'NEW_SELECTION_STATUS', 'NEW_RECOMMENDATION', 'NEW_EXCLUDE_REASON', 'C9', 'PAUSED', 'NEW_ERROR', 'SOMETHING_NEW')
})

// ---- 주소 재진입·오류 ----

it('같은 주소로 다시 열면 같은 Optimization을 보인다', async () => {
  serve(seeded('opt_mock_evaluated'))
  const first = renderOptimization('opt_mock_evaluated')
  await screen.findByRole('region', { name: '선정 결과' })
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('후보 비교 결과')
  first.unmount()
  renderOptimization('opt_mock_evaluated')
  expect(await screen.findByRole('region', { name: '선정 결과' })).toBeTruthy()
  expectNoCodes('opt_mock_evaluated')
  expect(card('C2').getByText('62.0%')).toBeTruthy()
})

it('없는 Optimization 주소는 찾을 수 없음을 안내한다', async () => {
  renderOptimization('opt_missing')
  expect(await screen.findByText('후보 평가를 찾을 수 없음')).toBeTruthy()
})

it('엔진 상태의 후보 비교 표시는 진행 중인 후보 평가 화면으로 연결된다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'EVALUATING' })
  render(
    <MemoryRouter>
      <EngineStatus />
    </MemoryRouter>,
  )
  expect(await screen.findByText('후보 비교 중')).toBeTruthy()
  const link = screen.getByRole('link', { name: '보기' })
  expect(link.getAttribute('href')).toBe('/optimizations/opt_mock_1')
})
