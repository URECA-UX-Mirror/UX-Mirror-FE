import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { RoundsSection } from '../src/features/improvement/RoundsSection.tsx'
import { describeReason } from '../src/features/improvement/reasons.ts'

// "어떻게 골랐는지 보기" 안의 시험한 이름 (RoundsSection)

function show(path: string, change?: (data: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const data = JSON.parse(readFileSync(path, 'utf8'))
  change?.(data)
  const view = toImprovementView(data)
  if (!view.rounds.ok) throw new Error(view.rounds.reason)
  render(<RoundsSection rounds={view.rounds.data} stop={view.stop} goals={view.plan?.guardGoals ?? []} />)
}
const round = (n: number) => screen.getByRole('region', { name: `${n}번째 시도` })
const rowOf = (area: HTMLElement, label: string) => within(area).getByText(`'${label}'`, { exact: false }).closest('li') as HTMLElement

it('시도마다 막힌 곳·시작 이름·후보별 찾아올 가능성과 결과를 사람 말로 보인다', () => {
  show('tests/fixtures/improvement.improved.json')
  expect(screen.getByRole('heading', { name: '시험한 이름 (3번 시도)' })).toBeTruthy()
  const first = round(1)
  expect(first.textContent).toContain("고객이 '이용정보' 대신 '고객센터'를 더 많이 눌렀어요.")
  expect(first.textContent).toContain("시작 이름 '이용정보' · 38.5%")
  expect(rowOf(first, '주문 관리').dataset.adopted).toBe('true')
  expect(rowOf(first, '주문 관리').textContent).toBe("'주문 관리' · 사람이 낸 이름54.0%골랐어요")
  expect(rowOf(first, '주문·환불').textContent).toContain('문의 고객이 많이 떨어졌어요')
  expect(rowOf(first, '주문·서비스').textContent).toContain('안 해 봄')
  expect(rowOf(first, '주문·서비스').textContent).toContain('쓸 수 없는 후보예요 (글자가 화면 밖으로 나가요)')
  expect(rowOf(first, '주문·지원').textContent).toContain('점수 못 냄')
  expect(first.textContent).toContain("미리 걸러낸 이름: '주문·환' (글자가 잘려요)")
  expect(round(3).textContent).toContain('이번 시도에서는 고른 이름이 없어요.')
  expect(screen.getByText('멈춘 이유: 정한 횟수를 다 해 봤어요')).toBeTruthy()
  // 코드·후보 id·BE 설명 원문은 보이지 않는다
  const text = document.body.textContent ?? ''
  for (const code of ['R1-H', 'GUARD_LOSS', 'MAX_ROUNDS', 'S4', '0.695', 'HUMAN']) expect(text).not.toContain(code)
})

it('모르는 사유 코드는 원문 대신 "다른 이유가 있었어요"로 보인다', () => {
  show('tests/fixtures/improvement.improved.json', (data) => {
    data.rounds[2].candidates[0].reason = 'UNKNOWN_REASON'
    data.rounds[2].proposal.filtered[0].rejectedReason = 'UNKNOWN_FILTER'
  })
  expect(rowOf(round(3), '내 주문').textContent).toContain('다른 이유가 있었어요')
  expect(round(3).textContent).toContain("'주문·반품내역' (다른 이유가 있었어요)")
  expect(document.body.textContent).not.toContain('UNKNOWN')
})

it('BE 정책 사유를 목표 이름으로 풀어 쓴다', () => {
  show('tests/fixtures/improvement.policy-reasons.json')
  const first = round(1)
  expect(rowOf(first, '주문·환불').textContent).toContain('문의 고객이 많이 떨어졌어요')
  expect(rowOf(first, '주문·반품').textContent).toContain('배송·문의 고객이 많이 떨어졌어요')
  expect(rowOf(first, '주문·배송').textContent).toContain('나아진 폭이 작았어요')
  expect(screen.getByText('멈춘 이유: 여러 번 연달아 고를 이름이 없었어요')).toBeTruthy()
})

it.each([
  ['EMPTY_LABEL', '이름이 비었어요'],
  ['LABEL_TOO_LONG', '이름이 너무 길어요'],
  ['DUPLICATE_LABEL', '겹치는 이름이에요'],
  ['EXISTING_LABEL', '이미 써 본 이름이에요'],
  ['DANGEROUS_LABEL', '위험한 동작이 들어 있어요'],
  ['TRUNCATED_LABEL', '글자가 잘려요'],
  ['INVALID_FORMAT', '이름 모양이 맞지 않아요'],
  ['CANDIDATE_LIMIT_EXCEEDED', '후보가 너무 많았어요'],
  ['EVALUATION_FAILED', '점수를 내지 못했어요'],
  ['SCORE_MISSING', '점수가 없어요'],
  ['INVALID_CANDIDATE', '쓸 수 없는 후보예요'],
  ['GUARD_LOSS_EXCEEDED', '다른 고객이 많이 떨어졌어요'],
  ['MAIN_GAIN_INSUFFICIENT', '나아진 폭이 작았어요'],
  ['GUARD_LOSS_EXCEEDED:S4,S9', '문의 고객이 많이 떨어졌어요'],
  ['GUARD_LOSS_EXCEEDED:S9', '다른 고객이 많이 떨어졌어요'],
  ['INVALID_CANDIDATE:LABEL_OVERFLOW,UNKNOWN', '쓸 수 없는 후보예요 (글자가 화면 밖으로 나가요)'],
  ['EVALUATION_FAILED:UNKNOWN', '점수를 내지 못했어요'],
  ['UNKNOWN:DETAIL', '다른 이유가 있었어요'],
])('사유 %s → %s', (code, expected) => {
  expect(describeReason(code, { S4: '문의' })).toBe(expected)
})
