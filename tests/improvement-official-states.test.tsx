import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { apiUrl } from '../src/api/client.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// 마지막 확인(BE 공식 평가 B, `apply_official`)의 실제 형식: 확정(CONFIRMED), 탈락(REJECTED), 점수 수집 실패

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const improved = (): Json =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/improvement.improved.json'), 'utf-8'))

/** BE `apply_official`이 B 탈락 때 만드는 모양: official은 REJECTED, 최종 요약은 NO_IMPROVEMENT로 바뀐다 */
function rejectedByB(reason: string, guardGoals: string[] | null, scores: Json): Json {
  const body = improved()
  const label = body.summary.afterLabel
  body.summary.loopResult = { afterLabel: label, main: body.summary.main, guards: body.summary.guards }
  body.summary.officialRejected = { label, reason: guardGoals ? `${reason}:${guardGoals.join(',')}` : reason }
  Object.assign(body.summary, { result: 'NO_IMPROVEMENT', afterLabel: null, afterSource: null, scoreSource: null })
  body.summary.main = { ...body.summary.main, after: null, delta: null }
  body.summary.guards = body.summary.guards.map((g: Json) => ({ ...g, after: null, delta: null }))
  body.official = {
    ...body.official,
    decision: 'REJECTED',
    scores,
    choose: {
      adopted: null,
      ranking: [],
      rejected: [{ candidateId: 'OFFICIAL-B', reason, ...(guardGoals ? { guardGoals } : {}) }],
    },
  }
  return body
}

/** "어떻게 골랐는지 보기" 안의 점수 계산 영역을 돌려준다 */
async function renderBody(body: Json) {
  server.use(
    http.get(apiUrl('/api/improvements/imp_B'), () =>
      HttpResponse.json({
        improvementId: 'imp_B', kind: 'OFFICIAL', status: 'COMPLETED', phase: 'DONE',
        createdAt: null, startedAt: null, finishedAt: null, error: null, input: null, improvement: body,
      })),
  )
  render(
    <MemoryRouter initialEntries={['/improvements/imp_B']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('region', { name: '점수 계산' })
}

const scoreOf = (area: HTMLElement, name: string) => within(area).getByText(name).nextElementSibling?.textContent

it('마지막 확인이 확정이면 이름·확정·점수·이름 외 변화 없음·미리 계산한 점수와 차이를 보인다', async () => {
  const body = improved()
  body.official.decision = 'CONFIRMED'
  const area = await renderBody(body)
  expect(area.textContent).toContain("'주문내역' · 확정")
  expect(scoreOf(area, '이 고객')).toBe('70.1%')
  expect(scoreOf(area, '배송 고객')).toBe('81.2%')
  expect(within(area).getByText('메뉴 이름 말고는 바뀐 게 없어요.')).toBeTruthy()
  expect(within(area).getByText('미리 계산한 점수와 차이: 최대 0.6%p')).toBeTruthy()
  expect(area.textContent).not.toMatch(/떨어졌어요|방식|B\)|S2/)
})

it('모르는 판정 값은 원문 대신 확인이 필요하다고 보인다', async () => {
  const body = improved()
  body.official.decision = 'PENDING'
  const area = await renderBody(body)
  expect(area.textContent).toContain("'주문내역' · 확정인지 확인이 필요해요")
  expect(area.textContent).not.toContain('PENDING')
})

it('모르는 buildCheck는 확인이 필요하다고 보인다', async () => {
  const body = improved()
  body.official.site.buildCheck = 'EXTRA_DIFF'
  const area = await renderBody(body)
  expect(within(area).getByText('이름 말고 바뀐 게 있는지 확인이 필요해요.')).toBeTruthy()
})

it('마지막 확인에서 떨어지면 떨어진 이름과 이유를 보이고 결론도 나아지지 않았다고 한다', async () => {
  const body = rejectedByB('GUARD_LOSS_EXCEEDED', ['S4'], {
    mainScore: 0.9,
    guardScores: { S2: 0.81, S3: 0.9, S4: 0.67 },
  })
  const view = toImprovementView(body)
  expect(view.official).toMatchObject({
    ok: true,
    data: { decision: 'REJECTED', rejectedReason: 'GUARD_LOSS_EXCEEDED:S4' },
  })
  const area = await renderBody(body)
  expect(area.textContent).toContain("'주문내역' · 떨어졌어요 (문의 고객이 많이 떨어졌어요)")
  const conclusion = screen.getByRole('region', { name: '결론' })
  expect(conclusion.querySelector('.imp-headline')?.textContent).toBe('이름만 바꿔서는 나아지지 않았어요')
  expect(conclusion.textContent).toContain("마지막 후보 '주문내역'도 다시 재 보니 기준에 못 미쳤어요 (문의 고객이 많이 떨어졌어요).")
  expect(document.body.textContent).not.toContain('GUARD_LOSS_EXCEEDED')
  expect(document.body.textContent).not.toContain('바꿔 보세요')
})

it('점수를 모으지 못했으면 0이나 영역 안내가 아니라 값 없음으로 보인다', async () => {
  const body = rejectedByB('EVALUATION_FAILED', null, {
    mainScore: null,
    guardScores: { S2: null, S3: 0.9, S4: null },
  })
  const view = toImprovementView(body)
  expect(view.official.ok).toBe(true)
  if (!view.official.ok || view.official.data === null) throw new Error('official')
  expect(view.official.data.scores).toEqual({ mainScore: null, guardScores: { S2: null, S3: 0.9, S4: null } })
  const area = await renderBody(body)
  expect(within(area).queryByRole('alert')).toBeNull()
  expect(area.textContent).toContain('떨어졌어요 (점수를 내지 못했어요)')
  expect(scoreOf(area, '이 고객')).toBe('값 없음')
  expect(scoreOf(area, '쿠폰 고객')).toBe('90.0%')
  expect(within(area).queryByText('0.0%')).toBeNull()
})

it('결론을 못 읽어도 점수 계산은 계획의 목표 이름으로 보인다', async () => {
  const body = improved()
  delete body.summary.main.before
  const area = await renderBody(body)
  expect(within(screen.getByRole('region', { name: '결론' })).getByRole('alert')).toBeTruthy()
  expect(scoreOf(area, '배송 고객')).toBe('81.2%')
})

it('점수 키가 없거나 숫자·null이 아니면 공식 평가 영역만 오류이고 화면에서는 점수 계산만 숨긴다', async () => {
  const missing = improved()
  delete missing.official.scores.mainScore
  expect(toImprovementView(missing).official.ok).toBe(false)
  expect(toImprovementView(missing).report.ok).toBe(true)
  const text = improved()
  text.official.scores.guardScores.S2 = '0.8'
  expect(toImprovementView(text).official.ok).toBe(false)

  server.use(
    http.get(apiUrl('/api/improvements/imp_B'), () =>
      HttpResponse.json({
        improvementId: 'imp_B', status: 'COMPLETED', phase: 'DONE', createdAt: null, startedAt: null,
        finishedAt: null, error: null, improvement: missing,
      })),
  )
  render(
    <MemoryRouter initialEntries={['/improvements/imp_B']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('region', { name: '결론' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '점수 계산' })).toBeNull()
  expect(screen.getByRole('region', { name: '시험한 이름' })).toBeTruthy()
})
