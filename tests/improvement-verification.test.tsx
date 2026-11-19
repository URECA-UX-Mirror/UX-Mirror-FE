import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { toImprovementView } from '../src/adapters/improvement.ts'
import { VerificationSection } from '../src/features/improvement/VerificationSection.tsx'

function sample() { return JSON.parse(readFileSync('public/improvements/imp_SAMPLE_0001.json', 'utf8')) }
function show(data: ReturnType<typeof sample>) {
  const view = toImprovementView(data)
  if (!view.verification.ok) throw new Error(view.verification.reason)
  return render(<MemoryRouter><VerificationSection verification={view.verification.data} /></MemoryRouter>)
}

it('완료된 목표별 저장 결과와 유효한 재생 링크를 표시한다', () => {
  show(sample())
  expect(screen.getByText('환불 (S1)')).toBeTruthy()
  expect(screen.getByText('문의 (S4)')).toBeTruthy()
  expect(screen.getByText('4단계 도달 실패 → 2단계 성공')).toBeTruthy()
  expect(screen.getByText('변화 없음')).toBeTruthy()
  expect(screen.getByText(/home → orders → refund/)).toBeTruthy()
  expect(screen.getByText(/GOAL_NOT_REACHED/)).toBeTruthy()
  expect(screen.getAllByRole('link', { name: '비교 보기' })[0].getAttribute('href')).toBe('/comparisons/imp-1119-s1')
  expect(screen.getAllByRole('link', { name: '결과 보기' })).toHaveLength(4)
})

it('미진행은 안내만 보여 준다', () => {
  const data = sample(); data.verification.status = 'NOT_RUN'; data.verification.pairs = []
  show(data)
  expect(screen.getByText('검증 미진행')).toBeTruthy()
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it('실패 사유와 무효 및 누락 Run을 표시하고 유효한 Run 링크만 보인다', () => {
  const data = sample(); data.verification.status = 'FAILED'; data.verification.error = { code: 'FAILED_CODE', message: '오류 사유' }
  data.verification.pairs[0].before.validity = 'INVALID'
  data.verification.pairs[0].after = null
  data.verification.pairs[1].after = null
  show(data)
  expect(screen.getByText(/검증 실패: FAILED_CODE · 오류 사유/)).toBeTruthy()
  const first = screen.getByText('환불 (S1)').closest('article')!
  expect(within(first).getAllByText(/판단 불가/).length).toBeGreaterThan(0)
  expect(within(first).getByText('Run 없음')).toBeTruthy()
  expect(within(first).queryAllByRole('link')).toHaveLength(0)
  expect(within(first).queryByText(/→ 2단계 성공/)).toBeNull()
  expect(screen.getAllByRole('link', { name: '결과 보기' })).toHaveLength(1)
  expect(screen.queryAllByRole('link', { name: '비교 보기' })).toHaveLength(0)
})

it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/bad\npath'])('외부 또는 비정상 경로 %s는 링크로 만들지 않는다', (path) => {
  const data = sample(); data.verification.pairs = [data.verification.pairs[0]]
  const pair = data.verification.pairs[0]
  pair.comparisonPath = path; pair.before.resultPath = path; pair.before.progressPath = path
  show(data)
  expect(screen.queryByRole('link', { name: '비교 보기' })).toBeNull()
  expect(screen.getAllByRole('link', { name: '결과 보기' })).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: '진행 보기' })).toHaveLength(1)
})

it.each(['RUNNING', 'READY', 'UNKNOWN', null])('종료되지 않은 상태 %s에는 재생·비교 링크와 비교 요약을 표시하지 않는다', (status) => {
  const data = sample()
  data.verification.status = 'FAILED'
  data.verification.error = { code: 'FAILED', message: '중단' }
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.status = status
  show(data)
  expect(screen.queryByRole('link', { name: '비교 보기' })).toBeNull()
  expect(screen.getAllByRole('link', { name: '결과 보기' })).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: '진행 보기' })).toHaveLength(1)
  expect(screen.queryByText('4단계 도달 실패 → 2단계 성공')).toBeNull()
})

it.each(['status', 'path', 'issues'])('단계와 도달이 같아도 %s가 다르면 변화 없다고 표시하지 않는다', (field) => {
  const data = sample()
  data.verification.pairs = [data.verification.pairs[1]]
  const after = data.verification.pairs[0].after
  if (field === 'status') after.status = 'BLOCKED'
  if (field === 'path') after.path = ['home', 'other']
  if (field === 'issues') after.issues = ['OTHER_ISSUE']
  show(data)
  expect(screen.queryByText('변화 없음')).toBeNull()
  expect(screen.getByText('1단계 성공 → 1단계 성공')).toBeTruthy()
})

it('무효 Run의 빈 Issue 목록을 판단 불가로 표시한다', () => {
  const data = sample()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.validity = 'INVALID'
  data.verification.pairs[0].before.issues = []
  show(data)
  expect(within(screen.getByRole('heading', { name: /v1/ }).parentElement!).getByText('Issue: 판단 불가')).toBeTruthy()
})

it('분석 상태가 저장되지 않은 빈 목록은 결과 없음을 단정하지 않는다', () => {
  const data = sample()
  data.verification.pairs = [data.verification.pairs[1]]
  show(data)
  // 대기·실패·정상 빈 결과는 모두 같은 빈 목록으로 저장되어 구분할 수 없다.
  expect(screen.getAllByText('Issue: 저장된 Issue 없음 (분석 상태 확인 불가)')).toHaveLength(2)
})

it('무효 Run에도 저장된 Issue 코드가 있으면 원문을 표시한다', () => {
  const data = sample()
  data.verification.pairs = [data.verification.pairs[0]]
  data.verification.pairs[0].before.validity = 'INVALID'
  data.verification.pairs[0].before.issues = ['UNKNOWN_CODE']
  show(data)
  expect(screen.getByText('Issue: UNKNOWN_CODE')).toBeTruthy()
})
