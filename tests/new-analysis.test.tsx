import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { HealthDto } from '../src/api/dto/index.ts'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { DEFAULT_PERSONA, GOAL_SCREENS } from '../src/shared/customerInput.ts'
import { sentenceProblem } from '../src/shared/inputRules.ts'
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
const noPageSelect = () => expect(screen.queryByLabelText(/^어느 화면을 찾아야 하나요/)).toBeNull()
const exampleChips = () => within(screen.getByRole('group', { name: '예시' })).getAllByRole('button')
const matchedLine = () => document.querySelector('.home-screen')?.textContent ?? null
const typeGoal = (value: string) => fireEvent.change(goalInput(), { target: { value } })

/** 엔진 상태를 읽을 때까지 기다린다 (READY 전에는 시작 버튼이 열려 있어도 결과가 달라질 수 있다) */
const settle = () => waitFor(() => expect(startButton().disabled).toBe(false))

it('사이트는 예시 쇼핑몰 MORO MARKET 하나이고 첫 화면을 미리 볼 수 있으며, 하려는 일만 받는다', async () => {
  renderPage()
  expect(screen.getByRole('form', { name: '새 진단' })).toBeTruthy()
  // 글 칸은 하려는 일 하나뿐이고, 사이트 주소 칸·화면 고르는 칸은 없다
  expect(screen.getAllByRole('textbox')).toHaveLength(1)
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByPlaceholderText(/사이트 주소/)).toBeNull()
  expect(goalInput().value).toBe('')
  expect(screen.getByText('예시 쇼핑몰 MORO MARKET')).toBeTruthy()
  // 첫 화면 스크린샷(정적 파일)을 작게 보이고, 누르면 크게 보인다
  expect(screen.getByRole('img', { name: 'MORO MARKET 첫 화면' }).getAttribute('src')).toBe('/moro-market-home.jpg')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '첫 화면 크게 보기' }))
  const dialog = screen.getByRole('dialog', { name: 'MORO MARKET 첫 화면' })
  fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  // 누가(고객 유형)를 묻는 칸·문구가 없다
  expect(screen.queryByText(/누가|고객 유형|직접 쓰기/)).toBeNull()
  expect(document.body.textContent).not.toContain(DEFAULT_PERSONA)
  expect(screen.queryByLabelText(/실험 키|최대|성공 조건/)).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  await settle()
})

it('문장의 낱말로 찾아야 할 화면을 골라 한 줄로 보이고, "바꾸기"로 직접 고르면 그 뒤 문장을 고쳐도 바뀌지 않는다', async () => {
  const bodies = captureRuns()
  renderPage()
  await settle()
  expect(matchedLine()).toBeNull()
  typeGoal('배송이 어디쯤인지 궁금해요')
  expect(matchedLine()).toBe('찾아야 할 화면: 주문·배송 조회 · 바꾸기')
  noPageSelect()
  // 문장을 고치면 따라 바뀐다
  typeGoal(GOAL)
  expect(matchedLine()).toBe('찾아야 할 화면: 환불 신청 · 바꾸기')

  fireEvent.click(screen.getByRole('button', { name: '바꾸기' }))
  expect(Array.from(pageSelect().options).map((o) => o.textContent)).toEqual(['화면을 골라 주세요', ...GOAL_SCREENS.map((s) => s.label)])
  expect(pageSelect().value).toBe('refund')
  fireEvent.change(pageSelect(), { target: { value: 'support' } })
  expect(matchedLine()).toBe('찾아야 할 화면: 고객센터 · 바꾸기')
  // 직접 고른 뒤에는 문장을 고쳐도 그대로다
  typeGoal('배송이 어디쯤인지 궁금해요')
  expect(matchedLine()).toBe('찾아야 할 화면: 고객센터 · 바꾸기')
  fireEvent.click(startButton())
  await screen.findByTestId('where')
  expect(bodies[0]).toMatchObject({ verification: { path: '/shop/support', text: '자주 묻는 질문', scope: 'page' } })
})

