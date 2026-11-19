import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { OptimizationDto, OptimizationReportDto } from '../src/api/dto/index.ts'
import { OptimizationPage } from '../src/features/optimization/OptimizationPage.tsx'
import {
  buildOptimization,
  buildReport,
} from '../src/mocks/fixtures/optimization.ts'
import { findOptimization, resetMockOptimizations } from '../src/mocks/store.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// 메뉴 이름 후보 비교의 검증 시작·진행·실패·보고서 화면과 후보 비교 확인 실행 구분 표시 (FE #70). 시드와 시나리오는 src/mocks/fixtures/optimization.ts 주석을 따른다.

afterEach(() => resetMockOptimizations())

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')
const seeded = (id: string): OptimizationDto => buildOptimization(findOptimization(id)!, FAR_FUTURE)
const seededReport = (id: string): OptimizationReportDto => buildReport(findOptimization(id)!, FAR_FUTURE)!

/** 화면 글자에 서버 코드값·ID가 보이지 않는다 */
function expectNoCodes(...codes: string[]) {
  const text = document.body.textContent ?? ''
  for (const code of codes) expect(text).not.toContain(code)
}

function serve(dto: OptimizationDto) {
  server.use(http.get(apiUrl(`/api/optimizations/${dto.optimizationId}`), () => HttpResponse.json(dto)))
}

function serveReport(report: OptimizationReportDto) {
  server.use(
    http.get(apiUrl(`/api/optimizations/${report.optimizationId}/report`), () => HttpResponse.json(report)),
  )
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

// ---- 검증 시작 ----

it('검증 시작: 검증 후보와 한 번만 가능함을 알리고 한 번만 요청한다', async () => {
  serve(seeded('opt_mock_evaluated'))
  let calls = 0
  server.use(
    http.post(apiUrl('/api/optimizations/opt_mock_evaluated/verify'), () => {
      calls += 1
      return HttpResponse.json(
        { optimizationId: 'opt_mock_evaluated', status: 'VERIFYING', verificationPhase: 'BASELINE', baselineRunId: null, validationRunId: null },
        { status: 202 },
      )
    }),
  )
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '선정 결과' })
  expect(within(panel).getByText(/검증 후보 "주문·환불" 화면을/)).toBeTruthy()
  expectNoCodes('C0', 'C2')
  expect(within(panel).getByText(/한 번만 시작할 수 있습니다/)).toBeTruthy()
  const button = screen.getByRole('button', { name: '검증 시작' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(await screen.findByRole('button', { name: '검증을 시작했습니다' })).toBeTruthy()
  expect(calls).toBe(1)
})

const START_ERRORS: [number, string, string, string][] = [
  [409, 'OPTIMIZATION_ALREADY_PROCESSED', '', '이미 검증 중이거나 완료된 후보 평가입니다.'],
  [409, 'RUN_ALREADY_ACTIVE', '', '다른 실행이나 후보 평가가 진행 중입니다. 끝난 뒤 다시 시도해 주세요.'],
  [503, 'MODEL_UNAVAILABLE', '', '모델을 사용할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'],
  [422, 'EXPERIMENT_CONDITION_MISMATCH', '', '목표·사용자 유형·모델 설정이 서버에 설정된 값과 달라 진행할 수 없습니다. 설정을 확인한 뒤 다시 시작해 주세요.'],
  [503, 'MODEL_UNAVAILABLE', '서버가 보낸 문구', '서버가 보낸 문구'],
]

for (const [status, code, serverMessage, expected] of START_ERRORS) {
  it(`검증 시작 ${status} ${code}${serverMessage ? '(서버 문구)' : ''}: 이유를 보이고 다시 누를 수 있다`, async () => {
    serve(seeded('opt_mock_evaluated'))
    server.use(
      http.post(apiUrl('/api/optimizations/opt_mock_evaluated/verify'), () =>
        errorResponse(status, code, serverMessage),
      ),
    )
    renderOptimization('opt_mock_evaluated')
    fireEvent.click(await screen.findByRole('button', { name: '검증 시작' }))
    const alert = await screen.findByText(expected)
    expect(alert.getAttribute('role')).toBe('alert')
    await waitFor(() =>
      expect((screen.getByRole('button', { name: '검증 시작' }) as HTMLButtonElement).disabled).toBe(false),
    )
  })
}

// ---- 검증 진행 ----

function verifying(phase: string | null, baseline: string | null, validation: string | null): OptimizationDto {
  return {
    ...seeded('opt_mock_evaluated'),
    status: 'VERIFYING',
    verificationPhase: phase as OptimizationDto['verificationPhase'],
    baselineRunId: baseline,
    validationRunId: validation,
  }
}

it('VERIFYING: Run이 만들어지기 전에는 아직이라 하고 만들어진 Run은 진행 화면으로 잇는다', async () => {
  serve(verifying('CANDIDATE', 'run_base', null))
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '검증 진행' })
  expect(within(panel).getByText('지금 후보 실행을 진행 중입니다.')).toBeTruthy()
  expect(within(panel).getByRole('link', { name: '진행 보기' }).getAttribute('href')).toBe('/runs/run_base')
  expect(within(panel).getByText('아직 만들어지지 않음')).toBeTruthy()
  expectNoCodes('run_base', 'CANDIDATE')
})

