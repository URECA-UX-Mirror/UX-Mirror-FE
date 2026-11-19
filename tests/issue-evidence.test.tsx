import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { IssuePanel } from '../src/features/run-result/IssuePanel.tsx'
import type { IssueList, Step } from '../src/domain/types.ts'

const issueList: IssueList = {
  runId: 'run_test', analysisStatus: 'COMPLETED', items: [{
    issueId: 'issue_1', issueType: 'CHOICE_AMBIGUITY', stepId: 2,
    relatedStepIds: [2, 3], pagePath: '/shop/mypage', pageKey: 'mypage',
    title: '메뉴 선택 확률 분산', description: '검토 후보', evidence: { candidateCount: 2 },
    reviewPriority: 'GENERAL_REVIEW', occurrenceCount: 2,
  }],
}
const step = (stepId: number): Step => ({
  stepId, timestamp: '', page: { pageKey: 'mypage', path: '/shop/mypage', title: '',
    viewport: { width: 1440, height: 900 }, screenshotSize: { width: 1440, height: 900 }, scroll: { x: 0, y: 0 } },
  candidates: [{
    optionId: 'a', label: stepId === 2 ? '쿠폰함' : '주문 내역', region: '본문', context: null,
    href: '/shop/orders', semanticKey: '본문>/shop/orders#1',
    bbox: stepId === 2 ? { x: 144, y: 90, width: 288, height: 90 }
      : { x: 720, y: 180, width: 144, height: 180 },
    probability: stepId === 2 ? 0.7 : 0.25, selected: stepId === 2,
  }, {
    optionId: 'b', label: '고객센터', region: '본문', context: null,
    href: '/shop/support', semanticKey: '본문>/shop/support#1',
    bbox: { x: 360, y: 270, width: 144, height: 90 },
    probability: stepId === 2 ? 0.3 : 0.75, selected: stepId === 3,
  }], backOptionId: null,
  decision: { selectedOptionId: stepId === 2 ? 'a' : 'b', selectedActionType: 'CLICK', resultOrigin: 'MOCK',
    goalJudgmentMode: 'DOM_ONLY', modelGoalReached: null, modelGoalYesProb: null,
    verifiedGoalReached: false, goalJudgmentMismatch: false, normalizedEntropy: null,
    clickOnlyNormalizedEntropy: null, goBackProbability: null, top2Margin: null,
    clickOnlyTop2Margin: null, goalPathProbability: null, modelLatencyMs: null, metricWarnings: [] },
  action: { selectedOptionId: stepId === 2 ? 'a' : 'b', executedOptionId: stepId === 2 ? 'a' : 'b', actionType: 'CLICK', result: 'NO_CHANGE',
    reason: null, executed: true, fromPath: '/shop/mypage', toPath: '/shop/mypage' },
  statusAfterStep: 'RUNNING', error: null,
})
function panel(steps: Step[] | null, issues = issueList) {
  return render(<IssuePanel runId="run_test" steps={steps} stepsFailed={false} onRetrySteps={() => {}} issues={issues}
    pollingStatus="success" error={null} retrying={false} onRetry={() => {}} />)
}
it('경로에 없는 NO_CHANGE Step과 같은 Issue의 다른 Step 근거를 각각 확인한다', () => {
  panel([step(2), step(3)])
  fireEvent.click(screen.getByRole('button', { name: /메뉴 선택 확률 분산/ }))
  let image = screen.getByRole('img', { name: 'Step 2 근거 화면' }) as HTMLImageElement
  expect(image.src).toContain('/api/runs/run_test/screenshots/2?kind=original')
  const evidence = screen.getByLabelText('Step 2 근거')
  const firstRow = within(evidence).getByText('쿠폰함').closest('li') as HTMLElement
  expect(within(firstRow).getByText('70.0%')).toBeTruthy()
  expect(firstRow.classList.contains('candidate-selected')).toBe(true)
  const firstBox = evidence.querySelector('.screenshot-box') as HTMLElement
  expect(firstBox.classList.contains('screenshot-box-selected')).toBe(true)
  expect(firstBox.style.left).toBe('10%')
  expect(firstBox.style.width).toBe('20%')
  fireEvent.click(screen.getByRole('button', { name: 'Step 3 보기' }))
  image = screen.getByRole('img', { name: 'Step 3 근거 화면' }) as HTMLImageElement
  expect(image.src).toContain('/api/runs/run_test/screenshots/3?kind=original')
  const nextEvidence = screen.getByLabelText('Step 3 근거')
  const nextRow = within(nextEvidence).getByText('주문 내역').closest('li') as HTMLElement
  expect(within(nextRow).getByText('25.0%')).toBeTruthy()
  expect(nextRow.classList.contains('candidate-selected')).toBe(false)
  const nextBox = nextEvidence.querySelector('.screenshot-box') as HTMLElement
  expect(nextBox.classList.contains('screenshot-box-selected')).toBe(false)
  expect(nextBox.style.left).toBe('50%')
  expect(nextBox.style.width).toBe('10%')
  const selectedRow = within(nextEvidence).getByText('고객센터').closest('li') as HTMLElement
  expect(within(selectedRow).getByText('75.0%')).toBeTruthy()
  expect(selectedRow.classList.contains('candidate-selected')).toBe(true)
  expect(nextEvidence.querySelectorAll('.screenshot-box-selected')).toHaveLength(1)
  expect(screen.getByText('근거')).toBeTruthy()
  expect(within(screen.getByLabelText('근거')).getByText('2')).toBeTruthy()
})

