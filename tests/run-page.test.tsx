import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toIssueList } from '../src/adapters/issue.ts'
import { toRun } from '../src/adapters/run.ts'
import { toSite } from '../src/adapters/site.ts'
import { toStepList } from '../src/adapters/step.ts'
import { ApiError } from '../src/api/client.ts'
import * as improvementsApi from '../src/api/improvements.ts'
import * as runsApi from '../src/api/runs.ts'
import * as sitesApi from '../src/api/sites.ts'
import type { IssueList, Run, Step } from '../src/domain/types.ts'
import { RunPage } from '../src/features/run-result/RunPage.tsx'
import { MAX_STEPS_RETRIES, MAX_VALIDITY_WAITS } from '../src/features/run-progress/useRunProgress.ts'
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
// AI 개선과 이어지는 흐름은 tests/run-improvement.test.tsx가 MSW로 확인한다. 여기서는 "전에 받은 개선안 없음"으로 둔다
vi.mock('../src/api/improvements.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api/improvements.ts')>()),
  listImprovements: vi.fn(),
}))
const getRun = vi.mocked(runsApi.getRun)
const getRunSteps = vi.mocked(runsApi.getRunSteps)
const getRunIssues = vi.mocked(runsApi.getRunIssues)
const listSites = vi.mocked(sitesApi.listSites)
const listImprovements = vi.mocked(improvementsApi.listImprovements)

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