it('VERIFYING: 기준 Run을 만들기 전에는 phase가 BASELINE이어도 사이트 확인 중으로 보인다', async () => {
  serve(verifying('BASELINE', null, null))
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '검증 진행' })
  expect(within(panel).getByText('지금 사이트 확인 중입니다.')).toBeTruthy()
  expect(screen.getByText('후보 검증 중 · 사이트 확인 중', { selector: '[role="status"]' })).toBeTruthy()
  expect(within(panel).getByText('기준 실행 ("이용정보")')).toBeTruthy()
})

it('VERIFYING: 기준 실행 이름은 후보 풀의 BASELINE role에서 읽는다', async () => {
  const dto = verifying('BASELINE', 'run_base', null)
  dto.candidateLabels = dto.candidateLabels.map((c) =>
    c.role === 'BASELINE' ? { ...c, candidateId: 'B9', label: '내 주문' } : c,
  )
  serve(dto)
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '검증 진행' })
  expect(within(panel).getByText('기준 실행 ("내 주문")')).toBeTruthy()
  expectNoCodes('B9')
})

it('VERIFYING: 모르는 verificationPhase는 오류 없이 단계 문구만 빼고 원문은 보이지 않는다', async () => {
  serve(verifying('SITE_RECHECK', 'run_base', null))
  renderOptimization('opt_mock_evaluated')
  const panel = await screen.findByRole('region', { name: '검증 진행' })
  expect(screen.getByText('후보 검증 중', { selector: '[role="status"]' })).toBeTruthy()
  expect(within(panel).queryByText(/^지금 /)).toBeNull()
  expectNoCodes('SITE_RECHECK')
})

it('VERIFYING에서 COMPLETED로 바뀌면 보고서가 나타난다', async () => {
  serve(verifying('CANDIDATE', 'run_base', 'run_cand'))
  serveReport(seededReport('opt_mock_completed'))
  renderOptimization('opt_mock_evaluated')
  await screen.findByRole('region', { name: '검증 진행' })
  expect(screen.queryByRole('region', { name: '검증 보고서' })).toBeNull()
  serve({ ...seeded('opt_mock_completed'), optimizationId: 'opt_mock_evaluated' })
  expect(await screen.findByRole('region', { name: '검증 보고서' }, { timeout: 4000 })).toBeTruthy()
  expect(screen.getByText('검증 완료', { selector: '[role="status"]' })).toBeTruthy()
})

// ---- 검증 실패 ----

it('FAILED SITE_INSTANCE_CHANGED: 사이트가 바뀌었고 Run이 만들어지지 않았음을 알린다', async () => {
  serve(seeded('opt_mock_site_changed'))
  renderOptimization('opt_mock_site_changed')
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('평가한 뒤 후보 사이트가 바뀌어 검증을 시작하지 못했습니다.')
  expect(alert.textContent).toContain('실패 단계 후보 검증')
  expectNoCodes('SITE_INSTANCE_CHANGED', '오류 코드')
  const panel = screen.getByRole('region', { name: '검증 진행' })
  expect(within(panel).getByText('검증 전에 멈춰 확인 실행을 하지 않았습니다.')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '검증 보고서' })).toBeNull()
})

