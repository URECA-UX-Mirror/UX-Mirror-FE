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

// B 공식 평가 결과의 BE 실제 형식(`apply_official`): 확정(CONFIRMED), 탈락(REJECTED), 점수 수집 실패

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

/** 접힌 점수 계산 영역(`<details>`)을 돌려준다 */
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
  return (await screen.findByText('점수 계산 자세히 보기')).closest('details') as HTMLElement
}

it('B 평가가 확정이면 공식 평가 최종안으로 표시한다', async () => {
  const body = improved()
  body.official.decision = 'CONFIRMED'
  const details = await renderBody(body)
  expect(within(details).getByText(/공식 평가 최종안/)).toBeTruthy()
  expect(within(details).queryByText(/탈락/)).toBeNull()
})

it('모르는 판정 값은 원문 대신 "확인 필요"로 덧붙인다', async () => {
  const body = improved()
  body.official.decision = 'PENDING'
  const details = await renderBody(body)
  expect(within(details).getByText(/공식 평가 최종안/).textContent).toContain('(판정 확인 필요)')
})

it('B 평가에서 탈락하면 최종안이 아니라 탈락한 이름과 사유를 보이고 개선 효과도 미채택이다', async () => {
  const body = rejectedByB('GUARD_LOSS_EXCEEDED', ['S4'], {
    mainScore: 0.9,
    guardScores: { S2: 0.81, S3: 0.9, S4: 0.67 },
  })
  const view = toImprovementView(body)
  expect(view.official).toMatchObject({
    ok: true,
    data: { decision: 'REJECTED', rejectedReason: 'GUARD_LOSS_EXCEEDED:S4' },
  })
  const details = await renderBody(body)
  expect(within(details).queryByText(/공식 평가 최종안/)).toBeNull()
  expect(within(details).getByText(/공식 평가에서 탈락한 이름/).textContent).toContain('주문내역')
  expect(within(details).getByText('탈락 사유: 지킬 목표 문의(S4) 하락으로 탈락 (GUARD_LOSS_EXCEEDED:S4)')).toBeTruthy()
  // 개선 효과도 B 판정과 같이 미채택이고, 개선안 화면에서 다시 잰 결과를 사람 말로 보인다
  const summary = screen.getByRole('region', { name: '개선 효과' })
  expect(within(summary).getByText(/이 목표는 "이용정보" 이름만 바꿔서는 좋아지지 않았어요/)).toBeTruthy()
  expect(summary.textContent).toContain('개선안 화면에서 다시 재 보니 "주문내역"도 기준을 넘지 못했어요 (지킬 목표 문의(S4) 하락으로 탈락)')
  expect(summary.textContent).not.toContain('GUARD_LOSS_EXCEEDED')
})

it('B 점수 수집에 실패하면 0이나 영역 안내가 아니라 값 없음으로 보인다', async () => {
  const body = rejectedByB('EVALUATION_FAILED', null, {
    mainScore: null,
    guardScores: { S2: null, S3: 0.9, S4: null },
  })
  const view = toImprovementView(body)
  expect(view.official.ok).toBe(true)
  if (!view.official.ok || view.official.data === null) throw new Error('official')
  expect(view.official.data.scores).toEqual({ mainScore: null, guardScores: { S2: null, S3: 0.9, S4: null } })
  const details = await renderBody(body)
  expect(within(details).queryByRole('alert')).toBeNull()
  expect(within(details).getByText('탈락 사유: 평가 실패 (EVALUATION_FAILED)')).toBeTruthy()
  expect(within(details).getByText('주 목표 점수').nextSibling?.textContent).toBe('값 없음')
  expect(within(details).getByText('S3 쿠폰').nextSibling?.textContent).toBe('90.0%')
  expect(within(details).queryByText('0.0%')).toBeNull()
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
  expect(await screen.findByRole('region', { name: '개선 효과' })).toBeTruthy()
  expect(screen.queryByText('점수 계산 자세히 보기')).toBeNull()
})
