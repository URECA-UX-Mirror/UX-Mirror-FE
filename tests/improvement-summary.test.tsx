import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { eulOf, roOf } from '../src/features/improvement/labels.ts'
import { server } from './setup.ts'

// AI 개선 결과의 결론 카드 (SummarySection)

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const read = (path: string): Json => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8'))
const improved = (): Json => read('tests/fixtures/improvement.improved.json')
const noImprovement = (): Json => {
  const official = read('tests/fixtures/improvements/imp-1119.json')
  return { ...improved(), summary: official.summary, official: official.official }
}

async function renderWith(report: Json) {
  server.use(
    http.get(apiUrl('/api/improvements/:improvementId'), () =>
      HttpResponse.json({
        improvementId: 'imp_T', kind: 'LIVE', status: 'COMPLETED', phase: 'DONE',
        createdAt: null, startedAt: null, finishedAt: null, error: null, input: null, improvement: report,
      })),
  )
  render(
    <MemoryRouter initialEntries={['/improvements/imp_T']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('region', { name: '결론' })
}

const numberOf = (area: HTMLElement, term: string) => within(area).getByText(term).nextElementSibling as HTMLElement
const guards = (area: HTMLElement) => area.querySelector('.imp-guards') as HTMLDetailsElement

it('IMPROVED: 바꿀 이름 한 줄, 찾아올 가능성 전→후, 다른 고객 "괜찮아요"(접힘)를 보인다', async () => {
  const area = await renderWith(improved())
  expect(area.querySelector('.imp-headline')?.textContent).toBe("상단 메뉴 '이용정보' → '주문내역'으로 바꿔 보세요")
  expect(numberOf(area, '이 고객이 찾아올 가능성').textContent).toBe('38.5% → 70.1%+31.6%p')
  const fold = guards(area)
  expect(fold.open).toBe(false)
  expect(fold.querySelector('summary')?.textContent).toBe('괜찮아요')
  fireEvent.click(fold.querySelector('summary')!)
  expect(within(fold).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    '배송 고객 68.0% → 81.2%+13.2%p',
    '쿠폰 고객 77.1% → 90.3%+13.2%p',
    '문의 고객 77.0% → 76.2%-0.8%p',
  ])
  expect(within(fold).getByText('-2.0%p까지는 괜찮다고 봐요.')).toBeTruthy()
})

it('허용 범위를 넘게 떨어진 고객이 있으면 "많이 떨어졌어요"로 보이고 그 고객을 표시한다', async () => {
  const body = improved()
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.7, delta: -0.07 }
  const area = await renderWith(body)
  expect(guards(area).querySelector('summary')?.textContent).toBe('많이 떨어졌어요')
  const s4 = within(guards(area)).getByText('문의 고객').parentElement!
  expect(s4.textContent).toContain('-7.0%p')
  expect(s4.textContent).toContain('많이 떨어졌어요')
})

it('plan.rules.maxGuardLoss로 범위를 판정하고, 정확히 경계면 괜찮아요다', async () => {
  const body = improved()
  body.plan.rules = { maxGuardLoss: 0.01 }
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.76, delta: -0.01 }
  const area = await renderWith(body)
  expect(guards(area).querySelector('summary')?.textContent).toBe('괜찮아요')
  expect(within(guards(area)).getByText('-1.0%p까지는 괜찮다고 봐요.')).toBeTruthy()
})

it('허용 범위가 없으면 판정 없이 "점수 보기"로만 접어 둔다', async () => {
  const body = improved()
  body.plan.rules = {}
  const area = await renderWith(body)
  expect(guards(area).querySelector('summary')?.textContent).toBe('점수 보기')
  expect(area.textContent).not.toContain('괜찮아요')
})

it('다른 고객이 없으면 다른 고객 줄을 두지 않는다', async () => {
  const body = improved()
  body.summary.guards = []
  const area = await renderWith(body)
  expect(within(area).queryByText('다른 고객')).toBeNull()
})

it('NO_IMPROVEMENT: "이름만 바꿔서는 나아지지 않았어요"와 지금 점수만 보이고 후 값은 숨긴다', async () => {
  const area = await renderWith(noImprovement())
  expect(area.querySelector('.imp-headline')?.textContent).toBe('이름만 바꿔서는 나아지지 않았어요')
  expect(area.textContent).toContain("지금은 '이용정보' 메뉴 이름만 바꿀 수 있어요.")
  expect(numberOf(area, '이 고객이 찾아올 가능성').textContent).toBe('40.2%')
  expect(area.textContent).not.toContain('→')
  expect(area.textContent).not.toContain('바꿔 보세요')
  expect(within(area).queryByText('다른 고객')).toBeNull()
})

it('모르는 summary.result는 이름을 못 정했다고 보이고 후 값·원문은 숨긴다', async () => {
  const body = improved()
  body.summary.result = 'PARTIAL'
  const area = await renderWith(body)
  expect(area.querySelector('.imp-headline')?.textContent).toBe('이번에는 바꿀 이름을 못 정했어요')
  expect(area.textContent).not.toContain('PARTIAL')
  expect(area.textContent).not.toContain('주문내역')
  expect(area.textContent).not.toContain('70.1%')
})

it.each([
  ['후 점수가 null', (g: Json) => ({ ...g, after: null, delta: null })],
  ['변화량이 없음', (g: Json) => ({ ...g, delta: undefined })],
])('IMPROVED에서 %s이면 0으로 보이지 않고 결론만 안내한다', async (_name, change) => {
  const body = improved()
  body.summary.guards[0] = change(body.summary.guards[0])
  const area = await renderWith(body)
  expect(within(area).getByRole('alert').textContent).toBe('이 부분을 보여 드릴 수 없어요.')
  expect(area.textContent).not.toContain('0.0%')
})

it.each([
  ['주문내역', '으로', '을'], ['주문 환불', '로', '을'], ['배송 조회', '로', '를'], ['내 주문', '으로', '을'], ['FAQ', '(으)로', '을(를)'],
])('조사: %s → %s / %s', (word, ro, eul) => {
  expect(roOf(word)).toBe(ro)
  expect(eulOf(word)).toBe(eul)
})
