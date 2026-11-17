import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RunComparison } from '../src/features/comparison/RunComparison.tsx'
import { toComparison } from '../src/adapters/comparison.ts'
import { buildComparison } from '../src/mocks/fixtures/comparison.ts'
import { findRun } from '../src/mocks/store.ts'
import { ComparisonPage } from '../src/features/comparison/ComparisonPage.tsx'
import { KpiCards } from '../src/features/comparison/ComparisonSections.tsx'
import type { Comparison } from '../src/domain/types.ts'
import { formatDelta, formatMetric } from '../src/features/comparison/format.ts'

// mock 키는 src/mocks/handlers/comparisons.ts 상단 주석을 따른다.
function renderPage(experimentKey: string) {
  return render(
    <MemoryRouter initialEntries={[`/comparisons/${experimentKey}`]}>
      <Routes>
        <Route path="/comparisons/:experimentKey" element={<ComparisonPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const screenCard = (pageKey: string) =>
  screen.getByRole('heading', { name: new RegExp(`화면:\\s*${pageKey}`) }).closest('article') as HTMLElement

it('null 값은 0이나 빈 값이 아니라 계산 불가로 표시한다', () => {
  expect(formatMetric(null, 'ratio')).toBe('계산 불가')
  expect(formatDelta(null, 'margin')).toBe('계산 불가')
  expect(formatDelta(0, 'ratio')).toBe('0.00')
  expect(formatDelta(0.12, 'probability')).toBe('+12.0%p')
})

it('COMPLETED는 모든 화면 비교를 보이고 조건 불일치 안내는 없다', async () => {
  renderPage('mock-done')
  expect(await screen.findByText(/모든 화면을 비교했습니다/)).toBeTruthy()
  expect(screen.queryByText('비교 조건이 일치하지 않습니다')).toBeNull()
  expect(screen.queryByText(/비교할 수 없는 화면입니다/)).toBeNull()
  expect(screen.getByText('Run 단위 비교')).toBeTruthy()
})

it('PARTIAL은 한쪽만 방문한 화면에 사유와 지표 없음 안내를 보인다', async () => {
  renderPage('mock-partial')
  expect(await screen.findByText(/비교할 수 있는 부분만 표시합니다/)).toBeTruthy()
  const card = screenCard('mypage')
  expect(within(card).getByText(/After에서 방문하지 않은 화면입니다/)).toBeTruthy()
  expect(within(card).getByText(/방문하지 않아 화면이 없습니다/)).toBeTruthy()
  expect(within(card).getByText(/지표 비교가 없습니다/)).toBeTruthy()
  expect(within(card).queryByRole('button', { name: /지표 표/ })).toBeNull()
})

it('conditionsMatched=false는 실패 항목과 Run 단위 결과를 보이고 증감을 만들지 않는다', async () => {
  renderPage('mock-mismatch')
  expect(await screen.findByText('비교 조건이 일치하지 않습니다')).toBeTruthy()
  expect(screen.getByText('MAX_STEPS_MATCHED')).toBeTruthy()
  expect(screen.queryByText('MODEL_VERSION_MATCHED')).toBeNull()
  expect(screen.getByText('Run 단위 비교')).toBeTruthy()

  const card = screenCard('home')
  expect(within(card).getAllByText(/비교 조건이 일치하지 않아 비교할 수 없습니다/).length).toBeGreaterThan(0)
  // 후보 대응 표의 증감 칸은 모두 계산 불가이고 %p 값이 없다
  const candidates = card.querySelector('.comparison-candidates') as HTMLElement
  const deltaCells = [...candidates.querySelectorAll('tbody tr')].map((row) => row.lastElementChild?.textContent ?? '')
  expect(deltaCells.length).toBeGreaterThan(0)
  for (const text of deltaCells) {
    expect(text).toContain('계산 불가')
    expect(text).not.toContain('%p')
  }
  // 지표 표도 증감 칸이 계산 불가이고 before/after 값은 남는다
  fireEvent.click(within(card).getByRole('button', { name: '지표 표 펼치기' }))
  const metrics = card.querySelector('.comparison-metrics') as HTMLElement
  for (const row of metrics.querySelectorAll('tbody tr')) {
    expect(row.lastElementChild?.textContent).toBe('계산 불가')
  }
})

it('afterStepId가 null인 화면은 스크린샷 없이 안내를 보인다', async () => {
  renderPage('mock-partial')
  await screen.findByText(/비교할 수 있는 부분만 표시합니다/)
  const card = screenCard('mypage')
  // Before 스크린샷만 있고 After(stepId=null)는 이미지 없이 안내만 보인다
  await waitFor(() => expect(card.querySelectorAll('img').length).toBe(1))
  expect(within(card).getByText(/방문하지 않아 화면이 없습니다/)).toBeTruthy()
})

it('COMPARISON_NOT_READY는 기다리라는 안내와 다시 확인 버튼을 보인다', async () => {
  // 시작 직후의 Run은 아직 끝나지 않았다. 없는 키와 문구가 구분되는지 함께 본다.
  const { server } = await import('./setup.ts')
  const { http, HttpResponse } = await import('msw')
  const { apiUrl } = await import('../src/api/client.ts')
  server.use(
    http.get(apiUrl('/api/comparisons/:key'), () =>
      HttpResponse.json(
        { error: { code: 'COMPARISON_NOT_READY', message: 'x', retryable: false, details: null, occurredAt: null } },
        { status: 409 },
      ),
    ),
  )
  renderPage('exp_running')
  expect(await screen.findByText('두 버전의 분석이 모두 끝나면 비교할 수 있습니다')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 확인' })).toBeTruthy()
  expect(screen.queryByText('비교 대상을 찾을 수 없습니다')).toBeNull()
})

it('RUN_NOT_FOUND는 잘못된 주소 안내를 보인다', async () => {
  renderPage('no-such-key')
  expect(await screen.findByText('비교 대상을 찾을 수 없습니다')).toBeTruthy()
  expect(screen.queryByText(/분석이 모두 끝나면/)).toBeNull()
})

it('COMPARISON_RUN_INVALID는 실험 키를 담은 재분석 링크를 보인다', async () => {
  renderPage('mock-invalid-run')
  const link = await screen.findByRole('link', { name: '해당 버전 다시 분석' })
  expect(link.getAttribute('href')).toBe('/?experimentKey=mock-invalid-run')
})

it('ANALYSIS_ERROR는 다시 시도 버튼을 보인다', async () => {
  renderPage('mock-error')
  expect(await screen.findByText('비교 분석 중 오류가 발생했습니다')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})

it('하나씩 보기는 화면과 버전을 골라 한 장씩 보이고 한눈에 보기로 돌아온다', async () => {
  renderPage('mock-done')
  await screen.findByText(/모든 화면을 비교했습니다/)
  fireEvent.click(screen.getByRole('button', { name: '하나씩 보기' }))
  expect(screen.queryByRole('heading', { name: /화면:/ })).toBeNull()
  const side = screen.getByRole('group', { name: '버전 선택' })
  expect(within(side).getByRole('button', { name: 'Before' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(side).getByRole('button', { name: 'After' }))
  expect(within(side).getByRole('button', { name: 'After' }).getAttribute('aria-pressed')).toBe('true')
  const pages = screen.getByRole('group', { name: '화면 선택' })
  expect(within(pages).getAllByRole('button').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: '한눈에 보기' }))
  expect(screen.getAllByRole('heading', { name: /화면:/ }).length).toBeGreaterThan(0)
})

it('후보별 확률 비교는 Before·After 게이지를 같은 눈금으로 보인다', async () => {
  renderPage('mock-done')
  await screen.findByText(/모든 화면을 비교했습니다/)
  const card = screenCard('home')
  const rows = card.querySelectorAll('.comparison-candidates tbody tr')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.querySelectorAll('.pair-row .gauge')).toHaveLength(2)
})

it('시작 화면 KPI는 home의 지표만 쓰고 없으면 다른 화면 값 대신 계산 불가로 둔다', () => {
  const run = { navigationCost: 1, goalReached: true, stepCount: 2, successfulNavigationClickCount: 2, backCount: 0 }
  const metrics = { goalPathProbability: { before: 0.31, after: 0.72, delta: 0.41 } }
  const make = (screens: unknown[]) =>
    ({ runComparison: { before: run, after: run }, screenComparisons: screens }) as unknown as Comparison

  const { unmount } = render(<KpiCards comparison={make([{ pageKey: 'mypage', metrics }, { pageKey: 'home', metrics: null }])} />)
  const card = screen.getByText('시작 화면 후보 확률').closest('.kpi-card') as HTMLElement
  expect(within(card).getAllByText('계산 불가')).toHaveLength(2)
  expect(card.textContent).not.toContain('72')
  unmount()

  render(<KpiCards comparison={make([{ pageKey: 'mypage', metrics }, { pageKey: 'home', metrics }])} />)
  const homeCard = screen.getByText('시작 화면 후보 확률').closest('.kpi-card') as HTMLElement
  expect(homeCard.textContent).toContain('31.0%')
  expect(homeCard.textContent).toContain('72.0%')
})

const runRow = (label: string) => {
  const th = screen.getByRole('rowheader', { name: label })
  return th.closest('tr') as HTMLElement
}

it('SITE_MAP 비교는 기준·우회 이동·최단 경로 대비 이름을 보이고 이탈 횟수는 사용 안 함이다', async () => {
  renderPage('mock-sitemap')
  await screen.findByText('Run 단위 비교')
  await waitFor(() => expect(runRow('경로 지표 기준').textContent).toContain('사이트 지도'))
  const cells = (label: string) =>
    [...runRow(label).querySelectorAll('td')].map((td) => td.textContent)
  expect(cells('경로 지표 기준')).toEqual(['사이트 지도', '사이트 지도'])
  expect(cells('우회 이동').every((text) => /^\d+$/.test(text ?? ''))).toBe(true)
  // 값까지 확인한다: 서버 값은 숫자이거나 계산 불가다
  expect(cells('최단 경로 대비 추가 단계').every((text) => /^(\d+|계산 불가)$/.test(text ?? ''))).toBe(true)
  expect(cells('기준 경로 이탈 횟수')).toEqual(['사용 안 함', '사용 안 함'])
  expect(screen.queryByRole('rowheader', { name: '추가 단계' })).toBeNull()
  // 판정 문구·화살표를 만들지 않는다
  const table = runRow('우회 이동').closest('table') as HTMLElement
  expect(table.textContent).not.toMatch(/개선|악화|[↑↓▲▼]/)
})

it('SITE_MAP 비교의 지표 표는 목표 경로 확률에 기준 설명을 붙인다', async () => {
  renderPage('mock-sitemap')
  await screen.findByText('Run 단위 비교')
  await waitFor(() => expect(runRow('경로 지표 기준').textContent).toContain('사이트 지도'))
  const card = screenCard('home')
  fireEvent.click(within(card).getByRole('button', { name: '지표 표 펼치기' }))
  expect(within(card).getByText(/사이트 지도에서 목표에 더 가까워지는 클릭 후보들의 확률 합/)).toBeTruthy()
})

it('basis 불일치는 서버 message 그대로 실패 항목에 나온다', async () => {
  renderPage('mock-basis-mismatch')
  expect(await screen.findByText('비교 조건이 일치하지 않습니다')).toBeTruthy()
  expect(screen.getByText('REFERENCE_PATH_CONFIG_MATCHED')).toBeTruthy()
  expect(screen.getByText(/경로 지표 기준이 다릅니다/)).toBeTruthy()
  await waitFor(() =>
    expect([...runRow('경로 지표 기준').querySelectorAll('td')].map((td) => td.textContent)).toEqual([
      '사이트 지도',
      '허용 경로',
    ]),
  )
  // 기준이 다르면 "최단 경로 대비" 이름으로 바꾸지 않는다
  expect(screen.getByRole('rowheader', { name: '추가 단계' })).toBeTruthy()
})

it('과거 Run 비교(허용 경로)는 결과 화면과 같은 허용 경로 이름을 쓰고 우회 이동 행이 없다', async () => {
  renderPage('mock-done')
  await screen.findByText('Run 단위 비교')
  await waitFor(() => expect(runRow('경로 지표 기준').textContent).toContain('허용 경로'))
  expect(screen.getByRole('rowheader', { name: '추가 이동(extraSteps)' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: '추가 이동 비용' })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: '추가 단계' })).toBeNull()
  expect(screen.getByRole('rowheader', { name: '기준 경로 이탈 횟수' })).toBeTruthy()
  expect(runRow('기준 경로 이탈 횟수').textContent).not.toContain('사용 안 함')
  // 허용 경로끼리의 비교에는 우회 이동 행이 없다
  expect(screen.queryByRole('rowheader', { name: '우회 이동' })).toBeNull()
})

it('기준이 다른 비교는 지표 표의 목표 경로 확률 설명을 버전별로 보인다', async () => {
  renderPage('mock-basis-mismatch')
  await screen.findByText('Run 단위 비교')
  await waitFor(() => expect(runRow('경로 지표 기준').textContent).toContain('허용 경로'))
  const card = screenCard('home')
  fireEvent.click(within(card).getByRole('button', { name: '지표 표 펼치기' }))
  expect(within(card).getByText(/Before\(사이트 지도\): .*After\(허용 경로\): /)).toBeTruthy()
})

describe('RunComparison의 기준 경계값', () => {
  const outcomes = () => {
    const dto = buildComparison(findRun('run_mock_sitemap')!, findRun('run_mock_sitemap_after')!, true)
    return toComparison(dto).runComparison
  }
  const cells = (label: string) =>
    [...(screen.getByRole('rowheader', { name: label }).closest('tr') as HTMLElement).querySelectorAll('td')].map(
      (td) => td.textContent,
    )

  it('기준 없음(null)이면 기준 없음으로 표시하고 우회 이동 행은 없으며 이탈 횟수는 계산 불가다', () => {
    const { before, after } = outcomes()
    render(<RunComparison before={before} after={after} beforeBasis={null} afterBasis={null} />)
    expect(cells('경로 지표 기준')).toEqual(['기준 없음', '기준 없음'])
    expect(screen.queryByRole('rowheader', { name: '우회 이동' })).toBeNull()
    expect(cells('기준 경로 이탈 횟수')).toEqual(['계산 불가', '계산 불가'])
    expect(screen.getByRole('rowheader', { name: '추가 단계' })).toBeTruthy()
  })

  it('기준을 모르면(조회 실패) 기존 표시를 유지하고 기준은 -로 둔다', () => {
    const { before, after } = outcomes()
    render(<RunComparison before={before} after={after} />)
    expect(cells('경로 지표 기준')).toEqual(['-', '-'])
    expect(screen.queryByRole('rowheader', { name: '우회 이동' })).toBeNull()
    expect(screen.getByRole('rowheader', { name: '추가 단계' })).toBeTruthy()
    expect(cells('기준 경로 이탈 횟수')).not.toContain('사용 안 함')
  })
})
