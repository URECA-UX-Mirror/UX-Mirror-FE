import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { HealthDto } from '../src/api/dto/index.ts'
import { NO_SITE_MAP_NOTICE } from '../src/features/scenario/constants.ts'
import { ScenarioPage } from '../src/features/scenario/ScenarioPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

const CAFE24_LINK = 'https://ecudemo360127.cafe24.com'
const UNREGISTERED = '아직 등록되지 않은 사이트예요. 등록된 사이트의 링크를 넣어 주세요.'
const BAD_LINK = '사이트 링크를 확인해 주세요. 예: https://www.example.com'
const BUSY = '다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.'

const health = (extra: Partial<HealthDto> = {}): HealthDto => ({
  status: 'READY', backend: { ready: true }, model: { ready: true, modelVersion: 'm', endpointId: 'e' },
  browser: { ready: true }, agent: { ready: true }, activeRun: null, checkedAt: '2026-11-19T00:00:00Z', ...extra,
})

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
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

const startButton = () => screen.getByRole('button', { name: '진단 시작' }) as HTMLButtonElement
const linkInput = () => screen.findByLabelText('진단할 사이트 링크') as Promise<HTMLInputElement>
const pageSelect = () => screen.getByLabelText('도착하면 성공인 화면') as HTMLSelectElement

async function enterLink(link = CAFE24_LINK) {
  fireEvent.change(await linkInput(), { target: { value: link } })
}

