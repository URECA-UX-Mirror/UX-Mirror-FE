import { readFileSync } from 'node:fs'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { RoundsSection } from '../src/features/improvement/RoundsSection.tsx'
import { describeReason } from '../src/features/improvement/reasons.ts'

function setup() {
  const improved = JSON.parse(readFileSync('tests/fixtures/improvement.improved.json', 'utf8'))
  improved.rounds[2].candidates[0].reason = 'UNKNOWN_REASON'
  improved.rounds[2].proposal.filtered[0].rejectedReason = 'UNKNOWN_FILTER'
  const view = toImprovementView(improved)
  if (!view.rounds.ok) throw new Error(view.rounds.reason)
  render(<RoundsSection rounds={view.rounds.data} stop={view.stop} goals={view.plan?.guardGoals ?? []} />)
}

it('기본 접힘 요약과 회차별 판정, 누락 점수 및 알 수 없는 사유를 표시한다', () => {
  setup()
  const details = screen.getByText(/3회차 진행/).closest('details')!
  expect(details.open).toBe(false)
  expect(details.querySelector('summary')?.textContent).toContain('채택 안: 주문내역')
  fireEvent.click(details.querySelector('summary')!)
  expect(details.open).toBe(true)
  const c2 = screen.getByRole('heading', { name: /R1-H2/ }).closest('article')!
  expect(c2.textContent).toContain('지킬 목표 문의(S4) 하락으로 탈락')
  expect(c2.textContent).toContain('사람')
  expect(within(c2).getByText('주 점수').nextElementSibling?.textContent).toBe('61.6%')
  expect(within(c2).getByText('지킬 점수').nextElementSibling?.textContent).toContain('문의(S4) 63.3%')
  const firstRound = screen.getByRole('heading', { name: '1회차' }).closest('section')!
  expect(within(firstRound).getByText(/고칠 버튼:/).textContent).toContain('19.5%')
  expect(within(firstRound).getByText('현재 기준').nextElementSibling?.textContent).toContain('38.5%')
  const skipped = screen.getByRole('heading', { name: /R1-A3/ }).closest('article')!
  expect(within(skipped).getByText('주 점수').nextElementSibling?.textContent).toBe('미실행')
  expect(within(skipped).getByText('지킬 점수').nextElementSibling?.textContent).toBe('미실행')
  expect(skipped.textContent).toContain('AI')
  const failed = screen.getByRole('heading', { name: /R1-A4/ }).closest('article')!
  expect(within(failed).getByText('주 점수').nextElementSibling?.textContent).toBe('평가 실패')
  expect(within(failed).getByText('지킬 점수').nextElementSibling?.textContent).toBe('평가 실패')
  expect(screen.getByText('이 회차는 채택 없음')).toBeTruthy()
  expect(screen.getByText('UNKNOWN_REASON')).toBeTruthy()
  expect(screen.getByText(/UNKNOWN_FILTER/)).toBeTruthy()
  expect(screen.getByText(/최대 회차 도달/)).toBeTruthy()
  expect(screen.getAllByText(/막힌 화면/)).toHaveLength(3)
})

it('백엔드 정책과 루프의 사유 코드를 목표 이름 및 원문과 함께 표시한다', () => {
  const fixture = JSON.parse(readFileSync('tests/fixtures/improvement.policy-reasons.json', 'utf8'))
  const view = toImprovementView(fixture)
  if (!view.rounds.ok) throw new Error(view.rounds.reason)
  render(<RoundsSection rounds={view.rounds.data} stop={view.stop} goals={view.plan?.guardGoals ?? []} />)
  fireEvent.click(screen.getByText(/1회차 진행/))
  expect(screen.getByText('지킬 목표 문의(S4) 하락으로 탈락 (GUARD_LOSS_EXCEEDED:S4)')).toBeTruthy()
  expect(screen.getByText('지킬 목표 배송(S2), 문의(S4) 하락으로 탈락 (GUARD_LOSS_EXCEEDED:S2,S4)')).toBeTruthy()
  expect(screen.getByText('주 목표 개선이 최소 기준 미달 (MAIN_GAIN_INSUFFICIENT)')).toBeTruthy()
  expect(screen.getByText(/단어가 잘림 \(TRUNCATED_LABEL\)/)).toBeTruthy()
  expect(screen.getByText(/연속 회차 채택 없음 \(NO_ADOPTION_STREAK\)/)).toBeTruthy()
})

it.each([
  ['EMPTY_LABEL', '빈 이름'],
  ['LABEL_TOO_LONG', '라벨이 너무 김'],
  ['DUPLICATE_LABEL', '중복된 이름'],
  ['EXISTING_LABEL', '기존 또는 이미 시도한 이름'],
  ['DANGEROUS_LABEL', '위험 동작이 포함된 이름'],
  ['TRUNCATED_LABEL', '단어가 잘림'],
  ['INVALID_FORMAT', '이름 형식이 올바르지 않음'],
  ['CANDIDATE_LIMIT_EXCEEDED', '후보 수 제한 초과'],
  ['EVALUATION_FAILED', '평가 실패'],
  ['SCORE_MISSING', '점수가 없거나 올바르지 않음'],
  ['INVALID_CANDIDATE', '유효하지 않은 후보'],
  ['GUARD_LOSS_EXCEEDED', '지킬 목표 하락으로 탈락'],
  ['MAIN_GAIN_INSUFFICIENT', '주 목표 개선이 최소 기준 미달'],
  ['GUARD_LOSS_EXCEEDED:S4,S9', '지킬 목표 문의(S4), S9 하락으로 탈락'],
  ['INVALID_CANDIDATE:LABEL_OVERFLOW,UNKNOWN', '유효하지 않은 후보: 라벨이 화면을 벗어남, UNKNOWN'],
  ['UNKNOWN:DETAIL', 'UNKNOWN:DETAIL'],
])('정책 사유 %s를 안전하게 표시한다', (code, expected) => {
  expect(describeReason(code, { S4: '문의' })).toBe(expected)
})