const FAILURES: [string, string, string][] = [
  ['SITE_RECHECK_FAILED', '검증 전에 후보 화면을 다시 확인하지 못했습니다.', '검증 전에 멈춰 확인 실행을 하지 않았습니다.'],
  ['SITE_INSTANCE_CHANGED', '평가한 뒤 후보 사이트가 바뀌어 검증을 시작하지 못했습니다.', '검증 전에 멈춰 확인 실행을 하지 않았습니다.'],
]

for (const [code, message, runNote] of FAILURES) {
  it(`FAILED ${code}: 문구와 Run 미생성을 구분한다`, async () => {
    const dto = seeded('opt_mock_site_changed')
    dto.error = { ...dto.error!, code }
    serve(dto)
    renderOptimization('opt_mock_site_changed')
    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(screen.getByText(runNote)).toBeTruthy()
  })
}

it('FAILED RUN_TIMEOUT: 만들어진 Run을 링크로 남긴다', async () => {
  const dto: OptimizationDto = {
    ...seeded('opt_mock_site_changed'),
    baselineRunId: 'run_base',
    validationRunId: null,
  }
  dto.error = { ...dto.error!, code: 'RUN_TIMEOUT', message: '제한 시간 초과' }
  serve(dto)
  renderOptimization('opt_mock_site_changed')
  expect((await screen.findByRole('alert')).textContent).toContain('검증 실행이 제한 시간 안에 끝나지 않았습니다.')
  const panel = screen.getByRole('region', { name: '검증 진행' })
  expect(within(panel).getByRole('link', { name: '진행 보기' }).getAttribute('href')).toBe('/runs/run_base')
  expect(within(panel).queryByText(/확인 실행을 (하지 않았|만들기 전에)/)).toBeNull()
})

it('FAILED OPTIMIZATION_INTERRUPTED(검증 단계): 중단 문구를 보인다', async () => {
  const dto = seeded('opt_mock_site_changed')
  dto.error = { ...dto.error!, code: 'OPTIMIZATION_INTERRUPTED' }
  serve(dto)
  renderOptimization('opt_mock_site_changed')
  expect((await screen.findByRole('alert')).textContent).toContain('서버가 다시 시작되어 진행이 중단되었습니다.')
})

// ---- 보고서 ----

function renderReport(report: OptimizationReportDto) {
  serve({ ...seeded('opt_mock_completed'), optimizationId: report.optimizationId })
  serveReport(report)
  renderOptimization(report.optimizationId)
  return screen.findByRole('region', { name: '검증 보고서' })
}

it('보고서: 판단·이동 비용 변화·두 Run 요약·한계·resultOrigin·비교 링크를 보인다', async () => {
  const report = seededReport('opt_mock_completed')
  const panel = within(await renderReport(report))
  expect(await panel.findByText('미리 정한 개선 조건이 관찰됨')).toBeTruthy()
  expect(panel.getByText('두 실행 모두 목표 화면에 도달해 이동 비용으로 비교')).toBeTruthy()
  expect(panel.getByRole('note').textContent).toContain('기준 1회 · 후보 1회 실행한 결과입니다.')
  expect(panel.getByText('예시 데이터')).toBeTruthy()
  expect(panel.getByRole('link', { name: /지금 화면 vs 개선안 화면/ }).getAttribute('href')).toBe('/comparisons/opt_mock_completed')
  const table = panel.getByRole('table')
  const links = within(table).getAllByRole('link', { name: '결과 보기' }).map((a) => a.getAttribute('href'))
  expect(links).toEqual([`/runs/${report.runs.baseline.runId}/result`, `/runs/${report.runs.candidate.runId}/result`])
  expect(within(table).getByText(/"이용정보" \(기준\)/)).toBeTruthy()
  // 방문 경로는 화면 이름으로 보인다
  const pathCells = within(table).getByRole('rowheader', { name: '방문 경로' }).parentElement!.querySelectorAll('td')
  expect(pathCells[0].textContent).toMatch(/^홈/)
  // 서버 코드·ID·개발자 이름은 화면 어디에도 보이지 않는다
  expectNoCodes('IMPROVEMENT_OBSERVED', 'NAVIGATION_COST', 'MOCK', 'Optimizer', report.runs.baseline.runId, report.runs.candidate.runId, 'opt_mock_completed', 'SUCCESS', 'mock-endpoint', 'selection-v1')
  // 종료 상태는 Run 상태 문구(SUCCESS → 도착함)로 보인다
  const statusCells = within(table).getByRole('rowheader', { name: '종료 상태' }).parentElement!.querySelectorAll('td')
  expect([...statusCells].map((cell) => cell.textContent)).toEqual([
    '도착함',
    '도착함',
  ])
  expect(within(table).getByText(/"주문·환불" \(후보\)/)).toBeTruthy()
})

