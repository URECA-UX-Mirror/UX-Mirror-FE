import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { FINAL_IMPROVEMENT_ID } from '../src/features/improvement/constants.ts'
import { ImprovementPage } from '../src/features/improvement/ImprovementPage.tsx'
import { server } from './setup.ts'

// 공식 자동 개선 결과(imp-1119): 개선안 미채택(NO_IMPROVEMENT), 검증 NOT_RUN, official null

const official = () =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'public/improvements/imp-1119.json'), 'utf-8'))

it('1차 공식 결과 파일은 imp-1119 id를 가진다', () => {
  expect(official().improvementId).toBe('imp-1119')
})

// 2차 공식 결과(imp-1119b): '이용정보' → '주문 환불' 채택, 공식 B 확정, 실제 Run 검증 완료
const second = () =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'public/improvements/imp-1119b.json'), 'utf-8'))

it('사이드바 링크가 2차 최종 결과를 가리키고 파일이 같은 id를 가진다', () => {
  expect(FINAL_IMPROVEMENT_ID).toBe('imp-1119b')
  expect(second().improvementId).toBe('imp-1119b')
})

it('2차 결과는 네 영역이 오류 없이 변환되고 채택·공식 확정·검증 비교 키를 읽는다', () => {
  const view = toImprovementView(second())
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

it('2차 결과 화면은 채택 이름과 비교 보기를 보이고 데이터 오류가 없다', async () => {
  server.use(http.get('/improvements/imp-1119b.json', () => HttpResponse.json(second())))
  render(
    <MemoryRouter initialEntries={['/improvements/imp-1119b']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: '자동 개선 리포트' })).toBeTruthy()
  expect((await screen.findAllByRole('link', { name: '비교 보기' })).map((a) => a.getAttribute('href'))).toEqual(['/comparisons/imp-1119b-S1', '/comparisons/imp-1119b-S4'])
  expect(screen.queryByText(/데이터 오류/)).toBeNull()
})

it('네 영역이 모두 오류 없이 변환되고 후보 11개를 읽는다', () => {
  const view = toImprovementView(official())
  expect(view.report.ok).toBe(true)
  expect(view.official.ok).toBe(true)
  expect(view.rounds.ok).toBe(true)
  expect(view.verification.ok).toBe(true)
  if (!view.report.ok || !view.rounds.ok || !view.official.ok || !view.verification.ok) return
  expect(view.report.data.result).toBe('NO_IMPROVEMENT')
  expect(view.official.data).toBeNull()
  expect(view.verification.data.status).toBe('NOT_RUN')
  expect(view.rounds.data.reduce((n, r) => n + r.candidates.length, 0)).toBe(11)
})

it('화면은 개선안 미채택과 검증 미진행을 보이고 데이터 오류가 없다', async () => {
  server.use(http.get('/improvements/imp-1119.json', () => HttpResponse.json(official())))
  render(
    <MemoryRouter initialEntries={['/improvements/imp-1119']}>
      <Routes>
        <Route path="/improvements/:improvementId" element={<ImprovementPage />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: '자동 개선 리포트' })).toBeTruthy()
  expect(await screen.findByText('개선안 미채택')).toBeTruthy()
  expect(screen.getByText('검증 미진행')).toBeTruthy()
  expect(screen.queryByText(/데이터 오류/)).toBeNull()
})