it('이미지 로딩에 실패한 Step을 다시 선택하면 다시 시도한다', () => {
  panel([step(2), step(3)])
  fireEvent.click(screen.getByRole('button', { name: /메뉴 선택 확률 분산/ }))
  fireEvent.error(screen.getByRole('img', { name: 'Step 2 근거 화면' }))
  expect(screen.getByText('화면 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Step 3 보기' }))
  expect(screen.getByRole('img', { name: 'Step 3 근거 화면' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Step 2 보기' }))
  expect(screen.getByRole('img', { name: 'Step 2 근거 화면' })).toBeTruthy()
  expect(screen.queryByText('화면 없음')).toBeNull()
})
it('관련 Step 로딩 중·누락을 구분하고 Run 전체 Issue에는 Step을 만들지 않는다', () => {
  const { rerender } = panel(null)
  fireEvent.click(screen.getByRole('button', { name: /메뉴 선택 확률 분산/ }))
  expect(screen.getByText('Step 정보를 불러오는 중')).toBeTruthy()
  rerender(<IssuePanel runId="run_test" steps={[]} stepsFailed={false} onRetrySteps={() => {}} issues={issueList} pollingStatus="success" error={null} retrying={false} onRetry={() => {}} />)
  expect(screen.getByText('Step 2 정보를 찾을 수 없습니다')).toBeTruthy()
  rerender(<IssuePanel runId="run_test" steps={null} stepsFailed={true} onRetrySteps={() => {}} issues={issueList} pollingStatus="success" error={null} retrying={false} onRetry={() => {}} />)
  expect(screen.getByText('Step 정보를 불러오지 못했습니다')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  const runIssue = { ...issueList, items: [{ ...issueList.items[0], stepId: null, relatedStepIds: [] }] }
  rerender(<IssuePanel runId="run_test" steps={[]} stepsFailed={false} onRetrySteps={() => {}} issues={runIssue} pollingStatus="success" error={null} retrying={false} onRetry={() => {}} />)
  expect(within(screen.getByRole('region', { name: '검토 후보' })).queryByText('관련 Step')).toBeNull()
})


it('완료된 빈 후보는 유효성과 무효성을 구분한다', () => {
  const empty = { ...issueList, items: [] }
  const props = { runId: 'run_test', steps: [], stepsFailed: false, onRetrySteps: () => {},
    issues: empty, pollingStatus: 'success' as const, error: null, retrying: false, onRetry: () => {} }
  const view = render(<IssuePanel {...props} validity="VALID" />)
  expect(screen.getByText('검토 후보 없음')).toBeTruthy()
  view.rerender(<IssuePanel {...props} validity="INVALID" />)
  expect(screen.getByText('무효 처리된 실행의 검토 후보가 없습니다')).toBeTruthy()
  expect(screen.queryByText('0건 탐지됨')).toBeNull()
})

it('목표 미도달은 화면 대신 진단 전체 결과로 표시한다', () => {
  const issues = { ...issueList, items: [{ ...issueList.items[0], issueType: 'GOAL_NOT_REACHED' }] }
  render(<IssuePanel runId="run_test" steps={[]} stepsFailed={false} onRetrySteps={() => {}}
    issues={issues} pollingStatus="success" error={null} retrying={false} onRetry={() => {}}
    labelPage={() => '마이페이지'} validity="VALID" />)
  fireEvent.click(screen.getByRole('button', { name: /메뉴 선택 확률 분산/ }))
  expect(screen.getByText(/목표에 도달하지 못함 · 진단 전체/)).toBeTruthy()
  expect(screen.queryByText(/GOAL_NOT_REACHED/)).toBeNull()
  expect(screen.queryByText(/화면: 마이페이지/)).toBeNull()
})

it('화면 검토 후보의 화면 이름은 label로 표시한다', () => {
  render(<IssuePanel runId="run_test" steps={[]} stepsFailed={false} onRetrySteps={() => {}}
    issues={issueList} pollingStatus="success" error={null} retrying={false} onRetry={() => {}}
    labelPage={() => '마이페이지'} validity="VALID" />)
  fireEvent.click(screen.getByRole('button', { name: /메뉴 선택 확률 분산/ }))
  expect(screen.getByText(/화면: 마이페이지/)).toBeTruthy()
  // 문제 유형은 코드값 대신 사용자 문구로 보인다
  expect(screen.getByText(/고르기 어려운 화면/)).toBeTruthy()
  expect(screen.queryByText(/CHOICE_AMBIGUITY/)).toBeNull()
})

it('대기 조회가 끝나도 대기를 유지하고 실패는 별도로 표시한다', () => {
  const props = { runId: 'run_test', steps: [], stepsFailed: false, onRetrySteps: () => {},
    error: null, retrying: false, onRetry: () => {} }
  const view = render(<IssuePanel {...props} issues={{ ...issueList, analysisStatus: 'PENDING', items: [] }} pollingStatus="exhausted" />)
  expect(screen.getByText('분석 대기 중')).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 조회' })).toBeTruthy()
  view.rerender(<IssuePanel {...props} issues={{ ...issueList, analysisStatus: 'FAILED', items: [] }} pollingStatus="done" />)
  expect(screen.getByText('분석에 실패했습니다')).toBeTruthy()
  expect(screen.queryByText('검토 후보 없음')).toBeNull()
})
