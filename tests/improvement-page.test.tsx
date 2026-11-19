import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementJobDto } from '../src/api/improvements.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { IMPROVEMENT_POLL_MS, IMPROVEMENT_RETRY_MS } from '../src/features/improvement/useImprovement.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// AI 개선 결과 화면: GET /api/improvements/{id}(BE #130)로 읽고, 진행 중이면 다시 읽는다

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const improved = (): Json =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8'))

const LIMITATION = 'AI 고객 기준이에요. 실제 사람 테스트로 확인해 보세요.'

function job(over: Partial<ImprovementJobDto> = {}): ImprovementJobDto {
  return {
    improvementId: 'imp_T',
    kind: 'LIVE',
    status: 'COMPLETED',
    phase: 'DONE',
    createdAt: '2026-11-19T10:00:00Z',
    startedAt: '2026-11-19T10:00:01Z',
    finishedAt: '2026-11-19T10:05:00Z',
    error: null,
    input: { goal: '지난주에 산 운동화를 환불하고 싶을', persona: '50대 이상', goalPage: 'refund' },
    improvement: improved(),
    ...over,
  }
}

function serve(body: ImprovementJobDto | (() => ImprovementJobDto)) {
  server.use(
    http.get(apiUrl('/api/improvements/:improvementId'), () =>
      HttpResponse.json(typeof body === 'function' ? body() : body)),
  )
}

