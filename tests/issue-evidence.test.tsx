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
  candidates: [], backOptionId: null,
  decision: { selectedOptionId: 'a', selectedActionType: 'CLICK', resultOrigin: 'MOCK',
    goalJudgmentMode: 'DOM_ONLY', modelGoalReached: null, modelGoalYesProb: null,
    verifiedGoalReached: false, goalJudgmentMismatch: false, normalizedEntropy: null,
    clickOnlyNormalizedEntropy: null, goBackProbability: null, top2Margin: null,
    clickOnlyTop2Margin: null, goalPathProbability: null, modelLatencyMs: null, metricWarnings: [] },
  action: { selectedOptionId: 'a', executedOptionId: 'a', actionType: 'CLICK', result: 'NO_CHANGE',
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
  fireEvent.click(screen.getByRole('button', { name: 'Step 3 보기' }))
  image = screen.getByRole('img', { name: 'Step 3 근거 화면' }) as HTMLImageElement
  expect(image.src).toContain('/api/runs/run_test/screenshots/3?kind=original')
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
