import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { ChoiceSummary } from '../src/features/improvement/ChoiceSummary.tsx'
import { shortReason } from '../src/features/improvement/reasons.ts'

// "어떻게 골랐는지 보기"의 짧은 요약 (#103): 몇 개 시험해 무엇을 골랐는지 → 나머지를 왜 뺐는지 → 이름별 가능성과 결과

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = (id: string): any => JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/improvements/${id}.json`), 'utf-8'))
const GOALS = { S1: '환불', S2: '배송', S3: '쿠폰', S4: '문의' }

function show(id: string) {
  const view = toImprovementView(read(id))
  return render(<ChoiceSummary view={view} goalNames={GOALS} />)
}

it('고른 이름이 있으면 몇 개를 시험해 무엇을 골랐는지 한 줄로 보이고, 목록 맨 위에 둔다', () => {
  const { container } = show('imp-1119b')
  const head = screen.getByText(/이름 \d+개를 시험해서/)
  expect(head.textContent).toMatch(/^이름 \d+개를 시험해서 '주문 환불'을 골랐어요\.$/)
  const rows = [...container.querySelectorAll('.imp-choice-list li')]
  // 첫 줄은 지금 이름, 그다음이 고른 이름
  expect(rows[0].textContent).toMatch(/^'이용정보' \(지금\)/)
  expect(rows[1].textContent).toMatch(/^'주문 환불'.*✓ 골랐어요$/)
  expect(rows[1].getAttribute('data-adopted')).toBe('true')
})

it('뺀 이름은 가장 많은 이유를 한 문장으로 말하고, 줄마다 짧은 이유를 붙인다', () => {
  show('imp-1119b')
  expect(screen.getByText(/^나머지는 (모두|대부분) 문의 목표가 떨어져서 뺐어요\.$/)).toBeTruthy()
  expect(screen.getAllByText('문의 목표가 떨어져요').length).toBeGreaterThan(0)
})

it('같은 이름은 한 번만 보이고, 코드·회차 번호는 보이지 않는다', () => {
  const { container } = show('imp-1119b')
  const names = [...container.querySelectorAll('.imp-choice-list li > span:first-child')].map((el) => el.textContent)
  expect(new Set(names).size).toBe(names.length)
  const text = container.textContent ?? ''
  for (const code of ['GUARD_LOSS', 'S4', 'R1-', '회차', '번째 시도', 'B 평가']) expect(text).not.toContain(code)
})

it('고른 이름이 없으면 찾지 못했다고 말한다', () => {
  show('imp-1119')
  expect(screen.getByText(/이름 \d+개를 시험해서/).textContent).toMatch(/고를 이름을 찾지 못했어요\.$/)
  expect(screen.queryByText('✓ 골랐어요')).toBeNull()
})

it('짧은 이유: 다른 목표가 떨어지면 누가 헷갈리는지, 그 밖에는 짧은 말로 바꾼다', () => {
  expect(shortReason('GUARD_LOSS_EXCEEDED:S4', GOALS)).toBe('문의 목표가 떨어져요')
  expect(shortReason('GUARD_LOSS_EXCEEDED:S2,S4', GOALS)).toBe('배송·문의 목표가 떨어져요')
  expect(shortReason('GUARD_LOSS_EXCEEDED:X9', GOALS)).toBe('다른 목표가 떨어져요')
  expect(shortReason('MAIN_GAIN_INSUFFICIENT')).toBe('별로 안 나아져요')
  expect(shortReason('TIE_LOST')).toBe('더 나은 이름이 있어요')
  expect(shortReason('SOMETHING_NEW')).toBe('다른 이유가 있었어요')
})