const step = (name: string) => screen.getByRole('region', { name })
const stepState = (name: string) => step(name).closest('li')?.dataset.state
const answerOf = (name: string) => step(name).querySelector('.tl-answer')?.textContent ?? null
const FIND = '잘 찾아가나요?'
const WHY = '왜 그랬을까요?'
const FIX = '어떻게 바꾸면 좋을까요?'
const GAIN = '바꾸면 얼마나 좋아질까요?'

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
  listImprovements.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('진행 중', () => {
  it('① 에 지금 화면과 누른 곳을 보이고 뒤 단계는 질문만 있다가, 끝나면 같은 화면에서 채워지고 폴링을 멈춘다', async () => {
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
    // 제목은 하려는 일이다
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(runOf('READY').goal)
    expect(answerOf(FIND)).toBe('곧 시작해요')
    expect(screen.getByText(/첫 화면을 보고 있어요/)).toBeTruthy()
    expect(stepState(FIND)).toBe('current')
    // 뒤 단계는 질문만 흐리게 있다
    for (const name of [WHY, FIX, GAIN]) {
      expect(stepState(name)).toBe('upcoming')
      expect(step(name).textContent).toBe(name)
    }

    await tick()
    const live = step(FIND)
    expect(answerOf(FIND)).toBe('AI가 찾아보는 중이에요')
    expect(within(live).getByText('2번째 클릭 중 · 최대 5번')).toBeTruthy()
    expect(within(live).getByRole('img').getAttribute('src')).toMatch(/\/screenshots\/1\?kind=original$/)
    expect(within(live).getByRole('list', { name: '지금까지 누른 곳' }).textContent).toMatch(/^1\. '.+' 누름$/)
    // 진행 중에는 버튼이 없고, 전에 받은 개선안도 조회하지 않는다
    expect(screen.queryByRole('button')).toBeNull()
    expect(listImprovements).not.toHaveBeenCalled()

    await tick()
    expect(stepState(FIND)).toBe('done')
    expect(answerOf(FIND)).toMatch(/^\d+번 만에 찾았어요$/)
    expect(within(step(FIND)).getByRole('list', { name: '지나간 길' })).toBeTruthy()
    expect(stepState(WHY)).toBe('done')
    expect(stepState(FIX)).toBe('current')
    expect(stepState(GAIN)).toBe('upcoming')

    const calls = getRun.mock.calls.length
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(calls)
  })

  it('없는 진단이면 멈추고 새 진단 링크를 보인다', async () => {
    getRun.mockRejectedValue(notFound())
    renderPage()
    await flush()
    expect(screen.getByText('진단을 찾을 수 없어요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '새 진단 하러 가기' }).getAttribute('href')).toBe('/')
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
    expect(answerOf(FIND)).toBe('AI가 찾아보는 중이에요')
  })

  it('끝났는데 클릭 기록만 계속 실패하면 한도까지만 다시 불러오고, 다시 시도로 복구한다', async () => {
    getRun.mockResolvedValue(doneRun(RECORD))
    getRunSteps.mockRejectedValue(serverError())
    renderPage()
    await flush()
    expect(answerOf(FIND)).toMatch(/찾았어요$/)
    await tick(60_000)
    expect(getRunSteps).toHaveBeenCalledTimes(MAX_STEPS_RETRIES)
    expect(screen.getByRole('alert').textContent).toContain('클릭 기록을 불러오지 못했어요')

    getRunSteps.mockResolvedValue(doneSteps(RECORD))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(screen.queryByText(/클릭 기록을 불러오지 못했어요/)).toBeNull()
    expect(screen.getByText('클릭별로 자세히 보기')).toBeTruthy()
  })

  it('끝났는데 유효 여부가 아직 없으면(서버가 조금 뒤에 채운다) 더 조회하고, 채워지면 ③④ 를 보이고 멈춘다', async () => {
    const maxsteps = findRun('run_mock_maxsteps')!
    const pending = { ...doneRun(maxsteps), validity: null }
    getRun.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValue(doneRun(maxsteps))
    getRunSteps.mockResolvedValue(doneSteps(maxsteps))
    renderPage(maxsteps.runId)
    await flush()
    // 결과는 보이지만 유효한지 모르는 동안에는 개선안 단계를 열지 않는다
    expect(answerOf(FIND)).toBe('못 찾았어요')
    expect(screen.queryByRole('region', { name: FIX })).toBeNull()
    expect(listImprovements).not.toHaveBeenCalled()
    await tick(5000)
    expect(within(step(FIX)).getByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeTruthy()
    const calls = getRun.mock.calls.length
    expect(calls).toBe(3)
    await tick(20_000)
    expect(getRun).toHaveBeenCalledTimes(calls)
  })

  it('유효 여부가 끝내 오지 않으면 정해진 횟수까지만 조회하고 멈춘다', async () => {
    const maxsteps = findRun('run_mock_maxsteps')!
    getRun.mockResolvedValue({ ...doneRun(maxsteps), validity: null })
    getRunSteps.mockResolvedValue(doneSteps(maxsteps))
    renderPage(maxsteps.runId)
    await flush()
    await tick(120_000)
    expect(getRun).toHaveBeenCalledTimes(MAX_VALIDITY_WAITS + 1)
    expect(screen.queryByRole('region', { name: FIX })).toBeNull()
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
  const maxsteps = findRun('run_mock_maxsteps')!

  async function showDone(rec: RunRecord, run = doneRun(rec), entry?: string) {
    getRun.mockResolvedValue(run)
    getRunSteps.mockResolvedValue(doneSteps(rec))
    renderPage(rec.runId, entry)
    await flush()
  }

  it('머리에는 하려는 일과 찾을 화면만 보이고, 고객 유형·코드값·지표 용어는 보이지 않는다', async () => {
    await showDone(goback, doneRun(goback), `/runs/${goback.runId}/result`)
    const run = doneRun(goback)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(run.goal)
    expect(screen.getByText('MORO MARKET · 찾을 화면 환불 신청')).toBeTruthy()
    const text = document.body.textContent ?? ''
    expect(text).not.toContain(run.persona)
    expect(text).not.toMatch(/고객이|이 고객|고객 유형/)
    expect(text.replace(/MORO MARKET|AI/g, '')).not.toMatch(/[A-Za-z]{2,}/)
    expect(text).not.toContain(run.runId)
    expect(text).not.toMatch(/엔트로피|margin|기준 경로|해당|되었습니다/)
  })

  it('① 못 찾은 진단은 "못 찾았어요"와 지나간 길, ② 는 실제 값에서 나온 이유와 첫 화면 가능성 막대를 보인다', async () => {
    await showDone(maxsteps)
    expect(answerOf(FIND)).toBe('못 찾았어요')
    expect(step(FIND).querySelector('.tl-answer')?.getAttribute('data-tone')).toBe('bad')
    const why = step(WHY)
    expect(answerOf(WHY)).toBe('정해진 클릭 수 안에 찾지 못했어요')
    const first = doneSteps(maxsteps)[0]
    const chosen = first.candidates.find((c) => c.selected)!
    expect(why.textContent).toContain(`첫 화면에서는 '${chosen.label}'`)
    const bars = within(why).getByRole('region', { name: '첫 화면에서 누를 가능성' })
    const rows = within(bars).getAllByRole('listitem')
    // 위에서 네 개 + AI가 이름을 바꿀 수 있는 메뉴(네 개 안에 없으면 한 줄 더)
    expect(rows).toHaveLength(5)
    expect(rows[4].textContent).toBe('이용정보바꿀 수 있어요11%')
    expect(within(bars).getAllByText('바꿀 수 있어요')).toHaveLength(1)
    const top = [...first.candidates].sort((a, b) => b.probability - a.probability)[0]
    expect(rows[0].textContent).toBe(`${top.label}${Math.round(top.probability * 100)}%`)
    expect(document.body.textContent).not.toMatch(/MAX_STEPS/)
  })

  it('무효로 끝난 진단은 "진단을 끝내지 못했어요"만 보이고 뒤 단계가 없다', async () => {
    const invalid = findRun('run_mock_invalid')!
    await showDone(invalid)
    expect(answerOf(FIND)).toBe('진단을 끝내지 못했어요')
    expect(step(FIND).textContent).toContain('이 진단은 결과로 쓸 수 없어요.')
    expect(within(step(FIND)).getByRole('link', { name: '다시 진단해 주세요.' }).getAttribute('href')).toBe('/')
    for (const name of [WHY, FIX, GAIN]) expect(screen.queryByRole('region', { name })).toBeNull()
    expect(listImprovements).not.toHaveBeenCalled()
  })

  it('지나간 길은 화면 이름을 순서대로 보이고 돌아온 화면을 표시한다', async () => {
    await showDone(goback)
    const nodes = within(screen.getByRole('list', { name: '지나간 길' })).getAllByRole('listitem').map((li) => li.textContent)
    // 홈 → 마이페이지 → (돌아옴) 홈 → 주문·배송 조회 → 환불 신청
    expect(nodes).toEqual(['홈', '마이페이지', '홈 (돌아옴)', '주문·배송 조회', '환불 신청'])
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

  it('살펴볼 점은 있을 때만 ② 안에 접힌 채로 보인다', async () => {
    getRunIssues.mockResolvedValue(toIssueList(buildIssues(goback, FAR_FUTURE)))
    await showDone(goback)
    const count = toIssueList(buildIssues(goback, FAR_FUTURE)).items.length
    expect(count).toBeGreaterThan(0)
    const details = expand(`살펴볼 점 ${count}개`)
    expect(step(WHY).contains(details)).toBe(true)
    expect(within(details).getAllByRole('listitem')).toHaveLength(count)
  })

  it('살펴볼 점이 없으면 그 접힘을 만들지 않는다', async () => {
    await showDone(goback)
    expect(screen.queryByText(/살펴볼 점/)).toBeNull()
  })

  it('등록 사이트 진단은 사이트 이름과 그 사이트의 화면 이름을 쓰고 ③④ 가 없다', async () => {
    const scenario: RunRecord = {
      runId: 'scenario', experimentKey: 'scenario-key', variant: 'before', siteId: 'demo-no-map',
      goalId: null, goal: '공지사항 찾기', personaId: null, persona: '방문자', reference: 'none',
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/notice', text: '공지사항', exact: false, scope: 'page' },
      maxSteps: 5, createdAtMs: 0,
    }
    await showDone(scenario)
    await flush()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('공지사항 찾기')
    expect(document.querySelector('.report-eyebrow')?.textContent).toMatch(/^지도 없는 데모 사이트/)
    expect(document.body.textContent).not.toContain('방문자')
    expect(within(screen.getByRole('list', { name: '지나간 길' })).getAllByRole('listitem')[0].textContent).toBe('홈')
    expect(screen.getByRole('region', { name: WHY })).toBeTruthy()
    expect(screen.queryByText('바꿀 수 있어요')).toBeNull()
    expect(screen.getByText('개선안 받아 보기는 지금 예시 쇼핑몰에서만 돼요.')).toBeTruthy()
    for (const name of [FIX, GAIN]) expect(screen.queryByRole('region', { name })).toBeNull()
    expect(screen.queryByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeNull()
    expect(listImprovements).not.toHaveBeenCalled()
  })

  it('개선안 화면을 확인한 진단도 열리고, 바꾼 이름을 알려 주며 ③④ 는 없다', async () => {
    const run = {
      ...doneRun(goback),
      variant: 'after',
      improvementContext: { improvementId: 'imp-1', goalId: 'S1', label: '주문 환불', siteInstanceId: 's', executionRole: 'CANDIDATE' },
    } as Run
    await showDone(goback, run)
    expect(document.querySelector('.report-eyebrow')?.textContent).toBe("메뉴 이름을 '주문 환불'로 바꿔 본 화면 · 찾을 화면 환불 신청")
    expect(answerOf(FIND)).toMatch(/찾았어요$/)
    for (const name of [FIX, GAIN]) expect(screen.queryByRole('region', { name })).toBeNull()
    expect(screen.queryByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeNull()
  })

  it('개선안 확인용 진단 가운데 기준 실행(이름을 바꾸지 않은 화면)은 "바꿔 본 화면"이라고 하지 않는다', async () => {
    const run = {
      ...doneRun(goback),
      improvementContext: { improvementId: 'imp-1', goalId: 'S1', label: '이용정보', siteInstanceId: 's', executionRole: 'BASELINE' },
    } as Run
    await showDone(goback, run)
    expect(document.querySelector('.report-eyebrow')?.textContent).toBe('MORO MARKET (지금 화면) · 찾을 화면 환불 신청')
    expect(document.body.textContent).not.toContain('바꿔 본 화면')
    for (const name of [FIX, GAIN]) expect(screen.queryByRole('region', { name })).toBeNull()
  })

  it('보통 진단은 ③ 에 "AI에게 개선안 받아 보기"가 있고 ④ 는 질문만 있다', async () => {
    await showDone(maxsteps)
    expect(listImprovements).toHaveBeenCalledTimes(1)
    expect(within(step(FIX)).getByRole('button', { name: 'AI에게 개선안 받아 보기' })).toBeTruthy()
    expect(screen.queryByText(/예시 쇼핑몰에서만/)).toBeNull()
    expect(step(FIX).textContent).toContain('5분쯤 걸려요')
    expect(step(GAIN).textContent).toBe(GAIN)
  })

  it('전에 받은 개선안을 확인하지 못하면 알리고 다시 확인할 수 있다', async () => {
    listImprovements.mockRejectedValueOnce(serverError())
    await showDone(maxsteps)
    expect(step(FIX).textContent).toContain('전에 받은 개선안을 확인하지 못했어요.')
    fireEvent.click(within(step(FIX)).getByRole('button', { name: '다시 확인' }))
    await flush()
    expect(listImprovements).toHaveBeenCalledTimes(2)
    expect(step(FIX).textContent).not.toContain('확인하지 못했어요')
  })
})
