import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { server } from './setup.ts'
import { ComparisonPage } from '../src/features/comparison/ComparisonPage.tsx'
import { isReplayKey, REPLAY_EXPERIMENTS } from '../src/features/replay/constants.ts'
import { ReplayPage } from '../src/features/replay/ReplayPage.tsx'
import { RunPage } from '../src/features/run-result/RunPage.tsx'

const REPLAY_EXPERIMENT_KEY = REPLAY_EXPERIMENTS[0].key

afterEach(() => vi.restoreAllMocks())

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/runs/:runId/result" element={<RunPage />} />
        <Route path="/comparisons/:experimentKey" element={<ComparisonPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('isReplayKey는 목록의 키만 재생 대상으로 본다', () => {
  expect(isReplayKey(REPLAY_EXPERIMENTS[0].key)).toBe(true)
  expect(isReplayKey('other')).toBe(false)
})

const MOCK_NOTE = '예시 데이터 재생'
const LIVE_NOTE = '저장된 실측 결과 재생'

function item(variant: 'before' | 'after', over: Record<string, unknown> = {}) {
  return {
    runId: `run_${variant}`,
    experimentKey: REPLAY_EXPERIMENT_KEY,
    variant,
    status: 'SUCCESS',
    terminationReason: 'GOAL_VERIFIED',
    validity: 'VALID',
    replacementRunId: null,
    resultOrigin: 'LIVE',
    goalReached: true,
    createdAt: '2026-11-01T09:00:00+09:00',
    finishedAt: '2026-11-01T09:05:00+09:00',
    ...over,
  }
}

// 재생 키가 여러 개라 첫 키에만 목록을 주고 나머지 키는 비어 있게 한다
function useRunList(items: unknown[]) {
  server.use(
    http.get(apiUrl('/api/runs'), ({ request }) => {
      const key = new URL(request.url).searchParams.get('experimentKey')
      const list = key === REPLAY_EXPERIMENT_KEY ? items : []
      return HttpResponse.json({ count: list.length, items: list })
    }),
  )
}

const compareLink = () => screen.queryByRole('link', { name: '지금 화면 vs 개선안 보기' })

it('고정 키의 저장된 Run 목록을 보이고 Run을 만드는 요청은 보내지 않는다', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  renderAt('/replay')

  expect(await screen.findAllByRole('link', { name: '결과 보기' })).not.toHaveLength(0)
  expect(compareLink()?.getAttribute('href')).toBe(`/comparisons/${REPLAY_EXPERIMENT_KEY}`)
  // 각 실행은 Run ID 대신 버전 이름·시작 시각·상태로 구분하고 실험 키·상태 코드는 보이지 않는다
  const rows = [...document.querySelectorAll('.replay-runs li')].map((li) => li.textContent ?? '')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row).toMatch(/^(지금 화면|개선안)\d{2}-\d{2} \d{2}:\d{2} · /)
  expect(document.body.textContent).not.toMatch(/run_|experimentKey|SUCCESS|\bMOCK\b|\bLIVE\b/)

  const urls = fetchSpy.mock.calls.map(([input, init]) => ({
    url: String(input instanceof Request ? input.url : input),
    method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
  }))
  expect(urls.length).toBeGreaterThan(0)
  expect(urls.every((request) => request.method === 'GET')).toBe(true)
  expect(urls.some((request) => request.url.includes(`experimentKey=${REPLAY_EXPERIMENT_KEY}`))).toBe(true)
})

it('진단 화면은 재생 키의 Run이어도 재생 표시나 결과 출처 배지를 보이지 않는다', async () => {
  renderAt('/runs/run_mock_replay_before/result')
  expect(await screen.findByRole('heading', { name: '지나간 길' })).toBeTruthy()
  expect(screen.queryByRole('note')).toBeNull()
  expect(document.querySelector('.origin-badge[data-origin]')).toBeNull()
})

it('LIVE 결과의 재생 화면은 저장된 실측 결과 재생을 보이고 원본 LIVE 배지를 유지한다', async () => {
  useRunList([item('before'), item('after')])
  renderAt('/replay')
  expect((await screen.findByRole('note')).textContent).toBe(LIVE_NOTE)
  expect(document.querySelectorAll('.origin-badge[data-origin="LIVE"]')).toHaveLength(2)
})

it('LIVE와 MOCK이 섞이면 실측이라고 표시하지 않는다', async () => {
  useRunList([item('before'), item('after', { resultOrigin: 'MOCK' })])
  renderAt('/replay')
  expect((await screen.findByRole('note')).textContent).toBe(MOCK_NOTE)
})

it('고정 키가 아닌 실험의 비교 화면에는 재생 표시가 없다', async () => {
  renderAt('/comparisons/mock-partial')
  expect(await screen.findByRole('region', { name: '결과 요약' })).toBeTruthy()
  expect(screen.queryByRole('note')).toBeNull()
})

it('고정 키의 비교 화면에는 재생 표시가 있다', async () => {
  renderAt(`/comparisons/${REPLAY_EXPERIMENT_KEY}`)
  expect(await screen.findByRole('region', { name: '결과 요약' })).toBeTruthy()
  expect(screen.getByRole('note').textContent).toBe(MOCK_NOTE)
})

it('저장된 실행이 없으면 버전 비교 링크를 보이지 않는다', async () => {
  useRunList([])
  renderAt('/replay')
  await waitFor(() =>
    expect(screen.getAllByText('저장된 실행이 없습니다')).toHaveLength(REPLAY_EXPERIMENTS.length),
  )
  expect(compareLink()).toBeNull()
})

it('Before만 있으면 버전 비교 링크를 보이지 않는다', async () => {
  useRunList([item('before')])
  renderAt('/replay')
  expect(await screen.findAllByRole('link', { name: '결과 보기' })).toHaveLength(1)
  expect(compareLink()).toBeNull()
})

it('After가 INVALID이면 버전 비교 링크를 보이지 않는다', async () => {
  useRunList([item('before'), item('after', { validity: 'INVALID' })])
  renderAt('/replay')
  expect(await screen.findAllByRole('link', { name: '결과 보기' })).toHaveLength(2)
  expect(compareLink()).toBeNull()
})

it('두 버전 중 아직 끝나지 않은 Run이 있으면 버전 비교 링크를 보이지 않는다', async () => {
  useRunList([item('before'), item('after', { status: 'RUNNING', validity: null, finishedAt: null })])
  renderAt('/replay')
  expect(await screen.findAllByRole('link', { name: '결과 보기' })).toHaveLength(2)
  expect(compareLink()).toBeNull()
})

it('두 버전 모두 종료된 VALID Run이면 버전 비교 링크를 보인다', async () => {
  useRunList([item('before'), item('after')])
  renderAt('/replay')
  expect(await screen.findByRole('link', { name: '지금 화면 vs 개선안 보기' })).toBeTruthy()
})

it('조회 실패로 재시도하는 동안 연결 재시도 중을 보이고 비교 링크는 숨긴다', async () => {
  server.use(http.get(apiUrl('/api/runs'), () => new HttpResponse(null, { status: 500 })))
  renderAt('/replay')
  expect(await screen.findAllByText('연결 재시도 중')).not.toHaveLength(0)
  expect(compareLink()).toBeNull()
})
