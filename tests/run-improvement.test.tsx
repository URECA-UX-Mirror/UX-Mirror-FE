import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementJobDto } from '../src/api/improvements.ts'
import { IMPROVEMENT_POLL_MS } from '../src/features/improvement/useImprovement.ts'
import { RunPage } from '../src/features/run-result/RunPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// 진단 화면 안에서 이어지는 ③ 어떻게 바꾸면 좋을까요 → ④ 바꾸면 얼마나 좋아질까요.
// 진단은 mock 시드(run_mock_maxsteps: 끝난·유효한 MORO MARKET 지금 화면 진단)를 쓰고, AI 개선 API만 바꿔 끼운다.

const RUN_ID = 'run_mock_maxsteps'
const FIX = '어떻게 바꾸면 좋을까요?'
const GAIN = '바꾸면 얼마나 좋아질까요?'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const improved = (): Json =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8'))

function job(over: Partial<ImprovementJobDto> = {}): ImprovementJobDto {
  return {
    improvementId: 'imp-live-1',
    kind: 'LIVE',
    status: 'COMPLETED',
    phase: 'DONE',
    createdAt: '2026-11-19T10:00:00Z',
    startedAt: '2026-11-19T10:00:01Z',
    finishedAt: '2026-11-19T10:05:00Z',
    error: null,
    input: { goal: '환불하고 싶어요', persona: '숨은 고객 유형', goalPage: 'refund', sourceRunId: RUN_ID },
    improvement: improved(),
    ...over,
  }
}

/** 목록 응답의 한 줄 (리포트 대신 요약) */
const listed = (over: Partial<ImprovementJobDto>) => {
  const { improvement: _improvement, ...rest } = job(over)
  return { ...rest, summary: null }
}

function serveList(items: object[]) {
  server.use(http.get(apiUrl('/api/improvements'), () => HttpResponse.json({ items })))
}

/** `GET /api/improvements/{id}` 응답을 호출 순서대로 준다. 요청한 id를 기록한다 */
function serveJob(...responses: ImprovementJobDto[]) {
  const requested: string[] = []
  server.use(http.get(apiUrl('/api/improvements/:improvementId'), ({ params }) => {
    requested.push(String(params.improvementId))
    return HttpResponse.json(responses[Math.min(requested.length, responses.length) - 1])
  }))
  return requested
}

function renderRun() {
  return render(
    <MemoryRouter initialEntries={[`/runs/${RUN_ID}`]}>
      <Routes>
        <Route path="/runs/:runId" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const step = (name: string) => screen.findByRole('region', { name })
const answerOf = (region: HTMLElement) => region.querySelector('.tl-answer')?.textContent ?? null
const startButton = () => screen.findByRole('button', { name: 'AI에게 개선안 받아 보기' })

afterEach(() => { vi.useRealTimers() })

it('③ 에서 시작하면 그 자리에 진행 단계가 보이고, 끝나면 ③ 바꿀 이름과 ④ 가능성 전후가 채워진다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  serveList([])
  const posted: unknown[] = []
  server.use(http.post(apiUrl('/api/improvements'), async ({ request }) => {
    posted.push(await request.json())
    return HttpResponse.json(job({ status: 'QUEUED', phase: 'QUEUED', finishedAt: null, improvement: null }), { status: 202 })
  }))
  const requested = serveJob(
    job({ status: 'RUNNING', phase: 'LOOP', finishedAt: null, improvement: null }),
    job(),
  )
  renderRun()
  fireEvent.click(await startButton())
  await waitFor(() => expect(posted).toEqual([{ sourceRunId: RUN_ID }]))

  // 다른 화면으로 가지 않고 ③ 안에 진행 단계가 보인다
  const progress = await screen.findByRole('list', { name: '진행 상황' })
  const fix = await step(FIX)
  expect(fix.contains(progress)).toBe(true)
  expect(answerOf(fix)).toBe('AI가 개선안을 찾는 중이에요')
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['doing', 'todo', 'todo'])
  expect(fix.textContent).toContain('5분쯤 걸려요')
  expect(screen.queryByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeNull()
  expect((await step(GAIN)).textContent).toBe(GAIN)

  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS) })
  await waitFor(async () => expect(answerOf(await step(FIX))).toBe("상단 메뉴 '이용정보' → '주문내역'"))
  const gain = await step(GAIN)
  expect(answerOf(gain)).toBe('38.5% → 70.1%+31.6%p')
  // 가장 중요한 숫자(바뀐 뒤 가능성)만 강조한다
  expect(gain.querySelector('.score-change-big strong')?.textContent).toBe('70.1%')
  expect(within(gain).getByRole('group', { name: '다른 목표' }).querySelector('p')?.textContent).toBe('다른 목표도 괜찮아요.')
  expect([...gain.querySelectorAll('.imp-verification > .recheck .recheck-row')].map((row) => row.textContent)).toEqual(['지금 화면못 찾음', '개선안2번 만에 도착'])
  expect(within(gain).getAllByRole('link', { name: '화면별로 비교하기' })[0].getAttribute('href')).toBe('/comparisons/imp-1119-s1')
  expect(within(gain).getByText('어떻게 골랐는지 보기').closest('details')?.open).toBe(false)
  expect(gain.textContent).toContain('심사위원 실행 (공식 기록 아님)')
  expect(requested).toEqual(['imp-live-1', 'imp-live-1'])

  // id·코드·숨긴 고객 유형은 화면에 없다
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(/imp-live|run_mock|COMPLETED|LIVE|LOOP|S1|S4|숨은 고객 유형/)
  expect(text).not.toMatch(/고치|고쳐|고친/)
})

