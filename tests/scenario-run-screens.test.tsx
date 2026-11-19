import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { toRun } from '../src/adapters/run.ts'
import { toSite } from '../src/adapters/site.ts'
import { toStepList } from '../src/adapters/step.ts'
import * as runs from '../src/api/runs.ts'
import * as sites from '../src/api/sites.ts'
import type { Run, RunListItem } from '../src/domain/types.ts'
import { RunProgressPage } from '../src/features/run-progress/RunProgressPage.tsx'
import { RunResultPage } from '../src/features/run-result/RunResultPage.tsx'
import { buildRun, buildSteps } from '../src/mocks/fixtures/run.ts'
import { SITES } from '../src/mocks/fixtures/sites.ts'
import type { RunRecord } from '../src/mocks/store.ts'

vi.mock('../src/api/runs.ts', async (original) => ({
  ...(await original<typeof import('../src/api/runs.ts')>()),
  getRun: vi.fn(), getRunSteps: vi.fn(), getRunIssues: vi.fn(), listRuns: vi.fn(),
}))
vi.mock('../src/api/sites.ts', () => ({ listSites: vi.fn() }))

const record: RunRecord = {
  runId: 'scenario', experimentKey: 'scenario-key', variant: 'before', siteId: 'demo-no-map',
  goalId: null, goal: '공지사항 찾기', personaId: null, persona: '방문자', reference: 'none',
  verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/notice', text: '공지사항', exact: false, scope: 'page' },
  maxSteps: 5, createdAtMs: 0,
}
const run = () => toRun(buildRun(record, Date.parse('2100-01-01')))
function display(page: 'result' | 'progress') {
  const path = page === 'result' ? '/runs/scenario/result' : '/runs/scenario'
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/runs/:runId/result" element={<RunResultPage />} />
    <Route path="/runs/:runId" element={<RunProgressPage />} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(runs.getRun).mockResolvedValue(run())
  vi.mocked(runs.getRunSteps).mockResolvedValue(toStepList({ runId: record.runId, count: 1, items: buildSteps(record, 1) }))
  vi.mocked(runs.getRunIssues).mockResolvedValue({ runId: record.runId, analysisStatus: 'COMPLETED', items: [] })
  vi.mocked(runs.listRuns).mockResolvedValue([{ ...run(), goalReached: true } as RunListItem])
  vi.mocked(sites.listSites).mockResolvedValue(SITES.map(toSite))
})

it('시나리오 결과에서 사이트와 화면 이름, 지도 안내와 다른 실행을 표시한다', async () => {
  display('result')
  expect(await screen.findByText('시나리오 테스트 · 지도 없는 데모 사이트')).toBeTruthy()
  expect(screen.queryByRole('link', { name: '버전 비교 보기' })).toBeNull()
  const summary = screen.getByRole('region', { name: '요약' })
  expect(within(summary).getByText('이 사이트는 사이트 지도가 없어 경로 지표를 계산하지 않습니다')).toBeTruthy()
  fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
  expect(within(summary).getAllByText('계산 불가 (경로 기준 없음)').length).toBeGreaterThan(0)
  const path = await screen.findByRole('region', { name: '탐색 경로' })
  expect(within(path).getByText('홈')).toBeTruthy()
  expect(screen.getByRole('region', { name: '단계별 탐색 상세' }).textContent).toContain('선택된 노드: 홈')
  expect((await screen.findByRole('region', { name: '다른 실행 보기' })).textContent).toContain('시나리오 테스트')
  expect(await screen.findByText('모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다')).toBeTruthy()
})

it('사이트 조회 실패 시 사이트 ID와 화면 키를 사용하고 지도 안내를 생략한다', async () => {
  vi.mocked(sites.listSites).mockRejectedValue(new Error('조회 실패'))
  display('result')
  expect(await screen.findByText('시나리오 테스트 · demo-no-map')).toBeTruthy()
  await waitFor(() => expect(sites.listSites).toHaveBeenCalled())
  expect(screen.getByRole('region', { name: '탐색 경로' }).textContent).toContain('home')
  expect(screen.queryByText('이 사이트는 사이트 지도가 없어 경로 지표를 계산하지 않습니다')).toBeNull()
})

it('지도가 있는 사이트는 안내하지 않고, 일반 Run은 사이트 조회와 시나리오 표시를 하지 않는다', async () => {
  vi.mocked(sites.listSites).mockResolvedValue([{ ...toSite(SITES[1]), siteMapAvailable: true }])
  const view = render(<MemoryRouter initialEntries={['/runs/scenario/result']}><Routes><Route path="/runs/:runId/result" element={<RunResultPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('시나리오 테스트 · 지도 없는 데모 사이트')).toBeTruthy()
  expect(screen.queryByText('이 사이트는 사이트 지도가 없어 경로 지표를 계산하지 않습니다')).toBeNull()
  view.unmount()
  vi.mocked(sites.listSites).mockClear()
  vi.mocked(runs.getRun).mockResolvedValue({ ...run(), mode: null, siteId: null })
  display('result')
  expect(await screen.findByRole('link', { name: '버전 비교 보기' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '실행 정보' }).textContent).toContain('v1')
  expect(sites.listSites).not.toHaveBeenCalled()
})

it('진행 화면에서 현재 화면을 변환하고 무효 및 실행 오류를 각각 표시한다', async () => {
  const invalid: Run = { ...run(), validity: 'INVALID', invalidReason: 'LEAK_CHECK_FAILED',
    error: { code: 'LEAK_CHECK_FAILED', message: '모델 요청에 실험 정보가 섞여 호출하지 않았습니다.', retryable: false, occurredAt: null },
    progress: { ...run().progress, currentPageKey: 'home' } }
  vi.mocked(runs.getRun).mockResolvedValue(invalid)
  display('progress')
  expect(await screen.findByText('시나리오 테스트 · 지도 없는 데모 사이트')).toBeTruthy()
  const info = screen.getByRole('region', { name: '실행 정보' })
  expect(within(info).getByText('홈')).toBeTruthy()
  expect(within(info).getByText(/무효 처리된 실행 · LEAK_CHECK_FAILED/)).toBeTruthy()
  expect(within(info).getByText(/실행 오류: 모델 요청에 실험 정보가 섞여 호출하지 않았습니다/)).toBeTruthy()
})

it('무효 실행의 빈 후보는 건수 대신 무효 상태로 표시한다', async () => {
  vi.mocked(runs.getRun).mockResolvedValue({ ...run(), validity: 'INVALID', invalidReason: 'LEAK_CHECK_FAILED' })
  display('result')
  expect(await screen.findByText('무효 처리된 실행의 검토 후보가 없습니다')).toBeTruthy()
  expect(screen.getByRole('region', { name: '요약' }).textContent).toContain('무효 실행')
  expect(screen.getByRole('region', { name: '요약' }).textContent).toContain('LEAK_CHECK_FAILED')
  expect(screen.getByRole('region', { name: '검토 후보' }).textContent).not.toContain('0건 탐지됨')
})
