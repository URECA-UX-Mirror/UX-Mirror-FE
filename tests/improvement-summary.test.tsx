import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// 자동 개선 리포트 개선 효과 분석 영역 (FE #79)

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const sample = (): Json =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/improvements/imp_SAMPLE_0001.json'), 'utf-8'),
  )
const noImprovement = (): Json => {
  const fixture: Json = JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.no-improvement.json'), 'utf-8'),
  )
  return { ...sample(), summary: fixture.summary, official: fixture.official }
}

async function renderWith(body: unknown) {
  server.use(http.get('/improvements/imp_T.json', () => HttpResponse.json(body as Json)))
  render(
    <MemoryRouter initialEntries={['/improvements/imp_T']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByText('imp_T')
  return screen.getByRole('region', { name: '① 개선 효과' })
}

it('IMPROVED: 전후 점수·변화량·지킬 목표를 보인다', async () => {
  const area = await renderWith(sample())
  expect(within(area).getByText('에이전트 예측')).toBeTruthy()
  expect(within(area).getByText(/상단 메뉴 ·/)).toBeTruthy()
  expect(within(area).getByText('이용정보')).toBeTruthy()
  expect(within(area).getByText('주문내역')).toBeTruthy()
  expect(within(area).getByText('AI 제안')).toBeTruthy()
  expect(within(area).getByText('38.5%')).toBeTruthy()
  expect(within(area).getByText('70.1%')).toBeTruthy()
  expect(within(area).getByText('+31.6%p')).toBeTruthy()
  // 지킬 목표 3개. S4는 −0.8%p이며 허용 범위(−2.0%p) 이내
  const s4 = within(area).getByText('S4 문의').parentElement as HTMLElement
  expect(within(s4).getByText('-0.8%p')).toBeTruthy()
  expect(within(s4).getByText('허용 범위 이내')).toBeTruthy()
  expect(within(area).getAllByText(/허용 범위 이내/)).toHaveLength(3)
  expect(within(area).getByText(/-2\.0%p 이내/)).toBeTruthy()
  expect(within(area).getByText(/공식 평가\(B\) 점수/)).toBeTruthy()
})

it('샘플이면 headline 끝의 (샘플)을 떼어 배지와 겹치지 않게 한다', async () => {
  const area = await renderWith(sample())
  const headline = area.querySelector('.summary-headline') as HTMLElement
  expect(headline.textContent).toContain('0.39 → 0.70')
  expect(headline.textContent).not.toContain('(샘플)')
  expect(screen.getByText('샘플 데이터')).toBeTruthy()
})

it('허용 범위를 넘는 감소도 숨기지 않고 초과로 표시한다', async () => {
  const body = sample()
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.7, delta: -0.07 }
  const area = await renderWith(body)
  const s4 = within(area).getByText('S4 문의').parentElement as HTMLElement
  expect(within(s4).getByText('-7.0%p')).toBeTruthy()
  expect(within(s4).getByText('허용 범위 초과')).toBeTruthy()
})

it('NO_IMPROVEMENT: 미채택을 보이고 후 점수·변화량·후 이름은 숨긴다', async () => {
  const area = await renderWith(noImprovement())
  expect(within(area).getByText(/개선안 미채택/)).toBeTruthy()
  expect(within(area).getByText('38.5%')).toBeTruthy() // 현재 점수
  expect(area.querySelector('.summary-delta')).toBeNull()
  expect(within(area).queryByText(/허용 범위 (이내|초과)/)).toBeNull()
  expect(area.textContent).not.toContain('→ ')
  expect(area.textContent).not.toContain('주문내역')
  expect(within(area).queryByText('AI 제안')).toBeNull()
  // 공식 평가는 없다
  expect(screen.getByText('공식 평가 결과 없음')).toBeTruthy()
})

it('공식 평가: 점수·이름 외 차이 없음·A/B 차이를 보인다', async () => {
  await renderWith(sample())
  const aux = screen.getByRole('region', { name: '보조 정보' })
  expect(within(aux).getByText('주문내역')).toBeTruthy()
  expect(within(aux).getByText('70.1%')).toBeTruthy()
  expect(within(aux).getByText('S2 배송').nextSibling?.textContent).toBe('81.2%')
  expect(within(aux).getByText(/이름 외 차이 없음/)).toBeTruthy()
  expect(within(aux).getByText(/추정\(A\)과 공식\(B\)의 차이: 최대 0\.6%p/)).toBeTruthy()
})

it('모르는 scoreSource·buildCheck는 원문으로 보인다', async () => {
  const body = sample()
  body.summary.scoreSource = 'SOMETHING_NEW'
  body.official.site.buildCheck = 'EXTRA_DIFF'
  const area = await renderWith(body)
  expect(within(area).getByText(/SOMETHING_NEW/)).toBeTruthy()
  expect(screen.getByText(/EXTRA_DIFF/)).toBeTruthy()
})

it('null 점수는 0%가 아니라 값 없음으로 보이거나 영역 오류가 된다', async () => {
  // IMPROVED에서 after가 null이면 필수 규칙 위반이라 영역 오류다
  const body = sample()
  body.summary.guards[0] = { ...body.summary.guards[0], after: null, delta: null }
  const area = await renderWith(body)
  expect(area.textContent).not.toContain('0.0%')
  expect(within(area).getByRole('alert').textContent).toContain('데이터 오류')
})

it('IMPROVED에서 변화량이 없으면 0.0%p로 보이지 않고 영역 오류가 된다', async () => {
  const body = sample()
  body.summary.guards[0] = { ...body.summary.guards[0], delta: undefined }
  const area = await renderWith(body)
  expect(within(area).getByRole('alert').textContent).toContain('delta')
})

it('필수 필드가 없으면 이 영역만 데이터 오류로 보인다', async () => {
  const body = sample()
  delete body.summary.main.before
  const area = await renderWith(body)
  expect(within(area).getByRole('alert').textContent).toContain('summary.main.before')
  // 다른 영역은 정상
  const aux = screen.getByRole('region', { name: '보조 정보' })
  expect(within(aux).queryByRole('alert')).toBeNull()
  await waitFor(() => expect(within(aux).getByText('70.1%')).toBeTruthy())
})

it('모르는 summary.result는 원문을 보이고 후 값은 숨긴다', async () => {
  const body = sample()
  body.summary.result = 'PARTIAL'
  const area = await renderWith(body)
  expect(within(area).getByText(/알 수 없는 결과: PARTIAL/)).toBeTruthy()
  expect(within(area).queryByText('주문내역')).toBeNull()
  expect(within(area).queryByText('70.1%')).toBeNull()
  expect(area.querySelector('.summary-delta')).toBeNull()
  expect(area.textContent).not.toContain('→ 값 없음')
})

it('maxGuardLoss로 허용 범위를 판정한다', async () => {
  const body = sample()
  body.plan.rules = { maxGuardLoss: 0.01 }
  body.summary.guards[2] = { ...body.summary.guards[2], after: 0.76, delta: -0.015 }
  const area = await renderWith(body)
  expect(within(area).getByText(/-1\.0%p 이내/)).toBeTruthy()
  const s4 = within(area).getByText('S4 문의').parentElement as HTMLElement
  expect(within(s4).getByText('허용 범위 초과')).toBeTruthy()
  expect(within(area).getAllByText('허용 범위 이내')).toHaveLength(2)
})

it('허용 범위 키가 둘 다 없으면 범위 판정을 보이지 않는다', async () => {
  const body = sample()
  body.plan.rules = {}
  const area = await renderWith(body)
  expect(within(area).queryByText(/허용 감소 범위: /)).toBeNull()
  expect(within(area).queryByText(/^허용 범위 (이내|초과)$/)).toBeNull()
})