it('보고서: null 값은 0이 아니라 계산 불가이고 모르는 판단·이유 코드는 확인 필요다', async () => {
  const report = seededReport('opt_mock_completed')
  report.finalDecision = 'SOMETHING_NEW'
  report.verification = { ...report.verification!, finalDecision: 'SOMETHING_NEW', reasonCode: 'NEW_REASON', navigationCostDelta: null }
  report.runs.candidate = { ...report.runs.candidate, navigationCost: null, stepCount: null, executionTimeMs: null, goalReached: null, backCount: null, path: [] }
  const panel = within(await renderReport(report))
  expect(await panel.findByText('이동 비용 변화')).toBeTruthy()
  expect(panel.getByText('최종 판단').nextElementSibling!.textContent).toBe('확인 필요')
  expect(panel.getByText('판단 이유').nextElementSibling!.textContent).toBe('확인 필요')
  expectNoCodes('SOMETHING_NEW', 'NEW_REASON')
  const delta = panel.getByText('이동 비용 변화').nextElementSibling!
  // NAVIGATION_COST가 아닌 이유로 판단했으면 null은 계산 실패가 아니라 쓰지 않는 값이다
  expect(delta.textContent).toBe('해당 없음 (이 판단 이유에서는 이동 비용 변화를 쓰지 않음)')
  for (const row of ['이동 비용', '단계 수', '실행 시간', '목표 화면', '되돌아간 횟수']) {
    const cells = panel.getByRole('rowheader', { name: row }).parentElement!.querySelectorAll('td')
    expect(cells[1].textContent).toBe('계산 불가')
  }
  expect(panel.getByRole('note').textContent).toContain('기준 1회 · 후보 1회')
})

it('보고서: 판단 이유가 NAVIGATION_COST인데 delta가 null이면 계산 불가이고 0이 아니다', async () => {
  const report = seededReport('opt_mock_completed')
  report.verification = { ...report.verification!, reasonCode: 'NAVIGATION_COST', navigationCostDelta: null }
  const panel = within(await renderReport(report))
  expect((await panel.findByText('이동 비용 변화')).nextElementSibling!.textContent).toBe('계산 불가')
})

const KNOWN_DECISIONS: [string, string, string, string][] = [
  ['HOLD', '보류', 'GOAL_REACHED_LOST', '후보에서 목표 화면에 도달하지 못함'],
  ['NEEDS_MORE_EVIDENCE', '근거가 더 필요함', 'BOTH_GOALS_NOT_REACHED', '두 실행 모두 목표 화면에 도달하지 못함'],
  ['INCONCLUSIVE', '판단할 수 없음', 'INVALID_OR_MISSING_RUN_DATA', '실행 데이터가 무효이거나 없음'],
  ['INCONCLUSIVE', '판단할 수 없음', 'RUN_CONDITIONS_MISMATCH_OR_MISSING', '두 실행의 조건이 다르거나 확인할 수 없음'],
  ['IMPROVEMENT_OBSERVED', '미리 정한 개선 조건이 관찰됨', 'GOAL_REACHED_GAINED', '후보에서만 목표 화면에 도달'],
]

for (const [decision, decisionText, reason, reasonText] of KNOWN_DECISIONS) {
  it(`보고서: ${decision}·${reason}는 원문 없이 풀이만 보이고 이동 비용 변화는 해당 없음이다`, async () => {
    const report = seededReport('opt_mock_completed')
    report.finalDecision = decision
    report.verification = { ...report.verification!, finalDecision: decision, reasonCode: reason, navigationCostDelta: null }
    const panel = within(await renderReport(report))
    expect(await panel.findByText(decisionText)).toBeTruthy()
    expect(panel.getByText(reasonText)).toBeTruthy()
    expectNoCodes(decision, reason)
    expect(panel.getByText('이동 비용 변화').nextElementSibling!.textContent).toMatch(/^해당 없음/)
  })
}

