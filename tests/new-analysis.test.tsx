import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

/** 최종 자동 개선 결과(public/improvements/imp-1119b.json) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const finalJson = (): any => JSON.parse(readFileSync(resolve(process.cwd(), 'public/improvements/imp-1119b.json'), 'utf-8'))
const useFinal = (body: unknown) => server.use(http.get('/improvements/imp-1119b.json', () => HttpResponse.json(body)))

const startButtons = () => screen.getAllByRole('button', { name: '분석 시작' }) as HTMLButtonElement[]

/** 목표·성공 조건·사용자 유형을 채운다 (화면은 직접 입력만 받는다) */
function fillInputs() {
  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '주문 내역 화면 찾기' } })
  fireEvent.change(screen.getByLabelText('사용자 유형 문장'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NewAnalysisPage />
    </MemoryRouter>,
  )
}

it('분석 대상·실험·분석 조건·버전별 분석 카드로 구성되고 버전 비교 카드는 없다', async () => {
  renderAt('/')
  for (const name of ['분석 대상', '실험', '버전별 분석']) {
    expect(await screen.findByRole('region', { name })).toBeTruthy()
  }
  expect(screen.queryByRole('region', { name: '버전 비교' })).toBeNull()
  // 분석 조건은 fieldset이라 group이고, 이름에 보조 문구가 이어진다
  expect(screen.getByRole('group', { name: /^분석 조건/ })).toBeTruthy()
})

it('성공 조건 안내는 사이트 지도 기준 경로 지표를 설명한다', async () => {
  renderAt('/')
  const note = await screen.findByText(/사이트 지도를 기준으로/)
  expect(note.textContent).toContain('우회 이동')
  expect(note.textContent).not.toContain('허용 경로가 없어')
})

it('버전별 분석 표는 v1·에이전트 최종안 행과 비활성 v3 행을 보이고 v3는 시작할 수 없다', async () => {
  useFinal(finalJson())
  renderAt('/?experimentKey=mock-done')
  const table = await screen.findByRole('table')
  const rows = within(table).getAllByRole('row')
  // 머리글 + v1 + 에이전트 최종안 + v3(예정)
  expect(rows).toHaveLength(4)
  expect(within(rows[2]).getByRole('rowheader').textContent).toBe('에이전트 최종안')
  expect(within(table).queryByText('v2 (변경 후)')).toBeNull()
  expect(startButtons()).toHaveLength(1)
  expect(await within(table).findByText('run_mock_done_before')).toBeTruthy()
  expect(within(rows[3]).getByRole('button', { name: '비활성' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '+ 버전 추가' }).hasAttribute('disabled')).toBe(true)
})

