import { readFileSync } from 'node:fs'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { RoundsSection } from '../src/features/improvement/RoundsSection.tsx'

function setup() {
  const sample = JSON.parse(readFileSync('public/improvements/imp_SAMPLE_0001.json', 'utf8'))
  sample.rounds[2].candidates[0].reason = 'UNKNOWN_REASON'
  sample.rounds[2].proposal.filtered[0].rejectedReason = 'UNKNOWN_FILTER'
  const view = toImprovementView(sample)
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
