import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// AI 개선 결과의 개선 효과 영역 (SummarySection)과 접힌 점수 계산 (OfficialSection)

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
  return screen.findByRole('region', { name: '개선 효과' })
}

const officialDetails = () => screen.getByText('점수 계산 자세히 보기').closest('details') as HTMLElement
const lineOf = (area: HTMLElement, name: string) => within(area).getByText(name).parentElement as HTMLElement

it('IMPROVED: 바꿀 이름·전후 점수·변화량·다른 고객 판정을 보인다', async () => {
  const area = await renderWith(improved())
  const hero = area.querySelector('.summary-hero') as HTMLElement
  expect(hero.textContent).toBe('상단 메뉴 "이용정보" → "주문내역"(으)로 바꿔 보세요AI 제안')
  const main = lineOf(area, '환불하려는 고객')
  expect(within(main).getByText('38.5%')).toBeTruthy()
  expect(within(main).getByText('70.1%')).toBeTruthy()
  expect(within(main).getByText('+31.6%p')).toBeTruthy()
  expect(within(area).getByText('개선안 화면에서 다시 잰 값이에요')).toBeTruthy()
  // 다른 고객 3명. 문의는 −0.8%p이며 허용 범위(−2.0%p) 이내
  const s4 = lineOf(area, '문의 고객')
  expect(within(s4).getByText('-0.8%p')).toBeTruthy()
  expect(within(s4).getByText('괜찮음')).toBeTruthy()
  expect(within(area).getAllByText('괜찮음')).toHaveLength(3)
  expect(within(area).getByText('지금 화면보다 -2.0%p까지만 떨어져도 괜찮다고 봐요')).toBeTruthy()
})

it('허용 범위를 넘는 감소도 숨기지 않고 너무 많이 떨어짐으로 표시한다', async () => {
  const body = improved()
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.7, delta: -0.07 }
  const area = await renderWith(body)
  const s4 = lineOf(area, '문의 고객')
  expect(within(s4).getByText('-7.0%p')).toBeTruthy()
  expect(within(s4).getByText('너무 많이 떨어짐')).toBeTruthy()
})

it('NO_IMPROVEMENT: 바꿔도 좋아지지 않았음을 보이고 후 점수·변화량·후 이름은 숨긴다', async () => {
  const area = await renderWith(noImprovement())
  expect(within(area).getByText(/이 목표는 "이용정보" 이름만 바꿔서는 좋아지지 않았어요\./)).toBeTruthy()
  expect(within(area).getByText('40.2%')).toBeTruthy() // 지금 점수
  expect(area.querySelector('.summary-delta')).toBeNull()
  expect(within(area).queryByText(/^(괜찮음|너무 많이 떨어짐)$/)).toBeNull()
  expect(area.textContent).not.toContain('→ ')
  expect(area.textContent).not.toContain('주문내역')
  expect(within(area).queryByText('AI 제안')).toBeNull()
  expect(within(area).queryByText('개선안 화면에서 다시 잰 값이에요')).toBeNull()
  // 공식 평가가 없으면 점수 계산 영역도 없다
  expect(screen.queryByText('점수 계산 자세히 보기')).toBeNull()
})

it('점수 계산: 공식 최종안 이름·점수·이름 외 차이 없음·A/B 차이를 보인다', async () => {
  await renderWith(improved())
  const details = officialDetails()
  expect(within(details).getByText(/공식 평가 최종안/).textContent).toContain('주문내역')
  expect(within(details).getByText('주 목표 점수').nextSibling?.textContent).toBe('70.1%')
  expect(within(details).getByText('S2 배송').nextSibling?.textContent).toBe('81.2%')
  expect(within(details).getByText(/이름 외 차이 없음/)).toBeTruthy()
  expect(within(details).getByText(/추정\(A\)과 공식\(B\)의 차이: 최대 0\.6%p/)).toBeTruthy()
})

