import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import type { ImprovementJobDto } from '../src/api/improvements.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { IMPROVEMENT_POLL_MS } from '../src/features/improvement/useImprovement.ts'
import { errorResponse } from '../src/mocks/errors.ts'
import { server } from './setup.ts'

// AI 개선 결과 화면: GET /api/improvements/{id}(BE #130)로 읽고, 진행 중이면 다시 읽는다

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const improved = (): Json =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8'))

const LIMITATION = /AI 고객 기준 결과예요\. 실제 사람의 클릭률은 아니니/

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

afterEach(() => { vi.useRealTimers() })

it('불러오는 동안 안내하고, 끝난 결과는 개선 효과·다시 확인·회차·접힌 점수 계산·한계 안내를 보인다', async () => {
  serve(job())
  renderPage()
  expect(screen.getByRole('status').textContent).toContain('불러오는 중이에요')
  expect(await screen.findByRole('region', { name: '개선 효과' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: 'AI 개선 결과' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '개선안에서 다시 확인한 결과' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '개선 회차' })).toBeTruthy()
  const details = screen.getByText('점수 계산 자세히 보기').closest('details')!
  expect(details.open).toBe(false)
  expect(screen.getByText(LIMITATION)).toBeTruthy()
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  // 개발용 id나 상태 코드는 보이지 않는다
  expect(document.body.textContent).not.toContain('imp_T')
  expect(document.body.textContent).not.toContain('COMPLETED')
})

it.each([
  ['LIVE', '직접 실행한 결과'],
  ['OFFICIAL', '사전 등록 공식 결과'],
])('kind %s는 %s 표시를 붙인다', async (kind, label) => {
  serve(job({ kind }))
  renderPage()
  expect(await screen.findByText(label)).toBeTruthy()
})

it('kind가 없으면 표시를 붙이지 않는다', async () => {
  serve(job({ kind: undefined }))
  renderPage()
  await screen.findByRole('region', { name: '개선 효과' })
  expect(document.querySelector('.experiment-tag')).toBeNull()
})

it('입력 줄에 고객·할 일·도착 화면 이름을 보이고, 진단에서 왔으면 처음 진단 링크를 둔다', async () => {
  serve(job({ input: { goal: '환불하고 싶을', persona: '바쁜', goalPage: 'refund', sourceRunId: 'run_1' } }))
  renderPage()
  const line = (await screen.findByText(/고객이/, { selector: 'p' }))
  expect(line.textContent).toContain('바쁜 고객이 환불하고 싶을 때, 환불 신청 화면까지 잘 찾아오도록')
  expect(within(line).getByRole('link', { name: '처음 진단 보기' }).getAttribute('href')).toBe('/runs/run_1/result')
})

it('모르는 도착 화면은 키 그대로, 입력이 없으면 입력 줄을 보이지 않는다', async () => {
  serve(job({ input: { goal: '쿠폰을 찾을', persona: '바쁜', goalPage: 'coupon' } }))
  const first = renderPage()
  expect((await screen.findByText(/고객이/, { selector: 'p' })).textContent).toContain('coupon 화면까지')
  expect(screen.queryByRole('link', { name: '처음 진단 보기' })).toBeNull()
  first.unmount()

  serve(job({ input: null }))
  renderPage()
  await screen.findByRole('region', { name: '개선 효과' })
  expect(document.querySelector('.improvement-question')).toBeNull()
})

it('없는 결과(404)면 찾을 수 없음과 목록 링크를 보인다', async () => {
  renderPage('imp_NONE') // 기본 핸들러: 404 IMPROVEMENT_NOT_FOUND
  expect((await screen.findByRole('alert')).textContent).toBe('AI 개선 결과를 찾을 수 없어요.')
  expect(screen.getByRole('link', { name: 'AI 개선 결과 목록 보기' }).getAttribute('href')).toBe('/improvements')
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
  expect((await screen.findByRole('alert')).textContent).toContain('AI 개선 결과를 불러오지 못했어요')
  expect(document.body.textContent).not.toContain('INTERNAL')
})

