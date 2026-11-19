import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ComparisonPage } from '../src/features/comparison/ComparisonPage.tsx'
import { outcomeText, verdictText } from '../src/features/comparison/verdict.ts'
import { toRun } from '../src/adapters/run.ts'
import type { Comparison, RunOutcome } from '../src/domain/types.ts'
import { buildRun } from '../src/mocks/fixtures/run.ts'
import { findRun } from '../src/mocks/store.ts'

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

const summary = () => screen.findByRole('region', { name: '결과 요약' })

/** 화면 글자에 서버 코드값·ID·영어·어려운 용어가 보이지 않는다 */
function expectPlainText() {
  const text = document.body.textContent ?? ''
  for (const code of [
    /\bBefore\b/, /\bAfter\b/, /run_mock/, 'experimentKey', 'SUCCESS', /Step \d/, 'GO_BACK', 'CHOICE_AMBIGUITY',
    'NOT_VISITED_IN', 'MATCHED', '엔트로피', 'margin', '기준 경로', '비교 조건', '증감', '해당', '되었습니다', '%p',
  ]) {
    expect(text).not.toMatch(code)
  }
}

const openDetails = () => fireEvent.click(screen.getByText('화면별로 자세히 보기'))

describe('결론 문장', () => {
  const outcome = (over: Partial<RunOutcome>) => ({ goalReached: true, status: 'SUCCESS', stepCount: 3, ...over }) as RunOutcome
  const make = (before: Partial<RunOutcome>, after: Partial<RunOutcome>, conditionsMatched = true) =>
    ({ conditionsMatched, runComparison: { before: outcome(before), after: outcome(after) } }) as Comparison

  it('도착 여부와 단계 수로 한 문장을 만든다', () => {
    expect(verdictText(make({ stepCount: 4 }, { stepCount: 2 }))).toBe('개선안에서 더 빨리 찾았어요')
    expect(verdictText(make({ stepCount: 2 }, { stepCount: 4 }))).toBe('지금 화면에서 더 빨리 찾았어요')
    expect(verdictText(make({}, {}))).toBe('차이가 없어요')
    const lost = { goalReached: false, status: 'MAX_STEPS' }
    expect(verdictText(make(lost, lost))).toBe('둘 다 못 찾았어요')
    expect(verdictText(make(lost, {}))).toBe('개선안에서만 찾았어요')
    expect(verdictText(make({}, lost))).toBe('지금 화면에서만 찾았어요')
  })

  it('설정이 다르거나 오류로 멈췄으면 말하지 않는다', () => {
    expect(verdictText(make({ stepCount: 4 }, { stepCount: 2 }, false))).toBeNull()
    expect(verdictText(make({ goalReached: false, status: 'ERROR' }, {}))).toBeNull()
  })

  it('한쪽 결과는 짧게 쓴다', () => {
    expect(outcomeText(outcome({ stepCount: 3 }))).toBe('3번 만에 도착')
    expect(outcomeText(outcome({ goalReached: false, status: 'BLOCKED' }))).toBe('못 찾음')
    expect(outcomeText(outcome({ goalReached: false, status: 'ERROR' }))).toBe('중간에 멈춤')
  })
})

it('제목·하려는 일·두 쪽 결과·진단 링크를 보인다', async () => {
  renderPage('mock-done')
  const region = await summary()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('지금 화면 vs 개선안')
  expect(within(region).getByRole('heading', { name: '지금 화면' })).toBeTruthy()
  expect(within(region).getByRole('heading', { name: '개선안' })).toBeTruthy()
  expect(within(region).getAllByText(/^\d+번 만에 도착$/)).toHaveLength(2)
  expect(within(region).getByRole('link', { name: '지금 화면 진단 보기' }).getAttribute('href')).toBe('/runs/run_mock_done_before')
  expect(within(region).getByRole('link', { name: '개선안 진단 보기' }).getAttribute('href')).toBe('/runs/run_mock_done_after')
  expect(within(region).getByText(/더 빨리 찾았어요|차이가 없어요|에서만 찾았어요|둘 다 못 찾았어요/)).toBeTruthy()
  // 하려는 일만 Run에서 읽어 한 줄로 보인다 (고객 유형은 보이지 않는다)
  const run = toRun(buildRun(findRun('run_mock_done_before')!, Date.parse('2100-01-01T00:00:00Z')))
  await waitFor(() => expect(document.querySelector('.comparison-task')?.textContent).toBe(run.goal))
  expect(document.body.textContent).not.toContain(run.persona)
  expectPlainText()
})