it('최대 탐색 횟수는 1~15 범위에서 +/- 버튼으로 조절된다', async () => {
  renderAt('/')
  const input = (await screen.findByLabelText('최대 탐색 횟수')) as HTMLInputElement
  expect(input.value).toBe('8')
  fireEvent.click(screen.getByRole('button', { name: '탐색 횟수 늘리기' }))
  expect(input.value).toBe('9')
  fireEvent.change(input, { target: { value: '15' } })
  expect(screen.getByRole('button', { name: '탐색 횟수 늘리기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: '1' } })
  expect(screen.getByRole('button', { name: '탐색 횟수 줄이기' }).hasAttribute('disabled')).toBe(true)
})

it('분석 사이트가 MORO MARKET이 아니면 안내를 보이고 분석 시작을 막는다', async () => {
  renderAt('/')
  const input = (await screen.findByLabelText('분석 사이트')) as HTMLInputElement
  expect(input.value).toBe('MORO MARKET')
  expect(screen.queryByText(/분석할 수 없는 사이트입니다/)).toBeNull()
  // 입력을 채우고 시작 가능한 상태(엔진 준비)가 될 때까지 기다린다
  fillInputs()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))

  fireEvent.change(input, { target: { value: 'https://example.com' } })
  expect(input.value).toBe('https://example.com')
  expect(screen.getByText(/분석할 수 없는 사이트입니다/)).toBeTruthy()
  expect(startButtons().every((button) => button.disabled)).toBe(true)

  fireEvent.change(input, { target: { value: '' } })
  expect(screen.getByText('분석 사이트를 입력해 주세요.')).toBeTruthy()
  expect(startButtons().every((button) => button.disabled)).toBe(true)

  // 대소문자·앞뒤 공백은 같은 사이트로 본다
  fireEvent.change(input, { target: { value: '  moro market ' } })
  expect(screen.queryByRole('alert', { name: '' })).toBeNull()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
})

/** POST /api/runs 요청 본문을 가로채고 422를 돌려준다(새 Run을 만들지 않음) */
function captureCreate(message = '입력 확인용') {
  const bodies: Record<string, unknown>[] = []
  server.use(http.post(apiUrl('/api/runs'), async ({ request }) => {
    bodies.push((await request.json()) as Record<string, unknown>)
    return errorResponse(422, 'CONTRACT_VALIDATION_ERROR', message)
  }))
  return bodies
}

it('목표·성공 조건·사용자 유형은 직접 입력하며, 모두 채워야 시작할 수 있다', async () => {
  renderAt('/')
  expect(screen.queryByRole('radiogroup')).toBeNull()   // 목록에서 선택하는 방식은 없다
  expect(screen.getByRole('group', { name: '성공 조건' })).toBeTruthy()
  expect(screen.queryByLabelText('글자가 정확히 일치할 때만')).toBeNull()   // 정확 일치는 서버 기본값(false)
  await screen.findByRole('table')
  expect(startButtons()[0].disabled).toBe(true)

  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '주문 내역 화면 찾기' } })
  expect(startButtons()[0].disabled).toBe(true)   // 사용자 유형이 비어 있음
  fireEvent.change(screen.getByLabelText('사용자 유형 문장'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))

  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '가'.repeat(201) } })
  expect(screen.getByText('탐색 목표 문장은 200자 이하로 입력해 주세요.')).toBeTruthy()
  expect(startButtons()[0].disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '주문 내역 화면 찾기' } })
  fireEvent.change(screen.getByLabelText('화면에 보여야 할 글자'), { target: { value: '  ' } })
  expect(startButtons()[0].disabled).toBe(true)   // 성공 조건 글자가 비어 있음
})

it('도착 화면을 고르면 그 화면의 제목을 성공 조건 글자로 채운다', async () => {
  renderAt('/')
  const text = screen.getByLabelText('화면에 보여야 할 글자') as HTMLInputElement
  expect(text.value).toBe('환불 / 반품 신청')   // 기본 도착 화면(환불 신청)의 제목
  fireEvent.change(screen.getByLabelText('도착 화면'), { target: { value: '/shop/orders' } })
  expect(text.value).toBe('주문 / 배송 조회')
  fireEvent.change(text, { target: { value: '주문 상세 목록' } })   // 사용자가 고칠 수 있다
  expect(text.value).toBe('주문 상세 목록')
  fireEvent.change(screen.getByLabelText('도착 화면'), { target: { value: '/shop/support' } })
  expect(text.value).toBe('자주 묻는 질문')
})

it('입력한 목표·성공 조건·사용자 유형을 문장으로 보내고, 422면 서버 메시지를 보인다', async () => {
  const bodies = captureCreate('goal에 쓸 수 없는 글자가 있습니다: after')
  renderAt('/')
  fillInputs()
  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '  주문 내역 화면 찾기 ' } })
  fireEvent.change(screen.getByLabelText('도착 화면'), { target: { value: '/shop/orders' } })
  fireEvent.change(screen.getByLabelText('찾는 범위'), { target: { value: 'main' } })

  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
  fireEvent.click(startButtons()[0])
  expect(await screen.findByText(/goal에 쓸 수 없는 글자가 있습니다: after/)).toBeTruthy()
  expect(bodies).toHaveLength(1)
  const { experimentKey, ...rest } = bodies[0]
  expect(typeof experimentKey).toBe('string')
  expect(rest).toEqual({
    variant: 'before',
    goal: '주문 내역 화면 찾기',
    verification: { path: '/shop/orders', text: '주문 / 배송 조회', scope: 'main' },
    persona: '쇼핑몰을 처음 쓰는 사용자',
    maxSteps: 8,
  })
})

