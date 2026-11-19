import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { apiUrl } from '../src/api/client.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// 사전 등록 공식 실행 결과 (BE가 kind=OFFICIAL로 주는 리포트)
// 1차(imp-1119): 개선안 미채택(NO_IMPROVEMENT), 다시 확인 NOT_RUN, official null
// 2차(imp-1119b): '이용정보' → '주문 환불' 채택, 공식 B 확정, 개선안에서 다시 확인 완료

const read = (id: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/improvements/${id}.json`), 'utf-8'))

function renderOfficial(id: string) {
  server.use(
    http.get(apiUrl(`/api/improvements/${id}`), () =>
      HttpResponse.json({
        improvementId: id, kind: 'OFFICIAL', status: 'COMPLETED', phase: 'DONE',
        createdAt: null, startedAt: null, finishedAt: null, error: null,
        input: { goal: '산 물건을 환불하고 싶을', persona: '온라인 쇼핑이 낯선', goalPage: 'refund' },
        improvement: read(id),
      })),
  )
  render(
    <MemoryRouter initialEntries={[`/improvements/${id}`]}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('공식 결과 파일은 각자 자기 id를 가진다', () => {
  expect(read('imp-1119').improvementId).toBe('imp-1119')
  expect(read('imp-1119b').improvementId).toBe('imp-1119b')
})

it('2차 결과는 네 영역이 오류 없이 변환되고 채택·공식 확정·다시 확인 비교 경로를 읽는다', () => {
  const view = toImprovementView(read('imp-1119b'))
  expect(view.report.ok && view.official.ok && view.rounds.ok && view.verification.ok).toBe(true)
  if (!view.report.ok || !view.rounds.ok || !view.official.ok || !view.verification.ok) return
  expect(view.report.data.result).toBe('IMPROVED')
  expect(view.report.data.beforeLabel).toBe('이용정보')
  expect(view.report.data.afterLabel).toBe('주문 환불')
  expect(view.report.data.scoreSource).toBe('OFFICIAL_B')
  expect(view.official.data?.decision).toBe('CONFIRMED')
  expect(view.rounds.data).toHaveLength(3)
  expect(view.verification.data.status).toBe('COMPLETED')
  expect(view.verification.data.pairs.map((pair) => pair.comparisonPath)).toEqual(['/comparisons/imp-1119b-S1', '/comparisons/imp-1119b-S4'])
})

it('2차 결과 화면은 공식 결과 표시·바꿀 이름·화면별 비교 링크를 보이고 영역 안내가 없다', async () => {
  renderOfficial('imp-1119b')
  expect(await screen.findByText('사전 등록 공식 결과')).toBeTruthy()
  expect(screen.getByRole('region', { name: '어떻게 바꾸면 좋을까요?' }).querySelector('.tl-answer')?.textContent).toBe("상단 메뉴 '이용정보' → '주문 환불'")
  expect(screen.getAllByRole('link', { name: '화면별로 비교하기' }).map((a) => a.getAttribute('href'))).toEqual(['/comparisons/imp-1119b-S1', '/comparisons/imp-1119b-S4'])
  expect(screen.getByText(/이름 \d+개를 시험해서/).textContent).toMatch(/'주문 환불'을 골랐어요\.$/)
  expect(screen.queryByText('이 부분을 보여 드릴 수 없어요.')).toBeNull()
})

it('1차 결과는 네 영역이 오류 없이 변환되고 후보 11개를 읽는다', () => {
  const view = toImprovementView(read('imp-1119'))
  expect(view.report.ok && view.official.ok && view.rounds.ok && view.verification.ok).toBe(true)
  if (!view.report.ok || !view.rounds.ok || !view.official.ok || !view.verification.ok) return
  expect(view.report.data.result).toBe('NO_IMPROVEMENT')
  expect(view.official.data).toBeNull()
  expect(view.verification.data.status).toBe('NOT_RUN')
  expect(view.rounds.data.reduce((n, r) => n + r.candidates.length, 0)).toBe(11)
})

it('1차 결과 화면은 이름만 바꿔서는 나아지지 않았다고 보이고, 다시 해 본 카드·점수 계산은 없다', async () => {
  renderOfficial('imp-1119')
  expect(await screen.findByText('이름만 바꿔서는 나아지지 않았어요')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '개선안에서 다시 해 봤어요' })).toBeNull()
  expect(screen.getByText(/이름 \d+개를 시험해서/).textContent).toMatch(/고를 이름을 찾지 못했어요\.$/)
  expect(screen.queryByText('이 부분을 보여 드릴 수 없어요.')).toBeNull()
})