it('진행 중이면 단계별 진행 상황을 보이고 리포트·한계 안내는 아직 없다', async () => {
  serve(job({ status: 'RUNNING', phase: 'BUILD_FINAL_SITE', finishedAt: null, improvement: null }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  const steps = within(progress).getAllByRole('listitem')
  expect(steps.map((li) => li.dataset.state)).toEqual(['done', 'doing', 'todo'])
  expect(steps[0].textContent).toContain('문제 버튼을 찾고 새 이름 후보를 시험했어요')
  expect(steps[1].textContent).toContain('개선안 화면을 만드는 중이에요')
  expect(steps[2].textContent).toContain('개선안에서 AI 고객으로 다시 확인하기')
  expect(within(progress).getByRole('status').textContent).toContain('모두 약 5분 걸려요')
  expect(within(progress).getByRole('link', { name: '지난 결과' }).getAttribute('href')).toBe('/improvements')
  expect(screen.queryByRole('region', { name: '개선 효과' })).toBeNull()
  expect(screen.queryByText(LIMITATION)).toBeNull()
})

it('대기 중(QUEUED)이면 모든 단계가 아직 할 일이다', async () => {
  serve(job({ status: 'QUEUED', phase: 'QUEUED', improvement: null }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['todo', 'todo', 'todo'])
})

it('루프가 끝나 리포트가 생긴 뒤에도 진행 중이면 다시 확인한 결과는 아직 보이지 않는다', async () => {
  serve(job({ status: 'RUNNING', phase: 'OFFICIAL_AND_VERIFY' }))
  renderPage()
  const progress = await screen.findByRole('region', { name: '진행 상황' })
  expect(within(progress).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'doing'])
  expect(screen.getByRole('region', { name: '개선 효과' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '개선안에서 다시 확인한 결과' })).toBeNull()
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
  expect(await screen.findByRole('region', { name: '개선 효과' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(calls).toBe(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(IMPROVEMENT_POLL_MS * 3) })
  expect(calls).toBe(2)
})

it.each([
  ['FAILED', 'AI 개선을 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.'],
  ['INTERRUPTED', 'AI 개선이 중간에 멈췄어요. 잠시 뒤 다시 시도해 주세요.'],
])('%s면 사람 말 안내와 서버 안내 문구를 보이고 진행 상황은 없다', async (status, text) => {
  serve(job({ status, phase: 'LOOP', improvement: null, error: { code: 'LOOP_FAILED', message: '후보 평가 중 오류가 났어요.' } }))
  renderPage()
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain(text)
  expect(alert.textContent).toContain('후보 평가 중 오류가 났어요.')
  expect(alert.textContent).not.toContain('LOOP_FAILED')
  expect(screen.queryByRole('region', { name: '진행 상황' })).toBeNull()
  expect(screen.queryByRole('region', { name: '개선 효과' })).toBeNull()
})

it('한 영역의 데이터에 문제가 있어도 그 영역만 안내하고 나머지와 한계 안내는 보인다', async () => {
  const broken = improved()
  delete broken.verification.status
  serve(job({ improvement: broken }))
  renderPage()
  const verification = await screen.findByRole('region', { name: '개선안에서 다시 확인한 결과' })
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
  expect(within(verification).getByRole('alert').textContent).toBe('이 부분을 보여줄 수 없어요.')
  expect(within(screen.getByRole('region', { name: '개선 효과' })).queryByRole('alert')).toBeNull()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('개선 효과 데이터에 문제가 있으면 그 영역만 안내하고 회차는 보인다', async () => {
  const broken = improved()
  delete broken.summary.beforeLabel
  serve(job({ improvement: broken }))
  renderPage()
  const report = await screen.findByRole('region', { name: '개선 효과' })
  expect(within(report).getByRole('alert').textContent).toBe('이 부분을 보여줄 수 없어요.')
  expect(screen.getByRole('region', { name: '개선 회차' })).toBeTruthy()
  expect(screen.getByText(LIMITATION)).toBeTruthy()
})

it('회차 데이터에 문제가 있으면 회차 영역은 숨기고 나머지는 정상이다', async () => {
  const broken = improved()
  delete broken.rounds[0].round
  serve(job({ improvement: broken }))
  renderPage()
  await screen.findByRole('region', { name: '개선 효과' })
  expect(screen.queryByRole('region', { name: '개선 회차' })).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('공식 평가가 없으면(null) 점수 계산 접힌 영역을 보이지 않는다', async () => {
  serve(job({ improvement: { ...improved(), official: null } }))
  renderPage()
  await screen.findByRole('region', { name: '개선 효과' })
  expect(screen.queryByText('점수 계산 자세히 보기')).toBeNull()
})
