import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRun } from '../src/adapters/run.ts'
import { toStepList } from '../src/adapters/step.ts'
import { ApiError } from '../src/api/client.ts'
import * as runsApi from '../src/api/runs.ts'
import type { Run, Step } from '../src/domain/types.ts'
import { RunProgressPage } from '../src/features/run-progress/RunProgressPage.tsx'
import { MAX_STEPS_RETRIES } from '../src/features/run-progress/useRunProgress.ts'
import { buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import type { RunRecord } from '../src/mocks/store.ts'

vi.mock('../src/api/runs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api/runs.ts')>()),
  getRun: vi.fn(),
  getRunSteps: vi.fn(),
}))
const getRun = vi.mocked(runsApi.getRun)
const getRunSteps = vi.mocked(runsApi.getRunSteps)

const RECORD: RunRecord = {
  runId: 'run_t',
  experimentKey: 'k',
  variant: 'before',
  goalId: 'refund',
  personaId: 'novice-shopper',
  maxSteps: 5,
  createdAtMs: 0,
}

// 시나리오 'before'는 Step이 3개다(`mock/fixtures/scenario.ts`).
const runOf = (status: string): Run => ({
  ...toRun(buildRun(RECORD, 0)),
  status,
})
const stepsOf = (count: number): Step[] =>
  toStepList({
    runId: RECORD.runId,
    count,
    items: buildSteps(RECORD, count),
  })

const serverError = () =>
  new ApiError({ status: 503, code: 'X', message: '일시 오류', retryable: true })
const notFound = () =>
  new ApiError({
    status: 404,
    code: 'RUN_NOT_FOUND',
    message: '실행을 찾을 수 없습니다',
    retryable: false,
  })