async function fillAndPick(pageLabel = '제품 목록') {
  await enterLink()
  fireEvent.change(screen.getByLabelText('고객 유형'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  fireEvent.change(screen.getByLabelText('고객이 하려는 일'), { target: { value: '마음에 드는 제품을 담을 화면 찾기' } })
  const option = Array.from(pageSelect().options).find((o) => o.textContent === pageLabel)!
  fireEvent.change(pageSelect(), { target: { value: option.value } })
}

it('링크를 넣기 전에는 등록된 사이트 버튼만 보이고 고객 입력 칸은 없다', async () => {
  renderPage()
  const input = await linkInput()
  expect(input.value).toBe('')
  expect(input.placeholder).toBe(CAFE24_LINK)
  expect(screen.getByText(/등록된 사이트:/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'ONS 공식몰 (cafe24 데모)' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '지도 없는 데모 사이트' })).toBeTruthy()
  expect(screen.queryByLabelText('고객 유형')).toBeNull()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(startButton().disabled).toBe(true)
})

it('등록된 사이트 버튼을 누르면 링크가 채워지고 그 사이트의 goalSelectable 도착 화면만 고를 수 있다', async () => {
  renderPage()
  await linkInput()
  fireEvent.click(screen.getByRole('button', { name: 'ONS 공식몰 (cafe24 데모)' }))
  expect((await linkInput()).value).toBe(CAFE24_LINK)
  expect(screen.getByText('ONS 공식몰 (cafe24 데모)을(를) 진단해요.')).toBeTruthy()
  expect(screen.queryByText(/등록된 사이트:/)).toBeNull()
  expect(Array.from(pageSelect().options).map((o) => o.textContent)).toEqual(['화면을 골라 주세요', '제품 목록', '상품 리뷰', '이벤트', '장바구니'])
  expect(screen.getByText('어떤 고객인가요?')).toBeTruthy()
  expect(screen.getByLabelText('최대 클릭 수')).toBeTruthy()
  expect(screen.queryByText('MORO MARKET')).toBeNull()
  expect(screen.queryByText('시나리오 조건')).toBeNull()
})

it.each([
  ['ecudemo360127.cafe24.com/product/list.html', 'https://를 빼도'],
  ['  HTTP://EcuDemo360127.Cafe24.com/  ', '대문자·공백·http'],
])('링크 %s (%s)도 등록 사이트로 찾는다', async (link) => {
  renderPage()
  await enterLink(link)
  expect(screen.getByText('ONS 공식몰 (cafe24 데모)을(를) 진단해요.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('등록되지 않은 사이트 링크는 안내하고 시작할 수 없다', async () => {
  renderPage()
  await enterLink('https://www.unknown-shop.com/products')
  expect(screen.getByText(UNREGISTERED)).toBeTruthy()
  expect(screen.queryByLabelText('고객 유형')).toBeNull()
  expect(screen.getByText(/등록된 사이트:/)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it.each(['링크 아님 입니다', 'ftp://ecudemo360127.cafe24.com'])('링크 형식이 아니면(%s) 형식 안내를 보인다', async (link) => {
  renderPage()
  await enterLink(link)
  expect(screen.getByText(BAD_LINK)).toBeTruthy()
  expect(screen.queryByText(UNREGISTERED)).toBeNull()
})

it('링크를 바꾸면 고른 도착 화면을 지운다', async () => {
  renderPage()
  await fillAndPick()
  expect(pageSelect().value).toBe('products')
  await enterLink('https://nomap.example.com')
  await enterLink(CAFE24_LINK)
  expect(pageSelect().value).toBe('')
  expect(startButton().disabled).toBe(true)
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
  const where = (await screen.findByTestId('where')).textContent!
  expect(calls).toBe(1)
  expect(body).toMatchObject({
    siteId: 'cafe24-ons', variant: 'before', maxSteps: 8,
    goal: '마음에 드는 제품을 담을 화면 찾기', persona: '쇼핑몰을 처음 쓰는 사용자',
    verification: { path: '/product/list.html', text: '제품' },
  })
  const key = String(body!.experimentKey)
  expect(key).toMatch(/^exp_[0-9a-f]{32}$/)
  expect(where).toBe(`/runs/run_new?experimentKey=${key}`)
})

it('사이트 지도가 없는 사이트를 넣으면 시작 전에 안내한다', async () => {
  renderPage()
  await linkInput()
  expect(screen.queryByText(NO_SITE_MAP_NOTICE)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '지도 없는 데모 사이트' }))
  expect(screen.getByText(NO_SITE_MAP_NOTICE)).toBeTruthy()
  expect(Array.from(pageSelect().options).map((o) => o.textContent)).toEqual(['화면을 골라 주세요', '공지사항'])
})

it('고를 수 있는 도착 화면이 없는 사이트는 안내한다', async () => {
  server.use(http.get(apiUrl('/api/sites'), () => HttpResponse.json({ items: [{
    siteId: 's1', name: '빈 사이트', mode: 'SCENARIO', siteUrl: 'https://empty.example.com', allowedHosts: ['empty.example.com'], startPage: 'home',
    pages: [{ pageKey: 'home', path: '/', label: '홈', goalText: null, goalSelectable: false, goalUnavailableReason: 'START_PAGE' }],
    siteMap: { available: true, siteMapVersion: 'v1', unreachablePages: [] },
  }] })))
  renderPage()
  await enterLink('https://empty.example.com')
  expect(screen.getByText('이 사이트에는 고를 수 있는 화면이 없어요.')).toBeTruthy()
})

it('사이트 목록 조회가 실패하면 다시 시도할 수 있다', async () => {
  server.use(http.get(apiUrl('/api/sites'), () => errorResponse(500, 'STORAGE_ERROR', '서버 오류', true)))
  renderPage()
  expect(await screen.findByText(/사이트 목록을 불러오지 못했어요/)).toBeTruthy()
  server.resetHandlers()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await linkInput()).toBeTruthy()
})

it('사이트 목록이 비면 안내한다', async () => {
  server.use(http.get(apiUrl('/api/sites'), () => HttpResponse.json({ items: [] })))
  renderPage()
  expect(await screen.findByText(/진단할 수 있는 사이트가 아직 없어요/)).toBeTruthy()
  expect(screen.queryByLabelText('진단할 사이트 링크')).toBeNull()
})

it.each([
  ['고객이 하려는 일', '가'.repeat(201), '200자까지 쓸 수 있어요.'],
  ['고객이 하려는 일', '찾기', '조금 더 자세히 적어 주세요. (4자 이상)'],
  ['고객 유형', '!!!! 1234', '기호나 숫자 말고 글로 적어 주세요.'],
  ['고객 유형', 'ㅋㅋㅋㅋㅋㅋ', '알아볼 수 있는 문장으로 적어 주세요.'],
  ['고객이 하려는 일', 'before 화면에서 환불 찾기', '쓸 수 없는 단어가 있어요: before'],
])('%s에 "%s"를 쓰면 안내하고 시작할 수 없다', async (label, value, message) => {
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  expect(screen.getByText(message)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('최대 클릭 수는 1~15 범위에서 +/- 버튼으로 조절되고, 범위 밖이면 시작할 수 없다', async () => {
  renderPage()
  await fillAndPick()
  const steps = screen.getByLabelText('최대 클릭 수') as HTMLInputElement
  expect(steps.value).toBe('8')
  fireEvent.click(screen.getByRole('button', { name: '클릭 수 늘리기' }))
  expect(steps.value).toBe('9')
  fireEvent.change(steps, { target: { value: '15' } })
  expect(screen.getByRole('button', { name: '클릭 수 늘리기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(steps, { target: { value: '1' } })
  expect(screen.getByRole('button', { name: '클릭 수 줄이기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(steps, { target: { value: '16' } })
  expect(screen.getByText('최대 클릭 수는 1~15 사이 숫자로 적어 주세요.')).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('AI 고객이 준비되지 않았으면 시작할 수 없다', async () => {
  server.use(http.get(apiUrl('/api/health'), () => HttpResponse.json(health({ status: 'NOT_READY', model: { ready: false, modelVersion: null, endpointId: null } }))))
  renderPage()
  await fillAndPick()
  expect(await screen.findByText(/AI 고객이 아직 준비 중이에요/)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('다른 진단이 진행 중이면 안내와 진행 화면 링크를 보이고 시작할 수 없다', async () => {
  server.use(http.get(apiUrl('/api/health'), () => HttpResponse.json(health({ activeRun: 'run_busy' }))))
  renderPage()
  await fillAndPick()
  const notice = await screen.findByText(new RegExp(BUSY))
  expect(within(notice).getByRole('link', { name: '보러 가기' }).getAttribute('href')).toBe('/runs/run_busy')
  expect(startButton().disabled).toBe(true)
})

it('시작했는데 409 RUN_ALREADY_ACTIVE면 진행 중 안내를 보인다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(409, 'RUN_ALREADY_ACTIVE', 'Run run_x is active', true)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText(BUSY)).toBeTruthy()
  expect(screen.queryByText('Run run_x is active')).toBeNull()
})

it('422는 서버 message를 그대로 보이고 고쳐서 다시 시작하라고 안내한다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(422, 'CONTRACT_VALIDATION_ERROR', '도착 화면까지 가는 길 없음', false)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText('도착 화면까지 가는 길 없음')).toBeTruthy()
  expect(screen.getByText('고친 뒤 다시 시작해 주세요.')).toBeTruthy()
})

it('503 BROWSER_ERROR는 진단이 시작되지 않았음을 알리고 retryable이면 다시 시도할 수 있다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'BROWSER_ERROR', '도착 화면을 읽지 못했어요', true)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText('도착 화면을 읽지 못했어요')).toBeTruthy()
  expect(screen.getByText('진단은 시작되지 않았어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})

it('재시도할 수 있는 일반 오류는 다시 시도 버튼을 보이고 알림이 중첩되지 않는다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(500, 'STORAGE_ERROR', '서버 오류가 발생했습니다', true)))
  renderPage()
  await fillAndPick()
  await waitFor(() => expect(startButton().disabled).toBe(false))
  fireEvent.click(startButton())
  expect(await screen.findByText('서버 오류가 발생했습니다')).toBeTruthy()
  expect(await screen.findByRole('button', { name: '다시 시도' })).toBeTruthy()
  expect(document.querySelector('[role="alert"] [role="alert"]')).toBeNull()
})