it('도착 화면에 글자가 없으면 422 메시지를 보여 주고 Run을 만들지 않는다', async () => {
  renderAt('/?experimentKey=mock-preflight-422')
  fillInputs()
  fireEvent.change(screen.getByLabelText('화면에 보여야 할 글자'), { target: { value: '없는 글자' } })
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
  fireEvent.click(startButtons()[0])

  expect(await screen.findByText(/Before 도착 화면.*없는 글자.*글자가 없습니다/)).toBeTruthy()
  expect(screen.getByText('입력을 고친 뒤 다시 시작해 주세요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  const response = await fetch(apiUrl('/api/runs?experimentKey=mock-preflight-422'))
  expect((await response.json()).count).toBe(0)
})

it('도착 화면 확인 실패 503은 서버 문구와 재시도를 보이고 Run을 만들지 않는다', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  try {
    renderAt('/?experimentKey=mock-preflight-503')
    fillInputs()
    await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
    fireEvent.click(startButtons()[0])

    expect(await screen.findByText('Before 도착 화면을 읽지 못했습니다')).toBeTruthy()
    expect(screen.getByText('Run은 생성되지 않았습니다.')).toBeTruthy()
    const retry = screen.getByRole('button', { name: '다시 시도' })
    await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false))
    fireEvent.click(retry)
    await waitFor(() => expect(fetchSpy.mock.calls.filter(([url, options]) =>
      String(url).endsWith('/api/runs') && (options as RequestInit | undefined)?.method === 'POST').length).toBe(2))
    const response = await fetch(apiUrl('/api/runs?experimentKey=mock-preflight-503'))
    expect((await response.json()).count).toBe(0)
  } finally {
    fetchSpy.mockRestore()
  }
})

it('일반 503 응답은 재시도로 v1을 다시 요청한다', async () => {
  const variants: unknown[] = []
  server.use(http.post(apiUrl('/api/runs'), async ({ request }) => {
    variants.push(((await request.json()) as { variant: unknown }).variant)
    return new Response('<html>Unavailable</html>', { status: 503, headers: { 'Content-Type': 'text/html' } })
  }))
  renderAt('/')
  fillInputs()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
  fireEvent.click(startButtons()[0])
  expect(await screen.findByText('서버에 연결할 수 없습니다')).toBeTruthy()
  const retry = screen.getByRole('button', { name: '다시 시도' })
  await waitFor(() => expect(retry.hasAttribute('disabled')).toBe(false))
  fireEvent.click(retry)
  await waitFor(() => expect(variants).toEqual(['before', 'before']))
})

it('재시도할 수 없는 일반 503 응답은 재시도 버튼을 보이지 않는다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'OTHER_ERROR', '준비 실패', false)))
  renderAt('/')
  fillInputs()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
  fireEvent.click(startButtons()[0])
  expect(await screen.findByText('준비 실패')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
})