function renderPage(runId = RECORD.runId) {
  return render(
    <MemoryRouter initialEntries={[`/runs/${runId}`]}>
      <Routes>
        <Route path="/runs/:runId" element={<RunProgressPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// 첫 조회와 그 응답 처리를 마친다.
const flush = () => act(() => vi.advanceTimersByTimeAsync(0))
const tick = (ms = 1000) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
  getRun.mockReset()
  getRunSteps.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('진행 화면 폴링', () => {
  it('종료 응답을 받으면 마지막 Step을 반영하고 폴링을 멈춘 뒤 결과 보기를 활성화한다', async () => {
    getRun
      .mockResolvedValueOnce(runOf('READY'))
      .mockResolvedValueOnce(runOf('RUNNING'))
      .mockResolvedValue(runOf('SUCCESS'))
    getRunSteps
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(stepsOf(1))
      .mockResolvedValue(stepsOf(3))
    renderPage()
    await flush()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('진단 중')
    expect(screen.getByText('시작 준비 중')).toBeTruthy()
    expect(screen.getByText('AI 고객이 첫 화면을 보고 있어요')).toBeTruthy()
    // 끝나기 전에는 결과 링크 대신 안내 문구만 보인다.
    expect(screen.queryByRole('link', { name: '진단 결과 보기' })).toBeNull()
    expect(screen.getByText(/끝나면 결과를 볼 수 있어요/)).toBeTruthy()

    await tick()
    expect(screen.getByText('AI 고객이 둘러보는 중')).toBeTruthy()
    await tick()
    expect(screen.getByText('도착함')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('진단이 끝났어요')
    expect(screen.getAllByRole('button', { name: /^\d번째$/ })).toHaveLength(3)
    expect(screen.queryByText(/끝나면 결과를 볼 수 있어요/)).toBeNull()
    const link = screen.getByRole('link', { name: '진단 결과 보기' })
    expect(link.getAttribute('href')).toBe('/runs/run_t/result')

    const calls = getRun.mock.calls.length
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(calls)
  })

  it('Step이 쌓일 때 최신을 따라가고, 과거 Step을 열람 중이면 위치를 유지하며, 버튼으로 따라가기를 되돌린다', async () => {
    getRun.mockResolvedValue(runOf('RUNNING'))
    getRunSteps
      .mockResolvedValueOnce(stepsOf(1))
      .mockResolvedValueOnce(stepsOf(2))
      .mockResolvedValueOnce(stepsOf(3))
      .mockResolvedValue(stepsOf(3))
    renderPage()
    await flush()
    const pressed = () =>
      screen
        .getAllByRole('button', { name: /^\d번째$/ })
        .filter((button) => button.getAttribute('aria-pressed') === 'true')
        .map((button) => button.textContent)

    expect(pressed()).toEqual(['1번째'])
    await tick()
    expect(pressed()).toEqual(['2번째']) // 최신을 보고 있었으므로 따라간다
    expect(screen.queryByText(/지금 화면 아님/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '1번째' }))
    expect(screen.getByText(/지금 화면 아님/)).toBeTruthy()
    await tick()
    expect(pressed()).toEqual(['1번째']) // Step 3이 와도 열람 위치 유지
    expect(screen.getByText(/지금 화면 아님/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '지금 화면 보기' }))
    expect(pressed()).toEqual(['3번째'])
    expect(screen.queryByText(/지금 화면 아님/)).toBeNull()
  })

  it('종료 상태 Run에는 대기 카드를 만들지 않고 진행 중에는 남은 단계 대기 카드 한 장을 보인다', async () => {
    getRun.mockResolvedValueOnce(runOf('RUNNING')).mockResolvedValue(runOf('SUCCESS'))
    getRunSteps.mockResolvedValue(stepsOf(3))
    renderPage()
    await flush()
    expect(screen.getAllByText('다음 화면을 보는 중')).toHaveLength(1)
    await tick()
    expect(screen.queryByText('다음 화면을 보는 중')).toBeNull()
  })

  it('404 RUN_NOT_FOUND이면 폴링을 멈추고 새 진단 링크를 보인다', async () => {
    getRun.mockRejectedValue(notFound())
    renderPage()
    await flush()
    expect(screen.getByText('이 진단을 찾을 수 없어요.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '새 진단' }).getAttribute('href')).toBe('/')
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(1)
  })

  it('연속 실패하면 멈추고 수동 재시도로 다시 시작한다', async () => {
    getRun.mockRejectedValue(serverError())
    renderPage()
    await flush()
    expect(screen.getByText('다시 연결하는 중이에요')).toBeTruthy()
    await tick(60_000)
    expect(getRun).toHaveBeenCalledTimes(5)
    expect(screen.getByRole('alert').textContent).toContain('일시 오류')

    getRun.mockResolvedValue(runOf('SUCCESS'))
    getRunSteps.mockResolvedValue(stepsOf(3))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(screen.getByText('도착함')).toBeTruthy()
  })

  it('화면을 떠나면 진행 중인 요청을 취소하고 더 조회하지 않는다', async () => {
    let signal: AbortSignal | undefined
    getRun.mockImplementation((_id, s) => {
      signal = s
      return new Promise<Run>(() => {})
    })
    const { unmount } = renderPage()
    await flush()
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
    await tick(10_000)
    expect(getRun).toHaveBeenCalledTimes(1)
  })
})

describe('Step 조회 오류 분리', () => {
  it('Run이 RUNNING이고 steps가 503이어도 Run 상태는 반영하고 이전 Step을 유지한다', async () => {
    getRun.mockResolvedValue(runOf('RUNNING'))
    getRunSteps.mockResolvedValueOnce(stepsOf(2)).mockRejectedValue(serverError())
    renderPage()
    await flush()
    await tick()
    expect(screen.getByText('AI 고객이 둘러보는 중')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^\d번째$/ })).toHaveLength(2)
    expect(screen.getByText('클릭 기록을 다시 불러오는 중이에요')).toBeTruthy()
    expect(screen.queryByText('이 진단을 찾을 수 없어요.')).toBeNull()
  })

  it('Run이 SUCCESS이고 steps가 503이면 종료는 반영하고 한도까지 steps만 다시 조회한 뒤 멈춘다', async () => {
    getRun.mockResolvedValue(runOf('SUCCESS'))
    getRunSteps.mockRejectedValue(serverError())
    renderPage()
    await flush()
    expect(screen.getByText('도착함')).toBeTruthy()
    expect(screen.getByRole('link', { name: '진단 결과 보기' })).toBeTruthy()
    await tick(60_000)
    expect(getRunSteps).toHaveBeenCalledTimes(MAX_STEPS_RETRIES)
    expect(screen.getByRole('alert').textContent).toContain('클릭 기록을 불러오지 못했어요')
    await tick(10_000)
    expect(getRunSteps).toHaveBeenCalledTimes(MAX_STEPS_RETRIES)
  })

  it('Run 조회가 성공한 뒤 steps가 404여도 "진단을 찾을 수 없음"으로 처리하지 않는다', async () => {
    getRun.mockResolvedValue(runOf('RUNNING'))
    getRunSteps.mockRejectedValue(notFound())
    renderPage()
    await flush()
    expect(screen.queryByText('이 진단을 찾을 수 없어요.')).toBeNull()
    expect(screen.getByText('AI 고객이 둘러보는 중')).toBeTruthy()
    expect(screen.getByText('클릭 기록을 다시 불러오는 중이에요')).toBeTruthy()
  })

  it('steps가 다시 정상화되면 기록과 마지막 Step이 복구된다', async () => {
    getRun.mockResolvedValue(runOf('SUCCESS'))
    getRunSteps.mockRejectedValue(serverError())
    renderPage()
    await flush()
    await tick(60_000)
    expect(screen.getByRole('alert')).toBeTruthy()

    getRunSteps.mockResolvedValue(stepsOf(3))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(screen.getAllByRole('button', { name: /^\d번째$/ })).toHaveLength(3)
    expect(screen.queryByText('클릭 기록을 불러오지 못했어요')).toBeNull()
  })
})
