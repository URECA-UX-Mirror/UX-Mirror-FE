import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toIssueList } from '../src/adapters/issue.ts'
import { toRun } from '../src/adapters/run.ts'
import { toSite } from '../src/adapters/site.ts'
import { toStepList } from '../src/adapters/step.ts'
import { ApiError } from '../src/api/client.ts'
import * as runsApi from '../src/api/runs.ts'
import * as sitesApi from '../src/api/sites.ts'
import type { IssueList, Run, Step } from '../src/domain/types.ts'
import { RunPage } from '../src/features/run-result/RunPage.tsx'
import { MAX_STEPS_RETRIES } from '../src/features/run-progress/useRunProgress.ts'
import { buildIssues, buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import { SITES } from '../src/mocks/fixtures/sites.ts'
import { findRun, type RunRecord } from '../src/mocks/store.ts'

vi.mock('../src/api/runs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api/runs.ts')>()),
  getRun: vi.fn(),
  getRunSteps: vi.fn(),
  getRunIssues: vi.fn(),
}))
vi.mock('../src/api/sites.ts', () => ({ listSites: vi.fn() }))
const getRun = vi.mocked(runsApi.getRun)
const getRunSteps = vi.mocked(runsApi.getRunSteps)
const getRunIssues = vi.mocked(runsApi.getRunIssues)
const listSites = vi.mocked(sitesApi.listSites)

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

const RECORD: RunRecord = {
  runId: 'run_t',
  experimentKey: 'k',
  variant: 'before',
  goalId: 'refund',
  personaId: 'novice-shopper',
  maxSteps: 5,
  createdAtMs: 0,
}
const runOf = (status: string): Run => ({ ...toRun(buildRun(RECORD, 0)), status })
const stepsOf = (count: number, rec = RECORD): Step[] =>
  toStepList({ runId: rec.runId, count, items: buildSteps(rec, count) })
const doneRun = (rec: RunRecord): Run => toRun(buildRun(rec, FAR_FUTURE))
const doneSteps = (rec: RunRecord): Step[] => {
  const items = buildSteps(rec, 15)
  return toStepList({ runId: rec.runId, count: items.length, items })
}
const NO_ISSUES: IssueList = { runId: 'x', analysisStatus: 'COMPLETED', items: [] }

const serverError = () => new ApiError({ status: 503, code: 'X', message: '일시 오류', retryable: true })
const notFound = () =>
  new ApiError({ status: 404, code: 'RUN_NOT_FOUND', message: '실행을 찾을 수 없습니다', retryable: false })

function renderPage(runId = RECORD.runId, entry = `/runs/${runId}`) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/runs/:runId" element={<RunPage />} />
        <Route path="/runs/:runId/result" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const flush = () => act(() => vi.advanceTimersByTimeAsync(0))
const tick = (ms = 1000) => act(() => vi.advanceTimersByTimeAsync(ms))

/** 접힌 상자를 펼친다(jsdom은 summary 클릭으로 열리지 않을 수 있다) */
function expand(name: string) {
  const summary = screen.getByText(name, { selector: 'summary' })
  const details = summary.closest('details') as HTMLDetailsElement
  act(() => {
    details.open = true
    details.dispatchEvent(new Event('toggle'))
  })
  return details
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  getRunIssues.mockResolvedValue(NO_ISSUES)
  listSites.mockResolvedValue(SITES.map(toSite))
})
afterEach(() => vi.useRealTimers())

