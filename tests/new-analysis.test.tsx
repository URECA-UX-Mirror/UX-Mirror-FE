import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { HealthDto } from '../src/api/dto/index.ts'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { GOAL_SCREENS, PERSONA_CHOICES } from '../src/shared/customerInput.ts'
import { server } from './setup.ts'

const BUSY = '다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.'
const GOAL = '지난주에 산 운동화를 돌려보내고 싶어요'

const health = (extra: Partial<HealthDto> = {}): HealthDto => ({
  status: 'READY', backend: { ready: true }, model: { ready: true, modelVersion: 'm', endpointId: 'e' },
  browser: { ready: true }, agent: { ready: true }, activeRun: null, checkedAt: '2026-11-19T00:00:00Z', ...extra,
})
const serveHealth = (extra: Partial<HealthDto> = {}) => server.use(http.get(apiUrl('/api/health'), () => HttpResponse.json(health(extra))))

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<NewAnalysisPage />} />
        <Route path="/runs/:runId" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** createRun 요청을 받아 둔다 */
function captureRuns() {
  const bodies: Record<string, unknown>[] = []
  server.use(http.post(apiUrl('/api/runs'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    bodies.push(body)
    return HttpResponse.json({ runId: 'run_new', experimentKey: body.experimentKey, variant: 'before', status: 'READY', maxSteps: 8, createdAt: '2026-11-19T00:00:00Z' }, { status: 201 })
  }))
  return bodies
}

const startButton = () => screen.getByRole('button', { name: '진단 시작' }) as HTMLButtonElement
// 안내 문구가 label 안에 붙으므로 앞부분으로 찾는다
const goalInput = () => screen.getByLabelText(/^무엇을 하려고/) as HTMLInputElement
const pageSelect = () => screen.getByLabelText(/^어느 화면을 찾아야 하나요/) as HTMLSelectElement
const chip = (name: string) => screen.getByRole('button', { name })
const typeGoal = (value: string) => fireEvent.change(goalInput(), { target: { value } })

/** 엔진 상태를 읽을 때까지 기다린다 (READY 전에는 시작 버튼이 열려 있어도 결과가 달라질 수 있다) */
const settle = () => waitFor(() => expect(startButton().disabled).toBe(false))

it('세 칸(고객·하려는 일·도착 화면)만 받고 개발자용 입력은 없다', async () => {
  renderPage()
  expect(screen.getByRole('region', { name: '진단하기' })).toBeTruthy()
  expect(screen.getByRole('group', { name: '누가' })).toBeTruthy()
  expect(goalInput().value).toBe('')
  expect(Array.from(pageSelect().options).map((o) => o.textContent)).toEqual(GOAL_SCREENS.map((s) => s.label))
  expect(pageSelect().value).toBe('refund')
  expect(screen.queryByLabelText(/실험 키|최대 탐색 횟수|성공 조건|분석 사이트/)).toBeNull()
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.getByText('MORO MARKET(시연용 쇼핑몰)에서 진단해요.')).toBeTruthy()
  // 메뉴에서 뺀 화면으로 가는 링크는 두지 않는다
  expect(screen.queryByRole('link')).toBeNull()
  await settle()
})