it('503 BROWSER_ERROR에 메시지가 없으면 대체 문구를 보인다', async () => {
  server.use(http.post(apiUrl('/api/runs'), () => errorResponse(503, 'BROWSER_ERROR', '', false)))
  renderAt('/')
  fillInputs()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
  fireEvent.click(startButtons()[0])
  expect(await screen.findByText('도착 화면을 확인하지 못했습니다')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
})

it('직접 입력한 기존 실험은 입력이 첫 Run 값으로 잠기고 v1은 다시 시작할 수 없다', async () => {
  const bodies = captureCreate()
  renderAt('/?experimentKey=mock-direct')
  expect(await screen.findByDisplayValue('주문 내역 화면 찾기')).toBeTruthy()
  expect((screen.getByLabelText('사용자 유형 문장') as HTMLInputElement).value).toBe('쇼핑몰을 처음 쓰는 사용자')
  expect(screen.getByLabelText('탐색 목표 문장').matches(':disabled')).toBe(true)   // 분석 조건 fieldset이 잠김
  expect((screen.getByLabelText('도착 화면') as HTMLSelectElement).value).toBe('/shop/orders')

  expect(startButtons()).toHaveLength(1)   // v2(after) 시작 버튼은 없다
  await waitFor(() => expect(screen.getByText('run_mock_direct_before')).toBeTruthy())
  expect(startButtons()[0].disabled).toBe(true)   // v1은 이미 VALID
  expect(bodies).toHaveLength(0)
})

it('에이전트 최종안 행은 자동 개선 결과의 이름과 점수 변화를 보이고 저장된 비교 화면으로 연결한다', async () => {
  useFinal(finalJson())
  renderAt('/')
  await screen.findByText('상단 메뉴: 이용정보 → 주문 환불')
  const row = screen.getByRole('rowheader', { name: '에이전트 최종안' }).closest('tr')!
  expect(within(row).getByText('환불 +19.6%p')).toBeTruthy()
  expect(within(row).getByText('문의 -0.4%p')).toBeTruthy()
  expect(within(row).getByRole('link', { name: '환불 비교 보기' }).getAttribute('href')).toBe('/comparisons/imp-1119b-S1')
  expect(within(row).getByRole('link', { name: '문의 비교 보기' }).getAttribute('href')).toBe('/comparisons/imp-1119b-S4')
  expect(within(row).getByRole('link', { name: '자동 개선 리포트' }).getAttribute('href')).toBe('/improvements/imp-1119b')
  expect(within(row).getByText(/환불·문의 목표만 비교할 수 있습니다/)).toBeTruthy()
  expect(within(row).getByText(/직접 입력한 목표에는 최종안 비교가 없습니다/)).toBeTruthy()
  expect(within(row).queryByRole('button')).toBeNull()   // 최종안 Run은 시작하지 않는다
})

it('개선안이 없는 결과는 비교 링크 없이 개선안 없음을 안내한다', async () => {
  const json = finalJson()
  json.summary.result = 'NO_IMPROVEMENT'; json.summary.afterLabel = null; json.summary.afterSource = null
  json.verification.status = 'NOT_RUN'; json.verification.pairs = []
  useFinal(json)
  renderAt('/')
  await screen.findByText('개선안 없음')
  const row = screen.getByRole('rowheader', { name: '에이전트 최종안' }).closest('tr')!
  expect(within(row).queryByRole('link', { name: /비교 보기/ })).toBeNull()
  expect(within(row).queryByText(/비교할 수 있습니다/)).toBeNull()   // 비교할 최종안이 없다는 안내와 모순되는 문구를 붙이지 않는다
})

it('Run이 없거나 무효인 쌍은 비교 링크를 보이지 않는다', async () => {
  const json = finalJson()
  json.verification.pairs[0].after = null
  json.verification.pairs[1].before.validity = 'INVALID'
  useFinal(json)
  renderAt('/')
  await screen.findByText('상단 메뉴: 이용정보 → 주문 환불')
  const row = screen.getByRole('rowheader', { name: '에이전트 최종안' }).closest('tr')!
  expect(within(row).queryByRole('link', { name: /비교 보기/ })).toBeNull()
  expect(within(row).getByRole('link', { name: '자동 개선 리포트' })).toBeTruthy()
})

it('자동 개선 결과를 읽지 못하면 안내만 보이고 분석 시작은 막히지 않는다', async () => {
  server.use(http.get('/improvements/imp-1119b.json', () => new HttpResponse(null, { status: 404 })))
  renderAt('/')
  fillInputs()
  expect(await screen.findByText('자동 개선 결과를 불러오지 못했습니다.')).toBeTruthy()
  await waitFor(() => expect(startButtons()[0].disabled).toBe(false))
})