it('이 진단에서 전에 받은 개선안가 있으면 다시 열었을 때 가장 최근 것을 바로 보이고 새로 시작하지 않는다', async () => {
  let posted = false
  server.use(http.post(apiUrl('/api/improvements'), () => { posted = true; return errorResponse(500, 'X', 'x') }))
  serveList([
    listed({ improvementId: 'imp-other', createdAt: '2026-11-19T12:00:00Z', input: { goal: 'g', persona: 'p', goalPage: 'refund', sourceRunId: 'run_other' } }),
    listed({ improvementId: 'imp-old', createdAt: '2026-11-19T09:00:00Z' }),
    listed({ improvementId: 'imp-new', createdAt: '2026-11-19T11:00:00Z' }),
    listed({ improvementId: 'imp-official', createdAt: '2026-11-19T13:00:00Z', input: null }),
  ])
  const requested = serveJob(job({ improvementId: 'imp-new' }))
  renderRun()
  await waitFor(async () => expect(answerOf(await step(FIX))).toBe("상단 메뉴 '이용정보' → '주문내역'"))
  expect(answerOf(await step(GAIN))).toBe('38.5% → 70.1%+31.6%p')
  expect(requested).toEqual(['imp-new'])
  expect(screen.queryByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeNull()
  expect(posted).toBe(false)
})

it('다시 열었을 때 아직 개선안을 찾는 중이면 진행 단계를 이어서 보인다', async () => {
  serveList([listed({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY' })])
  serveJob(job({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY', finishedAt: null }))
  renderRun()
  const progress = await screen.findByRole('list', { name: '진행 상황' })
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'doing'])
  // 확정 전 후보는 권하지 않는다
  const fix = await step(FIX)
  expect(fix.textContent).toContain("지금까지 찾은 이름: '이용정보' → '주문내역'")
  expect(fix.textContent).toContain('아직 확정 아니에요')
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요/)
  expect((await step(GAIN)).textContent).toBe(GAIN)
})

it('끝내지 못한 결과는 후보를 권하지 않고, 개선안을 다시 받아 볼 수 있다', async () => {
  serveList([listed({ status: 'FAILED', phase: 'OFFICIAL_AND_VERIFY' })])
  serveJob(job({ status: 'FAILED', phase: 'OFFICIAL_AND_VERIFY', error: { code: 'LOOP_FAILED', message: 'trace' } }))
  let posted = 0
  server.use(http.post(apiUrl('/api/improvements'), () => {
    posted += 1
    return HttpResponse.json(job({ improvementId: 'imp-live-2', status: 'QUEUED', phase: 'QUEUED', improvement: null }), { status: 202 })
  }))
  renderRun()
  await waitFor(async () => expect(answerOf(await step(FIX))).toBe('끝내지 못했어요'))
  const fix = await step(FIX)
  expect(fix.textContent).toContain('확인을 끝내지 못해 확정 아니에요. 이 이름은 권하지 않아요.')
  expect(document.body.textContent).not.toMatch(/바꿔 보세요|반영해 보세요|LOOP_FAILED|trace/)
  expect(screen.queryByRole('region', { name: GAIN })).toBeNull()

  const requested = serveJob(job({ improvementId: 'imp-live-2', status: 'RUNNING', phase: 'LOOP', finishedAt: null, improvement: null }))
  fireEvent.click(within(fix).getByRole('button', { name: '개선안 다시 받아 보기' }))
  expect(await screen.findByRole('list', { name: '진행 상황' })).toBeTruthy()
  expect(posted).toBe(1)
  expect(requested).toEqual(['imp-live-2'])
})

it('시작하지 못하면 ③ 에 이유를 보이고 버튼은 그대로 둔다', async () => {
  serveList([])
  server.use(http.post(apiUrl('/api/improvements'), () => errorResponse(409, 'RUN_ALREADY_ACTIVE', 'Run run_x is active', true)))
  renderRun()
  fireEvent.click(await startButton())
  const fix = await step(FIX)
  expect((await within(fix).findByRole('alert')).textContent).toBe('다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.')
  expect(document.body.textContent).not.toContain('run_x')
  expect((await startButton() as HTMLButtonElement).disabled).toBe(false)
})

it('시작이 409로 실패했는데 이 진단의 개선안이 이미 만들어져 있으면(다른 탭·응답 유실) 그것을 이어서 보인다', async () => {
  let lists = 0
  server.use(http.get(apiUrl('/api/improvements'), () => {
    lists += 1
    return HttpResponse.json({ items: lists === 1 ? [] : [listed({ improvementId: 'imp-elsewhere', status: 'RUNNING', phase: 'LOOP' })] })
  }))
  server.use(http.post(apiUrl('/api/improvements'), () => errorResponse(409, 'RUN_ALREADY_ACTIVE', '자동 개선이 이미 진행 중입니다.', true)))
  const requested = serveJob(job({ improvementId: 'imp-elsewhere', status: 'RUNNING', phase: 'LOOP', finishedAt: null, improvement: null }))
  renderRun()
  fireEvent.click(await startButton())
  // 시작 버튼에 머물지 않고 진행 단계로 넘어간다
  expect(await screen.findByRole('list', { name: '진행 상황' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeNull()
  expect(requested).toEqual(['imp-elsewhere'])
  expect(lists).toBe(2)
})

it('가장 최근 것이 끝내지 못한 것이어도 전에 끝난 결과가 있으면 그 결과를 보이고, 다시 받아 보기를 둔다', async () => {
  serveList([
    listed({ improvementId: 'imp-failed', status: 'FAILED', phase: 'LOOP', createdAt: '2026-11-19T12:00:00Z' }),
    listed({ improvementId: 'imp-done', createdAt: '2026-11-19T10:00:00Z' }),
    listed({ improvementId: 'imp-older-failed', status: 'INTERRUPTED', createdAt: '2026-11-19T09:00:00Z' }),
  ])
  const requested = serveJob(job({ improvementId: 'imp-done' }))
  renderRun()
  await waitFor(async () => expect(answerOf(await step(FIX))).toBe("상단 메뉴 '이용정보' → '주문내역'"))
  expect(answerOf(await step(GAIN))).toBe('38.5% → 70.1%+31.6%p')
  expect(requested).toEqual(['imp-done'])
  const fix = await step(FIX)
  expect(fix.textContent).toContain('다시 받아 보던 개선안은 끝내지 못했어요. 전에 받은 결과예요.')
  expect(within(fix).getByRole('button', { name: '개선안 다시 받아 보기' })).toBeTruthy()
})

it('가장 최근 것이 끝난 결과면 다시 받아 보기를 두지 않는다', async () => {
  serveList([listed({ improvementId: 'imp-done' }), listed({ improvementId: 'imp-old-failed', status: 'FAILED', createdAt: '2026-11-19T08:00:00Z' })])
  serveJob(job({ improvementId: 'imp-done' }))
  renderRun()
  await waitFor(async () => expect(answerOf(await step(FIX))).toBe("상단 메뉴 '이용정보' → '주문내역'"))
  expect(screen.queryByRole('button', { name: '개선안 다시 받아 보기' })).toBeNull()
})
