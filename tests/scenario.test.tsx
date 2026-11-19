import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { ScenarioPage } from '../src/features/scenario/ScenarioPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/scenario']}>
      <Routes>
        <Route path="/scenario" element={<ScenarioPage />} />
        <Route path="/runs/:runId" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

const startButton = () => screen.getByRole('button', { name: '시나리오 시작' }) as HTMLButtonElement

async function fillAndPick(pageLabel = '제품 목록') {
  await screen.findByLabelText('사이트 선택')
  fireEvent.change(screen.getByLabelText('상황 문장'), { target: { value: '마음에 드는 제품을 담을 화면 찾기' } })
  fireEvent.change(screen.getByLabelText('사용자 유형 문장'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  const select = screen.getByLabelText('도착 화면') as HTMLSelectElement
  const option = Array.from(select.options).find((o) => o.textContent === pageLabel)!
  fireEvent.change(select, { target: { value: option.value } })
}

it('등록 사이트와 goalSelectable 도착 화면만 보이고 주소 입력 칸이 없다', async () => {
  renderPage()
  await screen.findByLabelText('사이트 선택')
  const labels = Array.from((screen.getByLabelText('도착 화면') as HTMLSelectElement).options).map((o) => o.textContent)
  expect(labels).toEqual(['도착 화면을 선택해 주세요', '제품 목록', '상품 리뷰', '이벤트', '장바구니'])
  expect(screen.queryByLabelText(/주소|URL/i)).toBeNull()
  expect(screen.queryByText('MORO MARKET')).toBeNull()
})

it('입력을 마치면 siteId·도착 화면 path·goalText를 실어 한 번 시작하고 진행 화면으로 이동한다', async () => {
  let body: Record<string, unknown> | null = null
  let calls = 0
  server.use(http.post(apiUrl('/api/runs'), async ({ request }) => {
    calls += 1
    body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ runId: 'run_new', experimentKey: body.experimentKey, variant: 'before', status: 'READY', maxSteps: 8, createdAt: '2026-11-19T00:00:00Z' }, { status: 201 })
  }))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect((await screen.findByTestId('where')).textContent).toBe('/runs/run_new')
  expect(calls).toBe(1)
  expect(body).toMatchObject({ siteId: 'cafe24-ons', variant: 'before', verification: { path: '/product/list.html', text: '제품' } })
  expect(String(body!.experimentKey)).toMatch(/^exp_/)
})

it('사이트 지도가 없는 사이트를 고르면 시작 전에 안내한다', async () => {
  renderPage()
  const select = (await screen.findByLabelText('사이트 선택')) as HTMLSelectElement
  expect(screen.queryByText(/사이트 지도가 없어/)).toBeNull()
  fireEvent.change(select, { target: { value: 'demo-no-map' } })
  expect(screen.getByText('이 사이트는 사이트 지도가 없어 경로 지표를 계산하지 않습니다')).toBeTruthy()
})

it('사이트 목록 조회가 실패하면 다시 시도할 수 있다', async () => {
  server.use(http.get(apiUrl('/api/sites'), () => errorResponse(500, 'STORAGE_ERROR', '서버 오류', true)))
  renderPage()
  expect(await screen.findByText(/사이트 목록을 불러오지 못했습니다/)).toBeTruthy()
  server.resetHandlers()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByLabelText('사이트 선택')).toBeTruthy()
})

it('사이트 목록이 비면 안내한다', async () => {
  server.use(http.get(apiUrl('/api/sites'), () => HttpResponse.json({ items: [] })))
  renderPage()
  expect(await screen.findByText(/쓸 수 있는 사이트가 없습니다/)).toBeTruthy()
})

it('상황 문장·사용자 유형이 200자를 넘으면 시작할 수 없다', async () => {
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('상황 문장'), { target: { value: '가'.repeat(201) } })
  expect(screen.getByText(/200자 이하/)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('엔진이 READY가 아니면 시작할 수 없다', async () => {
  server.use(http.get(apiUrl('/api/health'), () => HttpResponse.json({ status: 'NOT_READY', backend: { ready: true }, model: { ready: false, modelVersion: null, endpointId: null }, browser: { ready: true }, agent: { ready: true }, activeRun: null, checkedAt: '2026-11-19T00:00:00Z' })))
  renderPage()
  await fillAndPick()
  expect(await screen.findByText(/엔진이 준비되지 않아/)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('422는 서버 message를 그대로 보인다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(422, 'CONTRACT_VALIDATION_ERROR', '도착 화면까지 가는 길 없음', false)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText('도착 화면까지 가는 길 없음')).toBeTruthy()
})

it('503 BROWSER_ERROR는 Run이 생성되지 않았음을 알리고 retryable이면 다시 시도할 수 있다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'BROWSER_ERROR', '도착 화면을 읽지 못했습니다', true)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText('도착 화면을 읽지 못했습니다')).toBeTruthy()
  expect(screen.getByText('Run은 생성되지 않았습니다.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})
