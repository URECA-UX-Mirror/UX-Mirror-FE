import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { ComparisonPage } from '../src/features/comparison/ComparisonPage.tsx'
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
