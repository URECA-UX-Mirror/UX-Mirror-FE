import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { VerificationSection } from '../src/features/improvement/VerificationSection.tsx'

// 개선안에서 AI 고객으로 다시 확인한 결과 (VerificationSection)

function improved() { return JSON.parse(readFileSync('tests/fixtures/improvement.improved.json', 'utf8')) }
function show(data: ReturnType<typeof improved>) {
  const view = toImprovementView(data)
  if (!view.verification.ok) throw new Error(view.verification.reason)
  return render(<MemoryRouter><VerificationSection verification={view.verification.data} /></MemoryRouter>)
}
const pairOf = (name: string) => screen.getByRole('heading', { name }).closest('article') as HTMLElement

it('끝난 확인은 고객별로 지금 화면과 개선안 결과·경로·문제·다시 보기·비교 링크를 보인다', () => {
  show(improved())
  const refund = pairOf('환불하려는 고객')
  expect(within(refund).getByRole('heading', { name: '지금 화면 · "이용정보"' })).toBeTruthy()
  expect(within(refund).getByRole('heading', { name: '개선안 · "주문내역"' })).toBeTruthy()
  expect(within(refund).getByText('4번 눌렀지만 찾지 못함')).toBeTruthy()
  expect(within(refund).getByText('2번 만에 도착')).toBeTruthy()
  expect(within(refund).getByText('홈 → 주문 내역 → 환불 신청')).toBeTruthy()
  expect(within(refund).getByText(/목표에 도달하지 못함 · 같은 화면 반복 방문/)).toBeTruthy()
  expect(refund.textContent).not.toContain('GOAL_NOT_REACHED')
  expect(within(refund).getByRole('link', { name: '나란히 비교하기' }).getAttribute('href')).toBe('/comparisons/imp-1119-s1')
  expect(within(refund).getAllByRole('link', { name: '다시 보기' }).map((a) => a.getAttribute('href')))
    .toEqual(['/runs/run_before_improved_s1/result', '/runs/run_after_improved_s1/result'])
  expect(within(pairOf('문의하려는 고객')).getAllByText('1번 만에 도착')).toHaveLength(2)
  expect(screen.getAllByRole('link', { name: '다시 보기' })).toHaveLength(4)
  expect(screen.queryByRole('status')).toBeNull()
})

it('확인하지 않았으면(NOT_RUN) 안내만 보인다', () => {
  const data = improved(); data.verification.status = 'NOT_RUN'; data.verification.pairs = []
  show(data)
  expect(screen.getByText(/이번에는 개선안에서 다시 확인하지 않았어요/)).toBeTruthy()
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it('중간에 멈췄으면(FAILED) 끝난 것까지만 보이고 무효·누락 실행에는 링크를 두지 않는다', () => {
  const data = improved(); data.verification.status = 'FAILED'; data.verification.error = { code: 'FAILED_CODE', message: '오류 사유' }
  data.verification.pairs[0].before.validity = 'INVALID'
  data.verification.pairs[0].after = null
  data.verification.pairs[1].after = null
  show(data)
  expect(screen.getByRole('status').textContent).toBe('개선안에서 다시 확인하는 중에 멈췄어요. 끝난 것까지만 보여줘요.')
  expect(document.body.textContent).not.toContain('FAILED_CODE')
  const first = pairOf('환불하려는 고객')
  expect(within(first).getByText('결과를 판단할 수 없음')).toBeTruthy()
  expect(within(first).getByText('실행 기록이 없어요')).toBeTruthy()
  expect(within(first).queryAllByRole('link')).toHaveLength(0)
  // 무효 실행의 문제 목록은 보이지 않는다
  expect(within(first).queryByText(/목표에 도달하지 못함/)).toBeNull()
  expect(screen.getAllByRole('link', { name: '다시 보기' })).toHaveLength(1)
  expect(screen.queryAllByRole('link', { name: '나란히 비교하기' })).toHaveLength(0)
})

it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/bad\npath'])('외부 또는 비정상 경로 %s는 링크로 만들지 않는다', (path) => {
  const data = improved(); data.verification.pairs = [data.verification.pairs[0]]
  const pair = data.verification.pairs[0]
  pair.comparisonPath = path; pair.before.resultPath = path
  show(data)
  expect(screen.queryByRole('link', { name: '나란히 비교하기' })).toBeNull()
  expect(screen.getAllByRole('link', { name: '다시 보기' }).map((a) => a.getAttribute('href'))).toEqual(['/runs/run_after_improved_s1/result'])
})

it.each(['RUNNING', 'READY', 'UNKNOWN', null])('끝나지 않은 상태 %s의 실행에는 다시 보기·비교 링크를 두지 않는다', (status) => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.status = status
  show(data)
  expect(screen.queryByRole('link', { name: '나란히 비교하기' })).toBeNull()
  expect(screen.getAllByRole('link', { name: '다시 보기' }).map((a) => a.getAttribute('href'))).toEqual(['/runs/run_after_improved_s1/result'])
})

it('도착 여부를 모르면 결과 정보 없음, 클릭 수를 모르면 숫자 없이 보인다', () => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.goalReached = null
  data.verification.pairs[0].after.stepCount = null
  show(data)
  expect(screen.getByText('결과 정보 없음')).toBeTruthy()
  expect(screen.getByText('만에 도착')).toBeTruthy()
})

it('모르는 문제 코드는 원문 대신 확인이 필요한 점으로 보인다', () => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.issues = ['UNKNOWN_CODE']
  show(data)
  expect(screen.getByText('확인이 필요한 점')).toBeTruthy()
  expect(document.body.textContent).not.toContain('UNKNOWN_CODE')
})

it('목표 이름이 없으면 고객으로만 보인다', () => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].name = null
  show(data)
  expect(screen.getByRole('heading', { level: 3, name: '고객' })).toBeTruthy()
})
