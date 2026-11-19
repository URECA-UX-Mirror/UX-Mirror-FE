import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { VerificationSection } from '../src/features/improvement/VerificationSection.tsx'

// 개선안에서 AI 고객으로 다시 해 본 결과 (VerificationSection)

function improved() { return JSON.parse(readFileSync('tests/fixtures/improvement.improved.json', 'utf8')) }
function show(data: ReturnType<typeof improved>, mainGoalKey: string | null = 'S1') {
  const view = toImprovementView(data)
  if (!view.verification.ok) throw new Error(view.verification.reason)
  return render(<MemoryRouter><VerificationSection verification={view.verification.data} mainGoalKey={mainGoalKey} /></MemoryRouter>)
}
const sides = (root: ParentNode) => [...root.querySelectorAll('.imp-side')].map((el) => el.textContent)
const mainSides = () => sides(document.querySelector('.imp-verification > .imp-sides')!)

it('이 고객의 지금 화면·개선안 결과와 나란히 비교하기를 보이고, 다른 고객은 접어 둔다', () => {
  show(improved())
  expect(mainSides()).toEqual(['지금 화면못 찾음', '개선안2번 만에 도착'])
  const links = screen.getAllByRole('link', { name: '나란히 비교하기' })
  expect(links[0].getAttribute('href')).toBe('/comparisons/imp-1119-s1')
  const fold = screen.getByText('다른 고객도 보기').closest('details')!
  expect(fold.open).toBe(false)
  const other = within(fold).getByRole('region', { name: '문의 고객' })
  expect(sides(other)).toEqual(['지금 화면1번 만에 도착', '개선안1번 만에 도착'])
  expect(within(other).getByRole('link', { name: '나란히 비교하기' }).getAttribute('href')).toBe('/comparisons/imp-1119-s4')
  expect(screen.queryByRole('status')).toBeNull()
  expect(document.body.textContent).not.toContain('GOAL_NOT_REACHED')
})

it('이 고객 키를 모르면 첫 쌍을 크게 보인다', () => {
  show(improved(), null)
  expect(mainSides()).toEqual(['지금 화면못 찾음', '개선안2번 만에 도착'])
})

it('다시 해 보지 않았으면(NOT_RUN) 한 줄 안내만 보인다', () => {
  const data = improved(); data.verification.status = 'NOT_RUN'; data.verification.pairs = []
  show(data)
  expect(screen.getByText('바꿀 이름이 없어서 다시 해 보지 않았어요.')).toBeTruthy()
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it('중간에 멈췄으면(FAILED) 끝난 것만 보이고 무효·누락 실행에는 비교 링크를 두지 않는다', () => {
  const data = improved(); data.verification.status = 'FAILED'; data.verification.error = { code: 'FAILED_CODE', message: '오류 사유' }
  data.verification.pairs[0].before.validity = 'INVALID'
  data.verification.pairs[0].after = null
  data.verification.pairs[1].after = null
  show(data)
  expect(screen.getByRole('status').textContent).toBe('다시 해 보다가 멈췄어요. 끝난 것만 보여 드려요.')
  expect(document.body.textContent).not.toContain('FAILED_CODE')
  expect(mainSides()).toEqual(['지금 화면판단할 수 없어요', '개선안기록 없음'])
  expect(screen.queryAllByRole('link', { name: '나란히 비교하기' })).toHaveLength(0)
})

it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/bad\npath'])('외부 또는 비정상 경로 %s는 링크로 만들지 않는다', (path) => {
  const data = improved(); data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].comparisonPath = path
  show(data)
  expect(screen.queryByRole('link', { name: '나란히 비교하기' })).toBeNull()
})

it.each(['RUNNING', 'READY', 'UNKNOWN', null])('끝나지 않은 상태 %s의 실행이 있으면 비교 링크를 두지 않는다', (status) => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.status = status
  show(data)
  expect(screen.queryByRole('link', { name: '나란히 비교하기' })).toBeNull()
})

it('도착 여부를 모르면 "알 수 없어요", 클릭 수를 모르면 "도착"만 보인다', () => {
  const data = improved()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.goalReached = null
  data.verification.pairs[0].after.stepCount = null
  show(data)
  expect(mainSides()).toEqual(['지금 화면알 수 없어요', '개선안도착'])
  expect(screen.queryByText('다른 고객도 보기')).toBeNull()
})
