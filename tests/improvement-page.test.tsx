import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementJobDto } from '../src/api/improvements.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { IMPROVEMENT_POLL_MS, IMPROVEMENT_RETRY_MS } from '../src/features/improvement/useImprovement.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// /improvements/:id: 진단 없이 만든 결과는 같은 두 단계(어떻게 바꾸면 좋을까요 → 얼마나 좋아질까요)로 보이고,
// 진단에서 시작한 결과는 그 진단 화면으로 보낸다. GET /api/improvements/{id}(BE #130)로 읽고, 진행 중이면 다시 읽는다

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const improved = (): Json =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8'))

const LIMITATION = 'AI 기준이에요. 실제 사람 테스트로 확인해 보세요.'

function job(over: Partial<ImprovementJobDto> = {}): ImprovementJobDto {
  return {
    improvementId: 'imp_T',
    kind: 'OFFICIAL',
    status: 'COMPLETED',
    phase: 'DONE',
    createdAt: '2026-11-19T10:00:00Z',
    startedAt: '2026-11-19T10:00:01Z',
    finishedAt: '2026-11-19T10:05:00Z',
    error: null,
    input: null,
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

function Where() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}</p>
}

function renderPage(id = 'imp_T') {
  return render(
    <MemoryRouter initialEntries={[`/improvements/${id}`]}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** 처음 불러오기가 끝난 뒤의 단계 */
async function stepOf(name: string) {
  await waitFor(() => expect(screen.queryByText('불러오는 중이에요')).toBeNull())
  return screen.findByRole('region', { name })
}
const fix = () => stepOf('어떻게 바꾸면 좋을까요?')
const gain = () => stepOf('바꾸면 얼마나 좋아질까요?')
const answerOf = (region: HTMLElement) => region.querySelector('.tl-answer')?.textContent ?? null
const progress = () => screen.findByRole('list', { name: '진행 상황' })
const howChosen = () => screen.queryByText('어떻게 골랐는지 보기')?.closest('details') ?? null

afterEach(() => { vi.useRealTimers() })

it('진단에서 시작한 결과는 그 진단 화면으로 보낸다', async () => {
  serve(job({ kind: 'LIVE', input: { goal: '환불하고 싶어요', persona: '숨은 값', goalPage: 'refund', sourceRunId: 'run_1' } }))
  renderPage()
  expect((await screen.findByTestId('location')).textContent).toBe('/runs/run_1')
})

it('진단 없이 만든 결과는 바꿀 이름 → 가능성 전후·다른 목표·다시 해 본 결과·접힌 "어떻게 골랐는지" 순서로 보인다', async () => {
  serve(job())
  renderPage()
  expect(screen.getByRole('status').textContent).toBe('불러오는 중이에요')
  const proposal = await fix()
  expect(answerOf(proposal)).toBe("상단 메뉴 '이용정보' → '주문내역'")
  const numbers = await gain()
  expect(answerOf(numbers)).toBe('38.5% → 70.1%+31.6%p')
  // 실제 사이트를 바꾸는 것이 아니라 제안이라는 것을 알린다
  expect(numbers.textContent).toContain('실제 사이트는 바뀌지 않아요. 이 이름으로 바꿔서 반영해 보세요.')
  expect(proposal.compareDocumentPosition(numbers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // 다른 목표는 한 줄, 숫자는 접혀 있다
  const guards = within(numbers).getByRole('group', { name: '다른 목표' })
  expect(guards.querySelector('p')?.textContent).toBe('다른 목표도 괜찮아요.')
  expect(guards.querySelector('details')?.open).toBe(false)
  expect([...guards.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
    '배송 68.0% → 81.2%+13.2%p',
    '쿠폰 77.1% → 90.3%+13.2%p',
    '문의 77.0% → 76.2%-0.8%p',
  ])
  // 개선안에서 다시 해 본 결과와 비교 링크
  const recheck = within(numbers).getByRole('region', { name: '개선안에서 다시 해 봤어요' })
  expect([...recheck.querySelectorAll('.imp-verification > .recheck .recheck-row')].map((row) => row.textContent)).toEqual(['지금 화면못 찾음', '개선안2번 만에 도착'])
  expect(within(recheck).getAllByRole('link', { name: '화면별로 비교하기' })[0].getAttribute('href')).toBe('/comparisons/imp-1119-s1')
  const details = howChosen()!
  expect(details.open).toBe(false)
  expect(within(details).getByRole('region', { name: '시험한 이름' })).toBeTruthy()
  expect(within(details).getByRole('region', { name: '점수 계산' })).toBeTruthy()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
  expect(screen.queryByRole('list', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  // 개발용 id·코드·영어, "OO 고객" 같은 말은 보이지 않는다
  const text = document.body.textContent ?? ''
  for (const code of ['imp_T', 'COMPLETED', 'OFFICIAL', 'R1-H1', 'S1', 'S4', 'GUARD_LOSS', 'MAX_ROUNDS']) expect(text).not.toContain(code)
  expect(text).not.toMatch(/이 고객|다른 고객|고객이|고객 [0-9]/)
  expect(text).not.toMatch(/고치|고쳐|고친/)
  for (const wordy of ['해당', '되었습니다', '주 목표', '지킬 목표', '공식 평가(B)']) expect(text).not.toContain(wordy)
})

it('허용 범위를 넘게 떨어진 목표가 있으면 "많이 떨어졌어요"로 보이고 그 목표를 표시한다', async () => {
  const body = improved()
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.72, delta: -0.05 }
  serve(job({ improvement: body }))
  renderPage()
  const guards = within(await gain()).getByRole('group', { name: '다른 목표' })
  expect(guards.querySelector('p')?.textContent).toBe('다른 목표가 많이 떨어졌어요.')
  expect([...guards.querySelectorAll('li')].at(-1)?.textContent).toBe('문의 77.0% → 72.0%-5.0%p 많이 떨어졌어요')
})

it('허용 범위를 모르면 다른 목표를 판정하지 않는다', async () => {
  const body = improved()
  delete body.plan.rules.maxGuardLoss
  serve(job({ improvement: body }))
  renderPage()
  const guards = within(await gain()).getByRole('group', { name: '다른 목표' })
  expect(guards.querySelector('p')?.textContent).toBe('다른 목표도 같이 재 봤어요.')
  expect(guards.textContent).not.toContain('괜찮')
})

it('나아진 이름이 없으면 권하지 않고, 지금 가능성만 보이며 다시 해 본 결과는 없다', async () => {
  const body = improved()
  body.summary = { ...body.summary, result: 'NO_IMPROVEMENT', afterLabel: null, main: { ...body.summary.main, after: null, delta: null }, guards: [] }
  body.verification = { status: 'NOT_RUN', error: null, method: null, pairs: [] }
  serve(job({ improvement: body }))
  renderPage()
  const proposal = await fix()
  expect(answerOf(proposal)).toBe('이름만 바꿔서는 나아지지 않았어요')
  expect(proposal.textContent).toContain("지금은 '이용정보' 메뉴 이름만 바꿔 볼 수 있어요.")
  const numbers = await gain()
  expect(answerOf(numbers)).toBe('38.5% 그대로예요')
  expect(within(numbers).queryByRole('group', { name: '다른 목표' })).toBeNull()
  expect(within(numbers).queryByRole('region', { name: '개선안에서 다시 해 봤어요' })).toBeNull()
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요/)
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
  await fix()
  expect(document.querySelector('.kind-tag')).toBeNull()
})

it('머리에는 하려는 일과 찾을 화면만 보이고 고객 유형은 보이지 않는다. 모르는 화면은 코드값 대신 "다른 화면"이다', async () => {
  serve(job({ input: { goal: '쿠폰을 찾고 싶어요', persona: '숨은 고객 유형', goalPage: 'coupon' } }))
  const first = renderPage()
  await fix()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('쿠폰을 찾고 싶어요')
  expect(document.querySelector('.report-eyebrow')?.textContent).toContain('찾을 화면 · 다른 화면')
  expect(document.body.textContent).not.toMatch(/숨은 고객 유형|coupon/)
  first.unmount()

  serve(job({ input: null }))
  renderPage()
  await fix()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('메뉴 이름을 바꿔 봤어요')
})

it('없는 결과(404)면 찾을 수 없음과 새 진단 링크를 보인다', async () => {
  renderPage('imp_NONE') // 기본 핸들러: 404 IMPROVEMENT_NOT_FOUND
  expect((await screen.findByRole('alert')).textContent).toBe('결과를 찾을 수 없어요.')
  expect(screen.getByRole('link', { name: '새 진단 하러 가기' }).getAttribute('href')).toBe('/')
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

it('진행 중이면 3단계 체크리스트와 "5분쯤 걸려요"만 보이고, 다음 단계는 질문만 있다', async () => {
  serve(job({ status: 'RUNNING', phase: 'BUILD_FINAL_SITE', finishedAt: null, improvement: null }))
  renderPage()
  const steps = within(await progress()).getAllByRole('listitem')
  expect(steps.map((li) => li.dataset.state)).toEqual(['done', 'doing', 'todo'])
  expect(steps.map((li) => li.textContent)).toEqual(['✓이름 후보 찾기 (끝)', '2개선안 만들기 (하는 중)', '3다시 확인'])
  const working = await fix()
  expect(answerOf(working)).toBe('AI가 개선안을 찾는 중이에요')
  expect(within(working).getByRole('status').textContent).toContain('5분쯤 걸려요')
  expect(working.closest('li')?.dataset.state).toBe('current')
  const next = await gain()
  expect(next.closest('li')?.dataset.state).toBe('upcoming')
  expect(next.textContent).toBe('바꾸면 얼마나 좋아질까요?')
  expect(howChosen()).toBeNull()
  expect(screen.queryByText(LIMITATION)).toBeNull()
})

it('대기 중(QUEUED)이면 모든 단계가 아직 할 일이다', async () => {
  serve(job({ status: 'QUEUED', phase: 'QUEUED', improvement: null }))
  renderPage()
  expect(within(await progress()).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['todo', 'todo', 'todo'])
})

it('진행 중에 찾은 후보는 "아직 확정 아니에요"로만 보이고 바꾸라고 권하지 않는다', async () => {
  serve(job({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY' }))
  renderPage()
  expect(within(await progress()).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'doing'])
  const working = await fix()
  expect(answerOf(working)).toBe('AI가 개선안을 찾는 중이에요')
  expect(working.textContent).toContain("지금까지 찾은 이름: '이용정보' → '주문내역'")
  expect(working.textContent).toContain('아직 확정 아니에요')
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요/)
  expect((await gain()).textContent).toBe('바꾸면 얼마나 좋아질까요?')
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
  expect((await fix()).textContent).toContain("'주문내역'")
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  await waitFor(async () => expect(answerOf(await fix())).toBe('이름만 바꿔서는 나아지지 않았어요'))
  const area = await fix()
  expect(area.textContent).toContain("마지막 후보 '주문내역'도 다시 재 보니 기준에 못 미쳤어요 (나아진 폭이 작았어요).")
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요/)
})

it.each([
  ['FAILED', '끝내지 못했어요'],
  ['INTERRUPTED', '중간에 멈췄어요'],
])('%s인데 후보가 있으면 "%s"와 확정 아닌 후보로만 보이고 권하지 않는다', async (status, title) => {
  serve(job({ status, phase: 'OFFICIAL_AND_VERIFY', error: { code: 'LOOP_FAILED', message: 'internal trace' } }))
  renderPage()
  const area = await fix()
  expect(answerOf(area)).toBe(title)
  expect(within(area).getByRole('alert').textContent).toBe('잠시 뒤 다시 해 주세요.')
  expect(area.textContent).toContain('확인을 끝내지 못해 확정 아니에요. 이 이름은 권하지 않아요.')
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요|LOOP_FAILED|internal trace/)
  // 진행 상황도, 다음 단계도 없다
  expect(screen.queryByRole('list', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('region', { name: '바꾸면 얼마나 좋아질까요?' })).toBeNull()
  // 진단 없이 만든 결과라 다시 시작 버튼은 없다
  expect(screen.queryByRole('button')).toBeNull()
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
  await progress()
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  expect((await screen.findByText(/연결이 잠깐 끊겼어요/)).textContent).toContain('다시 연결하는 중이에요')
  expect(screen.getByRole('list', { name: '진행 상황' })).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_RETRY_MS) })
  await waitFor(async () => expect(answerOf(await fix())).toBe("상단 메뉴 '이용정보' → '주문내역'"))
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
  await waitFor(async () => expect(answerOf(await fix())).toBe("상단 메뉴 '이용정보' → '주문내역'"))
})

it('진행 중이면 3초마다 다시 읽고, 끝나면 결과를 보이고 멈춘다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let calls = 0
  serve(() => {
    calls += 1
    return calls === 1 ? job({ status: 'RUNNING', phase: 'LOOP', improvement: null }) : job()
  })
  renderPage()
  await progress()
  expect(calls).toBe(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  await waitFor(async () => expect(answerOf(await gain())).toBe('38.5% → 70.1%+31.6%p'))
  expect(screen.queryByRole('list', { name: '진행 상황' })).toBeNull()
  expect(calls).toBe(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS * 3) })
  expect(calls).toBe(2)
})

it('끝났는데 리포트가 없으면 안내하고, "다시 불러오기"로 다시 읽는다', async () => {
  let calls = 0
  serve(() => {
    calls += 1
    return calls === 1 ? job({ improvement: null }) : job()
  })
  renderPage()
  const waiting = await fix()
  expect(waiting.textContent).toContain('결과를 아직 보여 드릴 수 없어요.')
  fireEvent.click(within(waiting).getByRole('button', { name: '다시 불러오기' }))
  await waitFor(async () => expect(answerOf(await fix())).toBe("상단 메뉴 '이용정보' → '주문내역'"))
  expect(calls).toBe(2)
})

it('후보 찾기만 끝난 결과(마지막 확인 전)는 확정처럼 권하지 않는다', async () => {
  const body = improved()
  body.summary.scoreSource = 'LOOP_A'
  body.official = null
  body.verification = { status: 'NOT_RUN', reason: 'NOT_FINALIZED', error: null, method: null, pairs: [] }
  serve(job({ improvement: body }))
  renderPage()
  const proposal = await fix()
  expect(answerOf(proposal)).toBe('아직 확정된 개선안이 없어요')
  expect(proposal.textContent).toContain("지금까지 찾은 이름: '이용정보' → '주문내역'")
  expect(proposal.textContent).toContain('다시 확인하기 전이라 확정 아니에요. 이 이름은 아직 권하지 않아요.')
  const numbers = await gain()
  // 확정 전 점수를 큰 숫자로 내세우지 않고, 다시 해 보지 않은 까닭을 사실대로 말한다
  expect(answerOf(numbers)).toBeNull()
  expect(numbers.textContent).toContain('개선안 화면에서 아직 다시 해 보지 않았어요.')
  expect(document.body.textContent).not.toMatch(/반영해 보세요|바꿔 보세요|바꿀 이름이 없어서|LOOP_A|NOT_FINALIZED/)
})

it('확정된 이름인데 다시 해 보다가 멈췄으면 반영하라고 하지 않고 확인을 끝내지 못했다고 한다', async () => {
  const body = improved()
  body.verification.status = 'FAILED'
  serve(job({ improvement: body }))
  renderPage()
  expect(answerOf(await fix())).toBe("상단 메뉴 '이용정보' → '주문내역'")
  const numbers = await gain()
  expect(numbers.textContent).toContain('다시 해 보는 중에 멈춰서 확인은 끝내지 못했어요.')
  expect(numbers.textContent).not.toContain('반영해 보세요')
})

it('다시 해 본 결과 데이터에 문제가 있으면 그 부분만 안내하고 나머지는 보인다', async () => {
  const broken = improved()
  delete broken.verification.status
  serve(job({ improvement: broken }))
  renderPage()
  const verification = await screen.findByRole('region', { name: '개선안에서 다시 해 봤어요' })
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
  expect(within(verification).getByRole('alert').textContent).toBe('이 부분을 보여 드릴 수 없어요.')
  expect(answerOf(await fix())).toBe("상단 메뉴 '이용정보' → '주문내역'")
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('결론 데이터에 문제가 있으면 결론만 안내하고 어떻게 골랐는지는 보인다', async () => {
  const broken = improved()
  delete broken.summary.beforeLabel
  serve(job({ improvement: broken }))
  renderPage()
  expect(within(await fix()).getByRole('alert').textContent).toBe('이 부분을 보여 드릴 수 없어요.')
  expect(howChosen()).toBeTruthy()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('회차 데이터에 문제가 있으면 시험한 이름만 숨기고 나머지는 정상이다', async () => {
  const broken = improved()
  delete broken.rounds[0].round
  serve(job({ improvement: broken }))
  renderPage()
  await gain()
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
  await gain()
  expect(howChosen()).toBeNull()
})