it('고객 유형 칩은 하나만 눌리고, 질문 문장에 고른 값이 들어간다', async () => {
  renderPage()
  const [first, second] = PERSONA_CHOICES
  expect(chip(first).getAttribute('aria-pressed')).toBe('true')
  expect(chip('직접 쓰기').getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(chip(second))
  expect(chip(second).getAttribute('aria-pressed')).toBe('true')
  expect(chip(first).getAttribute('aria-pressed')).toBe('false')
  typeGoal(GOAL)
  fireEvent.change(pageSelect(), { target: { value: 'orders' } })
  const question = document.querySelector('.customer-question')!
  expect(question.textContent).toBe('이 고객이 주문·배송 조회 화면을 잘 찾을까요?')
  await settle()
})

it('직접 쓰기를 누르면 고객 유형 칸이 열리고, 쓴 값이 질문과 요청에 들어간다', async () => {
  const bodies = captureRuns()
  renderPage()
  expect(screen.queryByLabelText('고객 유형 직접 쓰기')).toBeNull()
  fireEvent.click(chip('직접 쓰기'))
  const custom = screen.getByLabelText('고객 유형 직접 쓰기') as HTMLInputElement
  expect(custom.value).toBe('')
  expect(chip('직접 쓰기').getAttribute('aria-pressed')).toBe('true')
  fireEvent.change(custom, { target: { value: '스마트폰이 익숙하지 않은 60대' } })
  // 한 번 더 눌러도 쓴 값을 지우지 않는다
  fireEvent.click(chip('직접 쓰기'))
  expect((screen.getByLabelText('고객 유형 직접 쓰기') as HTMLInputElement).value).toBe('스마트폰이 익숙하지 않은 60대')
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  await screen.findByTestId('where')
  expect(bodies[0]).toMatchObject({ persona: '스마트폰이 익숙하지 않은 60대' })
})

it('비운 채로 시작을 누르면 칸 아래에 안내하고 요청하지 않는다', async () => {
  const bodies = captureRuns()
  renderPage()
  fireEvent.click(chip('직접 쓰기'))
  await settle()
  // 시작을 누르기 전에는 안내하지 않는다
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(startButton())
  expect(screen.getAllByText('내용을 적어 주세요.')).toHaveLength(2)
  typeGoal(GOAL)
  expect(screen.getAllByText('내용을 적어 주세요.')).toHaveLength(1)
  expect(bodies).toHaveLength(0)
})

it.each([
  ['찾기', '조금 더 자세히 적어 주세요. (4자 이상)'],
  ['?!?! 1234 ...', '기호나 숫자 말고 글로 적어 주세요.'],
  ['아아아아아아아아', '알아볼 수 있는 문장으로 적어 주세요.'],
  ['가'.repeat(201), '200자까지 쓸 수 있어요.'],
  ['after 화면에서 환불 신청하기', '쓸 수 없는 단어가 있어요: after'],
])('하려는 일 "%s"는 안내 후 요청하지 않는다', async (value, message) => {
  const bodies = captureRuns()
  renderPage()
  typeGoal(value)
  await settle()
  fireEvent.click(startButton())
  expect(screen.getByText(message)).toBeTruthy()
  expect(bodies).toHaveLength(0)
})

it('입력을 마치면 도착 화면의 경로·확인 글자와 새 실험 키로 한 번 시작하고 진행 화면으로 이동한다', async () => {
  const bodies = captureRuns()
  renderPage()
  typeGoal(`  ${GOAL}  `)
  fireEvent.change(pageSelect(), { target: { value: 'orders' } })
  await settle()
  fireEvent.click(startButton())
  const where = (await screen.findByTestId('where')).textContent!
  expect(bodies).toHaveLength(1)
  const body = bodies[0]
  expect(body).toEqual({
    experimentKey: expect.stringMatching(/^exp_[0-9a-f]{32}$/),
    variant: 'before',
    goal: GOAL,
    verification: { path: '/shop/orders', text: '주문 / 배송 조회', scope: 'page' },
    persona: PERSONA_CHOICES[0],
    maxSteps: 8,
  })
  expect(body).not.toHaveProperty('siteId')
  expect(where).toBe(`/runs/run_new?experimentKey=${String(body.experimentKey)}`)
})

it('시작할 때마다 실험 키를 새로 만든다', async () => {
  const bodies = captureRuns()
  for (let i = 0; i < 2; i += 1) {
    const view = renderPage()
    typeGoal(GOAL)
    await settle()
    fireEvent.click(startButton())
    await screen.findByTestId('where')
    view.unmount()
  }
  expect(bodies).toHaveLength(2)
  expect(bodies[0].experimentKey).not.toBe(bodies[1].experimentKey)
})

it('다른 진단이 진행 중이면 안내와 진행 화면 링크를 보이고 시작할 수 없다', async () => {
  serveHealth({ activeRun: 'run_busy' })
  renderPage()
  const notice = await screen.findByText(new RegExp(BUSY))
  expect(within(notice).getByRole('link', { name: '보러 가기' }).getAttribute('href')).toBe('/runs/run_busy')
  expect(startButton().disabled).toBe(true)
})

it('AI 개선이 진행 중이면 그 개선 화면으로 연결한다', async () => {
  serveHealth({ activeRun: 'run_v', activeRunOwner: { kind: 'IMPROVEMENT_VERIFICATION', runId: 'run_v', improvementId: 'imp_1' } })
  renderPage()
  const notice = await screen.findByText(new RegExp(BUSY))
  expect(within(notice).getByRole('link', { name: '보러 가기' }).getAttribute('href')).toBe('/improvements/imp_1')
  expect(startButton().disabled).toBe(true)
})

it('AI 고객이 준비되지 않았으면 안내하고 시작할 수 없다', async () => {
  serveHealth({ status: 'NOT_READY' })
  renderPage()
  expect(await screen.findByText(/AI 고객이 아직 준비 중이에요/)).toBeTruthy()
  expect(startButton().disabled).toBe(true)
})

it('서버에 연결할 수 없으면 안내하고 다시 확인할 수 있다', async () => {
  server.use(http.get(apiUrl('/api/health'), () => errorResponse(500, 'STORAGE_ERROR', '오류', true)))
  renderPage()
  expect(await screen.findByText(/서버에 연결할 수 없어요/)).toBeTruthy()
  server.resetHandlers()
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  await waitFor(() => expect(screen.queryByText(/서버에 연결할 수 없어요/)).toBeNull())
})

it('시작했는데 409 RUN_ALREADY_ACTIVE면 서버 원문 대신 진행 중 안내를 보인다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(409, 'RUN_ALREADY_ACTIVE', 'Run run_x is active', true)))
  renderPage()
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  expect(await screen.findByText(BUSY)).toBeTruthy()
  expect(screen.queryByText('Run run_x is active')).toBeNull()
})

it('그 밖의 오류는 서버 안내를 보이고, 안내가 비어 있으면 대체 문구를 보인다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(422, 'CONTRACT_VALIDATION_ERROR', '도착 화면을 찾지 못했어요', false)))
  const view = renderPage()
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  expect(await screen.findByText('도착 화면을 찾지 못했어요')).toBeTruthy()
  view.unmount()

  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'BROWSER_ERROR', '   ', true)))
  renderPage()
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  expect(await screen.findByText('진단을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeTruthy()
  expect(screen.queryByText('BROWSER_ERROR')).toBeNull()
})
