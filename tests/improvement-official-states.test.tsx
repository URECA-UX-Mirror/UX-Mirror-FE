import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
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

async function renderBody(body: Json) {
  server.use(http.get('/improvements/imp_B.json', () => HttpResponse.json(body)))
  render(
    <MemoryRouter initialEntries={['/improvements/imp_B']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('region', { name: '보조 정보' })
}

it('B 평가가 확정이면 공식 평가 최종안으로 표시한다', async () => {
  const body = improved()
  body.official.decision = 'CONFIRMED'
  const aux = await renderBody(body)
  expect(within(aux).getByText(/공식 평가 최종안/)).toBeTruthy()
  expect(within(aux).queryByText(/탈락/)).toBeNull()
})

it('B 평가에서 탈락하면 최종안이 아니라 탈락한 이름과 사유를 보인다', async () => {
  const body = rejectedByB('GUARD_LOSS_EXCEEDED', ['S4'], {
    mainScore: 0.9,
    guardScores: { S2: 0.81, S3: 0.9, S4: 0.67 },
  })
  const view = toImprovementView(body)
  expect(view.official).toMatchObject({
    ok: true,
    data: { decision: 'REJECTED', rejectedReason: 'GUARD_LOSS_EXCEEDED:S4' },
  })
  const aux = await renderBody(body)
  expect(within(aux).queryByText(/공식 평가 최종안/)).toBeNull()
  expect(within(aux).getByText(/공식 평가에서 탈락한 이름/)).toBeTruthy()
  expect(within(aux).getByText(/지킬 목표 문의\(S4\) 하락으로 탈락 \(GUARD_LOSS_EXCEEDED:S4\)/)).toBeTruthy()
  // 최종 요약도 B 판정과 같이 미채택이고 B 탈락 이력을 보인다
  const summary = screen.getByRole('region', { name: '① 개선 효과' })
  expect(within(summary).getByText(/개선안 미채택/)).toBeTruthy()
  expect(within(summary).getByText(/공식 평가\(B\)에서 주문내역 탈락/)).toBeTruthy()
})

it('B 점수 수집에 실패하면 0이나 영역 오류가 아니라 값 없음으로 보인다', async () => {
  const body = rejectedByB('EVALUATION_FAILED', null, {
    mainScore: null,
    guardScores: { S2: null, S3: 0.9, S4: null },
  })
  const view = toImprovementView(body)
  expect(view.official.ok).toBe(true)
  if (!view.official.ok || view.official.data === null) throw new Error('official')
  expect(view.official.data.scores).toEqual({ mainScore: null, guardScores: { S2: null, S3: 0.9, S4: null } })
  const aux = await renderBody(body)
  expect(within(aux).queryByText(/데이터 오류/)).toBeNull()
  expect(within(aux).getByText(/평가 실패 \(EVALUATION_FAILED\)/)).toBeTruthy()
  expect(within(aux).getByText('주 목표 점수').nextSibling?.textContent).toBe('값 없음')
  expect(within(aux).getByText('S3 쿠폰').nextSibling?.textContent).toBe('90.0%')
  expect(within(aux).queryByText('0.0%')).toBeNull()
})

it('점수 키가 없거나 숫자·null이 아니면 공식 평가 영역만 오류다', () => {
  const missing = improved()
  delete missing.official.scores.mainScore
  expect(toImprovementView(missing).official.ok).toBe(false)
  expect(toImprovementView(missing).report.ok).toBe(true)
  const text = improved()
  text.official.scores.guardScores.S2 = '0.8'
  expect(toImprovementView(text).official.ok).toBe(false)
})