function renderPage(id = 'imp_T') {
  return render(
    <MemoryRouter initialEntries={[`/improvements/${id}`]}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
        <Route path="/improvements" element={<p>목록</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const result = () => screen.findByRole('region', { name: '결론' })
const howChosen = () => screen.queryByText('어떻게 골랐는지 보기')?.closest('details') ?? null

afterEach(() => { vi.useRealTimers() })

it('끝난 결과는 결론·다시 해 본 결과·접힌 "어떻게 골랐는지"·한 줄 안내 순서로 보인다', async () => {
  serve(job())
  renderPage()
  expect(screen.getByRole('status').textContent).toBe('불러오는 중이에요')
  const conclusion = await result()
  expect(screen.getByRole('heading', { level: 1, name: 'AI 개선' })).toBeTruthy()
  expect(conclusion.textContent).toContain("'이용정보' → '주문내역'으로 바꿔 보세요")
  const retried = screen.getByRole('region', { name: '개선안에서 다시 해 봤어요' })
  expect(conclusion.compareDocumentPosition(retried) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const details = howChosen()!
  expect(details.open).toBe(false)
  expect(within(details).getByRole('region', { name: '시험한 이름' })).toBeTruthy()
  expect(within(details).getByRole('region', { name: '점수 계산' })).toBeTruthy()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  // 개발용 id·코드·영어는 보이지 않는다
  const text = document.body.textContent ?? ''
  for (const code of ['imp_T', 'COMPLETED', 'OFFICIAL_B', 'R1-H1', 'S1', 'S4', 'GUARD_LOSS', 'MAX_ROUNDS']) expect(text).not.toContain(code)
  for (const wordy of ['해당', '되었습니다', '주 목표', '지킬 목표', '공식 평가(B)', '가장 짧은 길로']) expect(text).not.toContain(wordy)
})

it.each([
  ['LIVE', '심사위원 실행 (공식 기록 아님)'],
  ['OFFICIAL', '사전 등록 공식 결과'],
  ['UNKNOWN', '출처 확인 안 된 결과'],
  ['SOMETHING_NEW', '출처 확인 안 된 결과'],
])('kind %s는 %s 표시를 붙인다', async (kind, label) => {
  serve(job({ kind }))
  renderPage()
  expect(await screen.findByText(label)).toBeTruthy()
  expect(document.body.textContent).not.toContain(kind)
})

it('kind가 없으면 표시를 붙이지 않는다', async () => {
  serve(job({ kind: undefined }))
  renderPage()
  await result()
  expect(document.querySelector('.experiment-tag')).toBeNull()
})

it('입력 줄에 고객·할 일·도착 화면을 보이고, 진단에서 왔으면 처음 진단 링크를 둔다', async () => {
  serve(job({ input: { goal: '환불하고 싶을', persona: '바쁜', goalPage: 'refund', sourceRunId: 'run_1' } }))
  renderPage()
  const line = await screen.findByText(/고객이/, { selector: '.imp-question' })
  expect(line.textContent).toBe('바쁜 고객이 환불하고 싶을 때 · 도착 화면 환불 신청 · 처음 진단 보기')
  expect(within(line).getByRole('link', { name: '처음 진단 보기' }).getAttribute('href')).toBe('/runs/run_1/result')
})

it('모르는 도착 화면은 키 그대로, 입력이 없으면 입력 줄을 보이지 않는다', async () => {
  serve(job({ input: { goal: '쿠폰을 찾을', persona: '바쁜', goalPage: 'coupon' } }))
  const first = renderPage()
  expect((await screen.findByText(/고객이/, { selector: '.imp-question' })).textContent).toContain('도착 화면 coupon')
  expect(screen.queryByRole('link', { name: '처음 진단 보기' })).toBeNull()
  first.unmount()

  serve(job({ input: null }))
  renderPage()
  await result()
  expect(document.querySelector('.imp-question')).toBeNull()
})

it('없는 결과(404)면 찾을 수 없음과 목록 링크를 보인다', async () => {
  renderPage('imp_NONE') // 기본 핸들러: 404 IMPROVEMENT_NOT_FOUND
  expect((await screen.findByRole('alert')).textContent).toBe('결과를 찾을 수 없어요.')
  expect(screen.getByRole('link', { name: 'AI 개선 목록으로' }).getAttribute('href')).toBe('/improvements')
})

it('허용되지 않는 id 문자는 요청하지 않고 찾을 수 없음으로 안내한다', async () => {
  let requested = false
  server.use(http.get(apiUrl('/api/improvements/:improvementId'), () => {
    requested = true
    return HttpResponse.json(job())
  }))
  renderPage('a.b')
  expect((await screen.findByRole('alert')).textContent).toContain('찾을 수 없어요')
  expect(requested).toBe(false)
})

it.each([
  ['서버 오류(500)', () => errorResponse(500, 'INTERNAL', '서버 오류')],
  ['네트워크 오류', () => HttpResponse.error()],
])('%s면 불러오지 못함을 안내한다', async (_name, respond) => {
  server.use(http.get(apiUrl('/api/improvements/:improvementId'), respond))
  renderPage()
  expect((await screen.findByRole('alert')).textContent).toContain('결과를 불러오지 못했어요')
  expect(document.body.textContent).not.toContain('INTERNAL')
})

it('진행 중이면 3단계 체크리스트와 "5분쯤 걸려요"만 보이고 결과·안내 줄은 아직 없다', async () => {
  serve(job({ status: 'RUNNING', phase: 'BUILD_FINAL_SITE', finishedAt: null, improvement: null }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  const steps = within(progress).getAllByRole('listitem')
  expect(steps.map((li) => li.dataset.state)).toEqual(['done', 'doing', 'todo'])
  expect(steps.map((li) => li.textContent)).toEqual(['✓이름 후보 찾기 (끝)', '2개선안 만들기 (하는 중)', '3다시 확인'])
  expect(within(progress).getByRole('status').textContent).toContain('5분쯤 걸려요')
  expect(screen.queryByRole('region', { name: '결론' })).toBeNull()
  expect(howChosen()).toBeNull()
  expect(screen.queryByText(LIMITATION)).toBeNull()
})

it('대기 중(QUEUED)이면 모든 단계가 아직 할 일이다', async () => {
  serve(job({ status: 'QUEUED', phase: 'QUEUED', improvement: null }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['todo', 'todo', 'todo'])
})

it('진행 중에 찾은 후보는 "아직 확정 아니에요"로만 보이고 바꾸라고 권하지 않는다', async () => {
  serve(job({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY' }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'doing'])
  expect(progress.textContent).toContain("지금까지 찾은 이름: '이용정보' → '주문내역'")
  expect(progress.textContent).toContain('아직 확정 아니에요')
  expect(document.body.textContent).not.toContain('바꿔 보세요')
  expect(screen.queryByRole('region', { name: '결론' })).toBeNull()
  expect(screen.queryByRole('region', { name: '개선안에서 다시 해 봤어요' })).toBeNull()
})

it('진행 중 후보가 마지막 확인에서 떨어지면 끝난 결과에 나아지지 않았다고 보이고 권하지 않는다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let calls = 0
  serve(() => {
    calls += 1
    if (calls === 1) return job({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY' })
    const report = improved()
    report.summary = { ...report.summary, result: 'NO_IMPROVEMENT', afterLabel: null,
      officialRejected: { label: '주문내역', reason: 'MAIN_GAIN_INSUFFICIENT' } }
    return job({ improvement: report })
  })
  renderPage()
  expect((await screen.findByRole('region', { name: '진행 상황' })).textContent).toContain("'주문내역'")
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  const area = await result()
  expect(area.textContent).toContain('이름만 바꿔서는 나아지지 않았어요')
  expect(area.textContent).toContain("마지막 후보 '주문내역'도 다시 재 보니 기준에 못 미쳤어요 (나아진 폭이 작았어요).")
  expect(area.textContent).not.toContain('바꿔 보세요')
})

it.each(['FAILED', 'INTERRUPTED'])('%s인데 후보가 있으면 확정 아닌 후보로만 보이고 권하지 않는다', async (status) => {
  serve(job({ status, phase: 'OFFICIAL_AND_VERIFY', error: { code: 'X', message: '마지막 확인 중 오류가 났어요.' } }))
  renderPage()
  const card = await screen.findByRole('region', { name: '끝내지 못함' })
  expect(card.textContent).toContain('확인을 끝내지 못해 확정 아니에요. 이 이름은 권하지 않아요.')
  expect(document.body.textContent).not.toContain('바꿔 보세요')
  expect(screen.queryByRole('region', { name: '결론' })).toBeNull()
})

it.each([
  ['FAILED', '끝내지 못했어요'],
  ['INTERRUPTED', '중간에 멈췄어요'],
])('%s면 "%s"와 서버 안내를 보이고 진행 상황은 없다', async (status, title) => {
  serve(job({ status, phase: 'LOOP', improvement: null, error: { code: 'LOOP_FAILED', message: '후보 평가 중 오류가 났어요.' } }))
  renderPage()
  const card = await screen.findByRole('region', { name: '끝내지 못함' })
  expect(within(card).getByRole('heading', { name: title })).toBeTruthy()
  expect(within(card).getByRole('alert').textContent).toBe('잠시 뒤 다시 해 주세요. 후보 평가 중 오류가 났어요.')
  expect(card.textContent).not.toContain('LOOP_FAILED')
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('region', { name: '결론' })).toBeNull()
})

it('조회가 한 번 실패해도 받은 내용을 두고 자동으로 다시 시도해 완료 결과를 보인다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let calls = 0
  server.use(http.get(apiUrl('/api/improvements/:improvementId'), () => {
    calls += 1
    if (calls === 1) return HttpResponse.json(job({ status: 'RUNNING', phase: 'LOOP', improvement: null }))
    if (calls === 2) return HttpResponse.error()
    return HttpResponse.json(job())
  }))
  renderPage()
  await screen.findByRole('region', { name: '진행 상황' })
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  expect((await screen.findByText(/연결이 잠깐 끊겼어요/)).textContent).toContain('다시 연결하는 중이에요')
  expect(screen.getByRole('region', { name: '진행 상황' })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_RETRY_MS) })
  expect(await result()).toBeTruthy()
  expect(screen.queryByText(/연결이 잠깐 끊겼어요/)).toBeNull()
  expect(calls).toBe(3)
})

it('처음 조회부터 실패하면 다시 불러오기 버튼과 자동 재시도로 복구한다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let calls = 0
  server.use(http.get(apiUrl('/api/improvements/:improvementId'), () => {
    calls += 1
    return calls === 1 ? HttpResponse.error() : HttpResponse.json(job())
  }))
  renderPage()
  const alert = await screen.findByRole('alert')
  expect(within(alert).getByRole('button', { name: '지금 다시 불러오기' })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_RETRY_MS) })
  expect(await result()).toBeTruthy()
})

it('진행 중이면 3초마다 다시 읽고, 끝나면 결과를 보이고 멈춘다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let calls = 0
  serve(() => {
    calls += 1
    return calls === 1 ? job({ status: 'RUNNING', phase: 'LOOP', improvement: null }) : job()
  })
  renderPage()
  await screen.findByRole('region', { name: '진행 상황' })
  expect(calls).toBe(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  expect(await result()).toBeTruthy()
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(calls).toBe(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS * 3) })
  expect(calls).toBe(2)
})

it('다시 해 본 결과 데이터에 문제가 있으면 그 카드만 안내하고 나머지는 보인다', async () => {
  const broken = improved()
  delete broken.verification.status
  serve(job({ improvement: broken }))
  renderPage()
  const verification = await screen.findByRole('region', { name: '개선안에서 다시 해 봤어요' })
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
  expect(within(verification).getByRole('alert').textContent).toBe('이 부분을 보여 드릴 수 없어요.')
  expect(within(screen.getByRole('region', { name: '결론' })).queryByRole('alert')).toBeNull()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('결론 데이터에 문제가 있으면 결론만 안내하고 어떻게 골랐는지는 보인다', async () => {
  const broken = improved()
  delete broken.summary.beforeLabel
  serve(job({ improvement: broken }))
  renderPage()
  expect(within(await result()).getByRole('alert').textContent).toBe('이 부분을 보여 드릴 수 없어요.')
  expect(howChosen()).toBeTruthy()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('회차 데이터에 문제가 있으면 시험한 이름만 숨기고 나머지는 정상이다', async () => {
  const broken = improved()
  delete broken.rounds[0].round
  serve(job({ improvement: broken }))
  renderPage()
  await result()
  expect(screen.queryByRole('region', { name: '시험한 이름' })).toBeNull()
  expect(screen.getByRole('region', { name: '점수 계산' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('점수 계산도 회차도 없으면 "어떻게 골랐는지 보기"를 두지 않는다', async () => {
  const body = improved()
  body.official = null
  body.rounds = []
  serve(job({ improvement: body }))
  renderPage()
  await result()
  expect(howChosen()).toBeNull()
})
