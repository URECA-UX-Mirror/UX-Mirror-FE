import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import { toRun } from '../src/adapters/run.ts'
import { toStepList } from '../src/adapters/step.ts'
import { apiUrl } from '../src/api/client.ts'
import type { Run, Step } from '../src/domain/types.ts'
import { DiagnosisCard } from '../src/features/run-result/DiagnosisCard.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import { findRun } from '../src/mocks/store.ts'
import { server } from './setup.ts'

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

function runOf(runId: string): Run {
  return toRun(buildRun(findRun(runId)!, FAR_FUTURE))
}
function stepsOf(runId: string): Step[] {
  const rec = findRun(runId)!
  const items = buildSteps(rec, 10)
  return toStepList({ runId, count: items.length, items })
}

/** 첫 화면 후보를 정해진 확률로 바꾼 Step 목록 */
function withFirstCandidates(steps: Step[], probs: [string, string, number][]): Step[] {
  const [first, ...rest] = steps
  const base = first.candidates[0]
  const candidates = probs.map(([label, href, probability], i) => ({
    ...base, optionId: `o${i}`, label, href, semanticKey: `상단 메뉴>${href}#1`, probability, selected: i === 0,
  }))
  return [{ ...first, candidates }, ...rest]
}

function Where() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderCard(run: Run, steps: Step[] | null) {
  return render(
    <MemoryRouter initialEntries={['/runs/x/result']}>
      <Routes>
        <Route path="/runs/x/result" element={<DiagnosisCard run={run} steps={steps} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('도착한 진단은 몇 번 만에 어느 화면에 도착했는지 한 줄로 보인다', () => {
  const run = runOf('run_mock_direct_before')
  renderCard(run, stepsOf('run_mock_direct_before'))
  const card = screen.getByRole('region', { name: '진단 요약' })
  expect(card.getAttribute('data-reached')).toBe('yes')
  expect(card.textContent).toContain(`${run.summary!.stepCount}번 만에 주문·배송 조회 화면에 도착했어요.`)
  expect(card.querySelector('.diagnosis-reason')).toBeNull()
})

it('도착하지 못한 진단은 찾지 못했다는 결론과 멈춘 이유를 사용자 문구로 보인다', () => {
  const run = runOf('run_mock_maxsteps')
  renderCard(run, stepsOf('run_mock_maxsteps'))
  const card = screen.getByRole('region', { name: '진단 요약' })
  expect(card.getAttribute('data-reached')).toBe('no')
  expect(card.textContent).toContain('환불 신청 화면을 찾지 못했어요.')
  expect(card.querySelector('.diagnosis-reason')?.textContent).toBe('정해진 클릭 수 안에 찾지 못했어요')
  expect(card.textContent).not.toMatch(/MAX_STEPS/)
})

it('첫 화면 후보는 확률이 높은 4개만 높은 순으로 막대와 퍼센트로 보인다', () => {
  const steps = withFirstCandidates(stepsOf('run_mock_maxsteps'), [
    ['고객센터', '/shop/support', 0.05],
    ['이용정보', '/shop/orders', 0.1],
    ['마이페이지', '/shop/mypage', 0.4],
    ['이벤트', '/shop/event', 0.02],
    ['쿠폰', '/shop/coupon', 0.43],
  ])
  renderCard(runOf('run_mock_maxsteps'), steps)
  const items = screen.getAllByRole('listitem')
  expect(items.map((li) => li.querySelector('.choice-label')?.textContent)).toEqual(['쿠폰', '마이페이지', '이용정보', '고객센터'])
  expect(items.map((li) => li.querySelector('.choice-value')?.textContent)).toEqual(['43%', '40%', '10%', '5%'])
  expect((items[0].querySelector('.choice-bar') as HTMLElement).style.width).toBe('43%')
  expect(within(items[0]).getByText('가장 많이 골랐어요')).toBeTruthy()
  // AI가 바꿀 수 있는 메뉴(주문 화면으로 가는 버튼)를 표시하고 누를 가능성을 알려 준다
  expect(items[2].getAttribute('data-editable')).toBe('yes')
  expect(screen.getByText(/"이용정보"을\(를\) 누를 가능성은 10%예요/)).toBeTruthy()
})

it('"AI에게 고쳐 달라고 하기"는 진단 Run ID로 AI 개선을 시작하고 그 화면으로 이동한다', async () => {
  let body: unknown = null
  server.use(
    http.post(apiUrl('/api/improvements'), async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({
        improvementId: 'imp_new', status: 'QUEUED', phase: 'QUEUED', createdAt: null, startedAt: null,
        finishedAt: null, error: null, improvement: null,
      }, { status: 202 })
    }),
  )
  renderCard(runOf('run_mock_maxsteps'), stepsOf('run_mock_maxsteps'))
  fireEvent.click(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' }))
  expect((await screen.findByTestId('location')).textContent).toBe('/improvements/imp_new')
  expect(body).toEqual({ sourceRunId: 'run_mock_maxsteps' })
})

it('AI 개선 시작이 409이면 다른 작업 진행 중, 503이면 서버 문구를 보이고 화면에 머문다', async () => {
  server.use(http.post(apiUrl('/api/improvements'), () => errorResponse(409, 'RUN_ALREADY_ACTIVE', 'active')))
  const view = renderCard(runOf('run_mock_maxsteps'), null)
  fireEvent.click(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' }))
  expect((await screen.findByRole('alert')).textContent).toBe('지금 다른 진단이나 AI 개선이 진행 중이에요. 끝나면 시작할 수 있어요.')
  view.unmount()

  server.resetHandlers()   // 기본 MOCK 응답: 503 IMPROVEMENTS_DISABLED
  renderCard(runOf('run_mock_maxsteps'), null)
  fireEvent.click(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' }))
  expect((await screen.findByRole('alert')).textContent).toBe('예시 데이터 모드에서는 AI 개선을 시작할 수 없어요.')
  expect(screen.queryByTestId('location')).toBeNull()
  expect(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toHaveProperty('disabled', false)
})

it('개선안 화면 진단 버튼과 비교·진행 링크는 진단 결과에 없다 (고정 개선안 사이트는 AI가 고른 이름과 다를 수 있다)', () => {
  renderCard(runOf('run_mock_direct_before'), null)
  expect(screen.queryByRole('button', { name: /개선안 화면으로도/ })).toBeNull()
  expect(screen.queryByRole('link', { name: /개선안/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeTruthy()
})

it.each<[string, Partial<Run>]>([
  ['진행 중인 진단', { status: 'RUNNING', validity: null }],
  ['결과로 쓸 수 없는 진단', { validity: 'INVALID' }],
  ['검증 전 진단', { validity: null }],
  ['개선안(after) 화면 진단', { variant: 'after' }],
  ['다른 사이트 진단', { siteId: 'site_x' }],
  ['후보 비교 확인 실행', { optimizationContext: { optimizationId: 'opt_1', candidateId: 'C2', label: '주문·환불', executionRole: 'CANDIDATE' } as Run['optimizationContext'] }],
  ['AI 개선 확인 실행', { improvementContext: {} as Run['improvementContext'] }],
])('%s에는 "AI에게 고쳐 달라고 하기"를 보이지 않는다', (_name, patch) => {
  renderCard({ ...runOf('run_mock_maxsteps'), ...patch }, stepsOf('run_mock_maxsteps'))
  expect(screen.queryByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeNull()
  expect(screen.queryByText(/AI가 이 메뉴 이름을 바꿔 볼 수 있어요/)).toBeNull()
})

it('목표에 못 가고 멈춘(MAX_STEPS·BLOCKED) 유효한 진단도 AI 개선을 시작할 수 있다', () => {
  for (const status of ['MAX_STEPS', 'BLOCKED']) {
    const view = renderCard({ ...runOf('run_mock_maxsteps'), status, validity: 'VALID' }, null)
    expect(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeTruthy()
    view.unmount()
  }
})

it.each<[string, Partial<Run>]>([
  ['무효 처리된 진단', { validity: 'INVALID', status: 'ERROR', terminationReason: 'BROWSER_ERROR' }],
  ['오류로 끝난 진단', { status: 'ERROR', terminationReason: 'PAGE_LOAD_FAILED' }],
  ['도달 여부가 없는 진단', { summary: null }],
])('%s은 "찾지 못했어요"가 아니라 진단을 끝내지 못했다고 보인다', (_name, over) => {
  const base = runOf('run_mock_maxsteps')
  const run = { ...base, ...over } as Run
  const { container } = renderCard(run, null)
  const card = screen.getByRole('region', { name: '진단 요약' })
  expect(card.textContent).toContain('진단을 끝내지 못했어요.')
  expect(card.textContent).toContain('같은 조건으로 다시 진단해 주세요.')
  expect(card.querySelector('.diagnosis-headline')?.textContent).toBe('진단을 끝내지 못했어요.')
  expect(container.querySelector('[data-reached="unfinished"]')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeNull()
})

it('정상으로 탐색했지만 목표에 못 간 진단만 "찾지 못했어요"라고 보인다', () => {
  renderCard(runOf('run_mock_maxsteps'), null)
  const card = screen.getByRole('region', { name: '진단 요약' })
  expect(card.textContent).toContain('화면을 찾지 못했어요.')
  expect(card.textContent).not.toContain('진단을 끝내지 못했어요')
})