it('보고서: 비교 조건은 접혀 있고 펼치면 목표·사용자 유형을 보인다 (정책·모델 버전 같은 개발 정보는 없다)', async () => {
  const report = seededReport('opt_mock_completed')
  const panel = within(await renderReport(report))
  const details = (await panel.findByText('비교 조건')).closest('details')!
  expect(details.open).toBe(false)
  expect(within(details).getByText(report.frozenConditions.goal)).toBeTruthy()
  expect(within(details).queryByText('모델 엔드포인트')).toBeNull()
  expect(within(details).queryByText('selection-v1')).toBeNull()
})

it('보고서 조회가 실패하면 이유를 보이고 다시 시도할 수 있다', async () => {
  serve(seeded('opt_mock_completed'))
  server.use(
    http.get(apiUrl('/api/optimizations/opt_mock_completed/report'), () =>
      errorResponse(409, 'OPTIMIZATION_NOT_READY', '', false),
    ),
  )
  renderOptimization('opt_mock_completed')
  expect(await screen.findByText('아직 이 작업을 할 수 없는 단계입니다.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})

// ---- 후보 비교 확인 실행 구분 ----



it('진단 화면: 후보 비교 확인 진단은 바꿔 본 메뉴 이름을, 일반 진단은 쇼핑몰 이름만 보인다', async () => {
  const { RunPage } = await import('../src/features/run-result/RunPage.tsx')
  const view = (runId: string) =>
    render(<MemoryRouter initialEntries={[`/runs/${runId}`]}><Routes><Route path="/runs/:runId" element={<RunPage />} /></Routes></MemoryRouter>)
  const optimizerRun = view('run_opt_mock_completed_candidate')
  expect(await screen.findByText(/메뉴 이름을 '주문·환불'로 바꿔 본 화면/, {}, { timeout: 3000 })).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/Optimizer|run_opt|C2/)
  optimizerRun.unmount()
  view('run_mock_done_before')
  expect(await screen.findByText(/^MORO MARKET · 찾을 화면/, {}, { timeout: 3000 })).toBeTruthy()
  expect(screen.queryByText(/바꿔 본 화면/)).toBeNull()
})

const IMPROVEMENT_CONTEXT = { improvementId: 'imp-1119b', goalId: 'S1', label: '주문 환불', siteInstanceId: 'site-final', executionRole: 'CANDIDATE' }

it('Run 변환: improvementContext가 있으면 읽고 없거나 형식이 다르면 일반 Run이다', async () => {
  const { toRun } = await import('../src/adapters/run.ts')
  const base = (await (await fetch(apiUrl('/api/runs/run_mock_done_before'))).json()) as Parameters<typeof toRun>[0]
  expect(toRun(base).improvementContext).toBeNull()
  expect(toRun({ ...base, improvementContext: IMPROVEMENT_CONTEXT }).improvementContext).toEqual(IMPROVEMENT_CONTEXT)
  expect(toRun({ ...base, improvementContext: { ...IMPROVEMENT_CONTEXT, label: 1 as unknown as string } }).improvementContext).toBeNull()
})

it('진단 화면: AI 개선 확인 진단은 고정 문구 대신 바꿔 본 이름을 보인다', async () => {
  const runDto = async (runId: string) => (await (await fetch(apiUrl(`/api/runs/${runId}`))).json()) as Record<string, unknown>
  const after = { ...(await runDto('run_mock_done_before')), variant: 'after', improvementContext: IMPROVEMENT_CONTEXT }
  server.use(http.get(apiUrl('/api/runs/run_mock_done_before'), () => HttpResponse.json(after)))
  const { RunPage } = await import('../src/features/run-result/RunPage.tsx')
  render(<MemoryRouter initialEntries={['/runs/run_mock_done_before']}><Routes><Route path="/runs/:runId" element={<RunPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/메뉴 이름을 '주문 환불'로 바꿔 본 화면/, {}, { timeout: 3000 })).toBeTruthy()
  expect(screen.queryByText(/상단 메뉴 '/)).toBeNull()
  expect(document.body.textContent).not.toContain('imp-1119b')
})