it('모르는 scoreSource는 개발용 원문을 보이지 않고, 모르는 buildCheck는 점수 계산 안에서 "확인 필요"로 보인다', async () => {
  const body = improved()
  body.summary.scoreSource = 'SOMETHING_NEW'
  body.official.site.buildCheck = 'EXTRA_DIFF'
  const area = await renderWith(body)
  expect(area.textContent).not.toContain('SOMETHING_NEW')
  expect(within(area).queryByText('개선안 화면에서 다시 잰 값이에요')).toBeNull()
  expect(within(officialDetails()).getByText('사이트 확인: 확인 필요')).toBeTruthy()
})

it('IMPROVED에서 후 점수가 null이면 0%로 보이지 않고 이 영역만 안내한다', async () => {
  const body = improved()
  body.summary.guards[0] = { ...body.summary.guards[0], after: null, delta: null }
  const area = await renderWith(body)
  expect(area.textContent).not.toContain('0.0%')
  expect(within(area).getByRole('alert').textContent).toBe('이 부분을 보여줄 수 없어요.')
})

it('IMPROVED에서 변화량이 없으면 0.0%p로 보이지 않고 이 영역만 안내한다', async () => {
  const body = improved()
  body.summary.guards[0] = { ...body.summary.guards[0], delta: undefined }
  const area = await renderWith(body)
  expect(within(area).getByRole('alert').textContent).toBe('이 부분을 보여줄 수 없어요.')
  expect(area.textContent).not.toContain('0.0%p')
})

it('필수 필드가 없으면 이 영역만 안내하고 점수 계산은 정상이다', async () => {
  const body = improved()
  delete body.summary.main.before
  const area = await renderWith(body)
  expect(within(area).getByRole('alert')).toBeTruthy()
  const details = officialDetails()
  expect(within(details).queryByRole('alert')).toBeNull()
  await waitFor(() => expect(within(details).getByText('70.1%')).toBeTruthy())
  // 리포트를 못 읽으면 목표 이름 없이 키만 보인다
  expect(within(details).getByText('S2')).toBeTruthy()
})

it('모르는 summary.result는 이름을 정하지 못했다고 보이고 후 값은 숨긴다', async () => {
  const body = improved()
  body.summary.result = 'PARTIAL'
  const area = await renderWith(body)
  expect(within(area).getByText(/이번 실행에서는 바꿀 이름을 정하지 못했어요\./)).toBeTruthy()
  expect(area.textContent).not.toContain('PARTIAL')
  expect(within(area).queryByText('주문내역')).toBeNull()
  expect(within(area).queryByText('70.1%')).toBeNull()
  expect(area.querySelector('.summary-delta')).toBeNull()
  expect(area.textContent).not.toContain('→ 값 없음')
})

it('plan.rules.maxGuardLoss로 허용 범위를 판정한다', async () => {
  const body = improved()
  body.plan.rules = { maxGuardLoss: 0.01 }
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.755, delta: -0.015 }
  const area = await renderWith(body)
  expect(within(area).getByText(/-1\.0%p까지만 떨어져도 괜찮다고 봐요/)).toBeTruthy()
  expect(within(lineOf(area, '문의 고객')).getByText('너무 많이 떨어짐')).toBeTruthy()
  expect(within(area).getAllByText('괜찮음')).toHaveLength(2)
})

it('허용 범위가 정확히 경계(−2.0%p)이면 괜찮음이다', async () => {
  const body = improved()
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.75, delta: -0.02 }
  const area = await renderWith(body)
  expect(within(lineOf(area, '문의 고객')).getByText('괜찮음')).toBeTruthy()
})

it('허용 범위 키가 없으면 범위 판정을 보이지 않는다', async () => {
  const body = improved()
  body.plan.rules = {}
  const area = await renderWith(body)
  expect(within(area).queryByText(/떨어져도 괜찮다고 봐요/)).toBeNull()
  expect(within(area).queryByText(/^(괜찮음|너무 많이 떨어짐)$/)).toBeNull()
})

it('다른 고객이 없으면 없다고 안내한다', async () => {
  const body = improved()
  body.summary.guards = []
  const area = await renderWith(body)
  expect(within(area).getByText('함께 살펴본 다른 고객이 없어요')).toBeTruthy()
})
