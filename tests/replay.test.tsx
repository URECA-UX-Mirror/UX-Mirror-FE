import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { server } from './setup.ts'
import { ComparisonPage } from '../src/features/comparison/ComparisonPage.tsx'
import { REPLAY_EXPERIMENT_KEY } from '../src/features/replay/constants.ts'
import { ReplayPage } from '../src/features/replay/ReplayPage.tsx'
import { RunResultPage } from '../src/features/run-result/RunResultPage.tsx'

afterEach(() => vi.restoreAllMocks())

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/runs/:runId/result" element={<RunResultPage />} />
        <Route path="/comparisons/:experimentKey" element={<ComparisonPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('고정 키의 저장된 Run 목록을 보이고 Run을 만드는 요청은 보내지 않는다', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  renderAt('/replay')

  expect(await screen.findAllByRole('link', { name: '결과 보기' })).not.toHaveLength(0)
  expect(screen.getAllByText(/저장된 실측 결과 재생/).length).toBeGreaterThan(0)
  expect(screen.getByRole('link', { name: '버전 비교 보기' }).getAttribute('href')).toBe(
    `/comparisons/${REPLAY_EXPERIMENT_KEY}`,
  )

  const urls = fetchSpy.mock.calls.map(([input, init]) => ({
    url: String(input instanceof Request ? input.url : input),
    method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
  }))
  expect(urls.length).toBeGreaterThan(0)
  expect(urls.every((request) => request.method === 'GET')).toBe(true)
  expect(urls.some((request) => request.url.includes(`experimentKey=${REPLAY_EXPERIMENT_KEY}`))).toBe(true)
})

it('고정 키의 결과·비교 화면에는 재생 표시와 원본 resultOrigin 배지를 함께 보인다', async () => {
  renderAt('/runs/run_mock_done_before/result')
  expect(await screen.findByRole('note')).toHaveProperty('textContent', '저장된 실측 결과 재생')
  expect(document.querySelector('.origin-badge')?.textContent).toBe('MOCK')
})

it('고정 키가 아닌 실험의 비교 화면에는 재생 표시가 없다', async () => {
  renderAt('/comparisons/mock-partial')
  expect(await screen.findByText(/비교할 수 있는 부분만 표시합니다/)).toBeTruthy()
  expect(screen.queryByRole('note')).toBeNull()
})

it('저장된 실행이 없으면 버전 비교 링크를 보이지 않는다', async () => {
  server.use(http.get(apiUrl('/api/runs'), () => HttpResponse.json({ count: 0, items: [] })))
  renderAt('/replay')
  expect(await screen.findByText('저장된 실행이 없습니다')).toBeTruthy()
  expect(screen.queryByRole('link', { name: '버전 비교 보기' })).toBeNull()
})

it('조회 실패로 재시도하는 동안 연결 재시도 중을 보이고 비교 링크는 숨긴다', async () => {
  server.use(http.get(apiUrl('/api/runs'), () => new HttpResponse(null, { status: 500 })))
  renderAt('/replay')
  expect(await screen.findByText('연결 재시도 중')).toBeTruthy()
  expect(screen.queryByRole('link', { name: '버전 비교 보기' })).toBeNull()
})

it('고정 키의 비교 화면에는 재생 표시가 있다', async () => {
  renderAt(`/comparisons/${REPLAY_EXPERIMENT_KEY}`)
  expect(await screen.findByText(/모든 화면을 비교했습니다/)).toBeTruthy()
  expect(screen.getByRole('note').textContent).toBe('저장된 실측 결과 재생')
})