it.each([
  ['맞는 낱말이 없으면', '사이트를 둘러보고 싶어요'],
  ['두 화면이 똑같이 맞으면', '주문한 운동화를 환불하고 싶어요'],
])('%s 짐작하지 않고 화면을 고르게 하며, 고르기 전에는 시작하지 않는다', async (_name, sentence) => {
  const bodies = captureRuns()
  renderPage()
  await settle()
  typeGoal(sentence)
  expect(matchedLine()).toBeNull()
  expect(pageSelect().value).toBe('')
  fireEvent.click(startButton())
  expect(screen.getByText('화면을 골라 주세요.')).toBeTruthy()
  expect(bodies).toHaveLength(0)
  fireEvent.change(pageSelect(), { target: { value: 'orders' } })
  fireEvent.click(startButton())
  await screen.findByTestId('where')
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({ goal: sentence, verification: { path: '/shop/orders' } })
})

it('예시를 누르면 문장 칸이 채워지고 찾아야 할 화면이 정해진다', async () => {
  renderPage()
  await settle()
  expect(exampleChips().map((b) => b.textContent)).toEqual(['지난주에 산 운동화가 발에 안 맞아서 돌려보내고 돈을 돌려받고 싶다'])
  fireEvent.click(exampleChips()[0])
  expect(goalInput().value).toBe('지난주에 산 운동화가 발에 안 맞아서 돌려보내고 돈을 돌려받고 싶다')
  expect(matchedLine()).toBe('찾아야 할 화면: 환불 신청 · 바꾸기')
})


it('숨겨서 보내는 고객 유형은 서버와 같은 문장 검사를 통과한다', () => {
  expect(sentenceProblem(DEFAULT_PERSONA, '고객 유형')).toBeNull()
})

it('비운 채로 시작을 누르면 칸 아래에 안내하고 요청하지 않는다', async () => {
  const bodies = captureRuns()
  renderPage()
  await settle()
  // 시작을 누르기 전에는 안내하지 않는다
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(startButton())
  expect(screen.getAllByText('내용을 적어 주세요.')).toHaveLength(1)
  expect(screen.getByText('화면을 골라 주세요.')).toBeTruthy()
  typeGoal(GOAL)
  expect(screen.queryByText('내용을 적어 주세요.')).toBeNull()
  expect(screen.queryByText('화면을 골라 주세요.')).toBeNull()
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

it('입력을 마치면 찾을 화면의 경로·확인 글자, 숨긴 고객 유형, 새 실험 키로 한 번 시작하고 결과 화면으로 이동한다', async () => {
  const bodies = captureRuns()
  renderPage()
  typeGoal(`  ${GOAL}  `)
  fireEvent.click(screen.getByRole('button', { name: '바꾸기' }))
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
    persona: DEFAULT_PERSONA,
    maxSteps: 8,
  })
  expect(body).not.toHaveProperty('siteId')
  expect(where).toBe('/runs/run_new')
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

it('AI가 준비되지 않았으면 안내하고 시작할 수 없다', async () => {
  serveHealth({ status: 'NOT_READY' })
  renderPage()
  expect(await screen.findByText(/AI가 아직 준비 중이에요/)).toBeTruthy()
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

it('서버 안내에 경로나 영문 이름이 섞여 있으면 그대로 보이지 않고 짧은 안내로 바꾼다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(422, 'CONTRACT_VALIDATION_ERROR', 'startPath는 /shop/{home,orders} 중 하나여야 합니다.', false)))
  const view = renderPage()
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  expect(await screen.findByText('입력을 다시 확인해 주세요.')).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/startPath|\/shop\//)
  view.unmount()

  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'SITE_NOT_CONFIGURED', '서버의 SHOP_AFTER_URL·SHOP_AFTER_LABEL을 확인해 주세요.', false)))
  renderPage()
  typeGoal(GOAL)
  await settle()
  fireEvent.click(startButton())
  expect(await screen.findByText('사이트가 아직 준비되지 않았어요. 잠시 뒤 다시 해 주세요.')).toBeTruthy()
  expect(document.body.textContent).not.toContain('SHOP_AFTER')
})

it('화면을 직접 고른 뒤에도 예시를 누르면 그 예시에 맞는 화면으로 바뀐다', async () => {
  renderPage()
  await settle()
  typeGoal(GOAL)
  fireEvent.click(screen.getByRole('button', { name: '바꾸기' }))
  fireEvent.change(pageSelect(), { target: { value: 'support' } })
  expect(matchedLine()).toBe('찾아야 할 화면: 고객센터 · 바꾸기')
  fireEvent.click(exampleChips()[0])
  expect(goalInput().value).toBe('지난주에 산 운동화가 발에 안 맞아서 돌려보내고 돈을 돌려받고 싶다')
  expect(matchedLine()).toBe('찾아야 할 화면: 환불 신청 · 바꾸기')
})