describe('진행 중', () => {
  it('지금 화면과 누른 곳을 보이다가, 끝나면 같은 화면에서 결과를 보이고 폴링을 멈춘다', async () => {
    getRun
      .mockResolvedValueOnce(runOf('READY'))
      .mockResolvedValueOnce(runOf('RUNNING'))
      .mockResolvedValue(doneRun(RECORD))
    getRunSteps
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(stepsOf(1))
      .mockResolvedValue(doneSteps(RECORD))
    renderPage()
    await flush()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('진단')
    expect(screen.getByText('시작 준비 중')).toBeTruthy()
    expect(screen.getByText(/첫 화면을 보고 있어요/)).toBeTruthy()

    await tick()
    const live = screen.getByRole('region', { name: '지금 진단 중' })
    expect(within(live).getByText('2번째 클릭 중 · 최대 5번')).toBeTruthy()
    expect(within(live).getByRole('img').getAttribute('src')).toMatch(/\/screenshots\/1\?kind=original$/)
    expect(within(live).getByRole('list', { name: '지금까지 누른 곳' }).textContent).toMatch(/^1\. '.+' 누름$/)
    // 진행 중에는 결과·지표·버튼이 없다
    expect(within(live).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('region', { name: '진단 요약' })).toBeNull()

    await tick()
    expect(screen.getByText('도착함')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '지금 진단 중' })).toBeNull()
    expect(screen.getByRole('region', { name: '진단 요약' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '지나간 길' })).toBeTruthy()

    const calls = getRun.mock.calls.length
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(calls)
  })

  it('없는 진단이면 멈추고 새로 진단하기 링크를 보인다', async () => {
    getRun.mockRejectedValue(notFound())
    renderPage()
    await flush()
    expect(screen.getByText('진단을 찾을 수 없어요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '새로 진단하기' }).getAttribute('href')).toBe('/')
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(1)
  })

  it('계속 실패하면 "불러오지 못했어요"와 다시 시도를 보이고, 다시 시도하면 이어서 불러온다', async () => {
    getRun.mockRejectedValue(serverError())
    renderPage()
    await flush()
    expect(screen.getByText('다시 연결하는 중이에요')).toBeTruthy()
    await tick(60_000)
    expect(screen.getByRole('alert').textContent).toContain('불러오지 못했어요')
    expect(screen.getByRole('alert').textContent).not.toContain('일시 오류')

    getRun.mockResolvedValue(runOf('RUNNING'))
    getRunSteps.mockResolvedValue(stepsOf(2))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(screen.getByText('AI 고객이 둘러보는 중')).toBeTruthy()
  })

  it('끝났는데 클릭 기록만 계속 실패하면 한도까지만 다시 불러오고, 다시 시도로 복구한다', async () => {
    getRun.mockResolvedValue(doneRun(RECORD))
    getRunSteps.mockRejectedValue(serverError())
    renderPage()
    await flush()
    expect(screen.getByText('도착함')).toBeTruthy()
    await tick(60_000)
    expect(getRunSteps).toHaveBeenCalledTimes(MAX_STEPS_RETRIES)
    expect(screen.getByRole('alert').textContent).toContain('클릭 기록을 불러오지 못했어요')

    getRunSteps.mockResolvedValue(doneSteps(RECORD))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(screen.queryByText('클릭 기록을 불러오지 못했어요')).toBeNull()
    expect(screen.getByText('클릭별로 자세히 보기')).toBeTruthy()
  })

  it('화면을 떠나면 요청을 취소한다', async () => {
    let signal: AbortSignal | undefined
    getRun.mockImplementation((_id, s) => {
      signal = s
      return new Promise<Run>(() => {})
    })
    const { unmount } = renderPage()
    await flush()
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})

describe('끝난 진단', () => {
  const goback = findRun('run_mock_goback')!

  async function showDone(rec: RunRecord, run = doneRun(rec), entry?: string) {
    getRun.mockResolvedValue(run)
    getRunSteps.mockResolvedValue(doneSteps(rec))
    renderPage(rec.runId, entry)
    await flush()
  }

  it('머리에 고객·하려는 일을 한 줄로 보이고, 코드값이나 지표 용어는 보이지 않는다', async () => {
    await showDone(goback, doneRun(goback), `/runs/${goback.runId}/result`)
    const run = doneRun(goback)
    expect(screen.getByText(new RegExp(`· ${run.goal}$`))).toBeTruthy()
    expect(screen.getByText('MORO MARKET 지금 화면')).toBeTruthy()
    const text = document.body.textContent ?? ''
    expect(text.replace(/MORO MARKET|AI/g, '')).not.toMatch(/[A-Za-z]{2,}/)
    expect(text).not.toMatch(/엔트로피|margin|기준 경로|해당|되었습니다/)
  })

  it('지나간 길은 화면 이름을 순서대로 보이고 돌아온 화면을 표시한다', async () => {
    await showDone(goback)
    const path = screen.getByRole('region', { name: '지나간 길' })
    const nodes = within(path).getAllByRole('listitem').map((li) => li.textContent)
    // 홈 → 마이페이지 → (돌아옴) 홈 → 주문·배송 조회 → 환불 신청
    expect(nodes).toEqual(['홈', '마이페이지', '홈돌아옴', '주문·배송 조회', '환불 신청도착'])
  })

  it('클릭별 자세히 보기는 접혀 있다가 펼치면 클릭마다 화면과 누를 가능성을 보인다', async () => {
    await showDone(goback)
    expect(document.querySelector('img')).toBeNull()
    const details = expand('클릭별로 자세히 보기')
    const steps = within(details).getAllByRole('listitem', { name: /번째 클릭$/ })
    expect(steps.length).toBe(doneSteps(goback).length)
    expect(within(steps[0]).getByRole('heading').textContent).toMatch(/^1\. 홈에서 '.+' 누름$/)
    expect(within(steps[0]).getByRole('img').getAttribute('src')).toMatch(/\/screenshots\/1\?kind=original$/)
    expect(steps[0].querySelector('.candidate-selected')).toBeTruthy()
    // 목표 화면에 도착한 진단은 도착한 화면도 보인다
    const goal = within(details).getByRole('listitem', { name: '도착한 화면' })
    expect(within(goal).getByRole('img').getAttribute('src')).toMatch(/\/screenshots\/goal$/)
  })

  it('살펴볼 점은 있을 때만 접힌 채로 보인다', async () => {
    getRunIssues.mockResolvedValue(toIssueList(buildIssues(goback, FAR_FUTURE)))
    await showDone(goback)
    const count = toIssueList(buildIssues(goback, FAR_FUTURE)).items.length
    expect(count).toBeGreaterThan(0)
    const details = expand(`살펴볼 점 ${count}개`)
    expect(within(details).getAllByRole('listitem')).toHaveLength(count)
  })

  it('살펴볼 점이 없으면 그 상자를 만들지 않는다', async () => {
    await showDone(goback)
    expect(screen.queryByText(/살펴볼 점/)).toBeNull()
  })

  it('다른 사이트 진단은 사이트 이름과 그 사이트의 화면 이름을 쓰고 AI 버튼이 없다', async () => {
    const scenario: RunRecord = {
      runId: 'scenario', experimentKey: 'scenario-key', variant: 'before', siteId: 'demo-no-map',
      goalId: null, goal: '공지사항 찾기', personaId: null, persona: '방문자', reference: 'none',
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/notice', text: '공지사항', exact: false, scope: 'page' },
      maxSteps: 5, createdAtMs: 0,
    }
    await showDone(scenario)
    await flush()
    expect(screen.getByText('방문자 · 공지사항 찾기')).toBeTruthy()
    expect(screen.getByText('지도 없는 데모 사이트 진단')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '지나간 길' })).getAllByRole('listitem')[0].textContent).toBe('홈')
    expect(screen.queryByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeNull()
  })

  it('AI 개선을 확인하는 진단도 보이고, 바꾼 이름을 알려 주며 AI 버튼은 없다', async () => {
    const run = {
      ...doneRun(goback),
      variant: 'after',
      improvementContext: { improvementId: 'imp-1', goalId: 'S1', label: '주문 환불', siteInstanceId: 's', executionRole: 'CANDIDATE' },
    } as Run
    await showDone(goback, run)
    expect(screen.getByText("메뉴 이름을 '주문 환불'로 바꿔 본 화면")).toBeTruthy()
    expect(screen.getByRole('region', { name: '진단 요약' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeNull()
  })

  it('보통 진단에는 "AI에게 고쳐 달라고 하기"가 있다', async () => {
    const maxsteps = findRun('run_mock_maxsteps')!
    await showDone(maxsteps)
    expect(screen.getByRole('button', { name: 'AI에게 고쳐 달라고 하기' })).toBeTruthy()
  })
})