it('지나간 길은 두 쪽 화면 이름을 순서대로 보인다', async () => {
  renderPage('mock-done')
  await summary()
  for (const name of ['지금 화면 길', '개선안 길']) {
    const path = screen.getByLabelText(name)
    const items = within(path).getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].textContent).toBe('홈')
  }
})

it('화면별 비교는 접혀 있다가 펼치면 스크린샷과 누를 가능성을 보인다', async () => {
  renderPage('mock-done')
  await summary()
  expect(document.querySelector('.comparison-screen')).toBeNull()
  openDetails()
  const home = screen.getByRole('article', { name: '홈' })
  await waitFor(() => expect(home.querySelectorAll('img').length).toBe(2))
  for (const img of home.querySelectorAll('img')) {
    expect(img.getAttribute('alt')).toMatch(/^(지금 화면|개선안)의 홈 화면$/)
  }
  const rows = home.querySelectorAll('.comparison-candidates li')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.querySelectorAll('.pair-row .gauge')).toHaveLength(2)
  expectPlainText()
  // 다시 누르면 접힌다
  openDetails()
  expect(document.querySelector('.comparison-screen')).toBeNull()
})

it('한쪽만 들른 화면은 이유를 짧게 쓰고 스크린샷은 있는 쪽만 보인다', async () => {
  renderPage('mock-partial')
  await summary()
  openDetails()
  const card = screen.getByRole('article', { name: '마이페이지' })
  expect(within(card).getByText('개선안에서는 들르지 않았어요')).toBeTruthy()
  expect(within(card).getByText('이 화면에 들르지 않았어요')).toBeTruthy()
  await waitFor(() => expect(card.querySelectorAll('img').length).toBe(1))
  expectPlainText()
})

it('설정이 다르면 결론과 화면별 비교 없이 이유 한 문장과 다시 진단 링크를 보인다', async () => {
  renderPage('mock-mismatch')
  const region = await summary()
  expect(within(region).getByText(/두 진단의 설정이 달라서/)).toBeTruthy()
  expect(within(region).getByRole('link', { name: '다시 진단하기' }).getAttribute('href')).toBe('/')
  expect(within(region).queryByText(/찾았어요|차이가 없어요/)).toBeNull()
  expect(screen.queryByText('화면별로 자세히 보기')).toBeNull()
  // 두 쪽 결과와 지나간 길은 그대로 보인다
  expect(within(region).getAllByText(/번 만에 도착|못 찾음/)).toHaveLength(2)
  expect(screen.getByRole('heading', { name: '지나간 길' })).toBeTruthy()
  expectPlainText()
})

it('메뉴 이름 후보 검증 Run이면 각 쪽의 메뉴 이름을 보인다', async () => {
  renderPage('opt_mock_completed')
  const region = await summary()
  expect(await within(region).findByText('메뉴 이름 ‘이용정보’')).toBeTruthy()
  expect(within(region).getByText('메뉴 이름 ‘주문·환불’')).toBeTruthy()
})

it('COMPARISON_NOT_READY는 기다리라는 안내와 다시 확인 버튼을 보인다', async () => {
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
  expect(await screen.findByText('두 진단이 다 끝나면 볼 수 있어요')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 확인' })).toBeTruthy()
  expect(screen.queryByText('비교할 진단을 찾지 못했어요')).toBeNull()
})

it('RUN_NOT_FOUND는 진단하러 가기 링크를 보인다', async () => {
  renderPage('no-such-key')
  expect(await screen.findByText('비교할 진단을 찾지 못했어요')).toBeTruthy()
  expect(screen.getByRole('link', { name: '진단하러 가기' }).getAttribute('href')).toBe('/')
})

it('COMPARISON_RUN_INVALID는 다시 진단 링크를 보인다', async () => {
  renderPage('mock-invalid-run')
  const link = await screen.findByRole('link', { name: '다시 진단하기' })
  expect(link.getAttribute('href')).toBe('/')
})

it('ANALYSIS_ERROR는 다시 시도 버튼을 보인다', async () => {
  renderPage('mock-error')
  expect(await screen.findByText('결과를 견주다가 문제가 생겼어요')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})
