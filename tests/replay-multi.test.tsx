import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { apiUrl } from '../src/api/client.ts'
import { server } from './setup.ts'
import { ReplayPage } from '../src/features/replay/ReplayPage.tsx'
import { ReplayNotice } from '../src/features/replay/ReplayNotice.tsx'

// E 실행은 목표별(환불·주문·고객센터) 실험 키 여러 개를 재생한다
vi.mock('../src/features/replay/constants.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/features/replay/constants.ts')>()
  const experiments = [
    { key: 'exp_refund', label: '환불 신청' },
    { key: 'exp_orders', label: '주문 내역' },
    { key: 'exp_support', label: '고객센터' },
  ]
  return {
    ...original,
    REPLAY_EXPERIMENTS: experiments,
    isReplayKey: (key: string) => experiments.some((e) => e.key === key),
  }
})

function item(experimentKey: string, variant: 'before' | 'after') {
  return {
    runId: `run_${experimentKey}_${variant}`,
    experimentKey,
    variant,
    status: 'SUCCESS',
    terminationReason: 'GOAL_VERIFIED',
    validity: 'VALID',
    replacementRunId: null,
    resultOrigin: 'LIVE',
    goalReached: true,
    createdAt: '2026-11-19T09:00:00+09:00',
    finishedAt: '2026-11-19T09:05:00+09:00',
  }
}

function renderReplay() {
  return render(
    <MemoryRouter initialEntries={['/replay']}>
      <Routes>
        <Route path="/replay" element={<ReplayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const compareLink = (section: HTMLElement) =>
  within(section).findByRole('link', { name: '버전 비교 보기' })

it('실험 키마다 목록과 비교 링크를 따로 보인다', async () => {
  const requested: string[] = []
  server.use(
    http.get(apiUrl('/api/runs'), ({ request }) => {
      const key = new URL(request.url).searchParams.get('experimentKey') ?? ''
      requested.push(key)
      const items = key === 'exp_support' ? [] : [item(key, 'before'), item(key, 'after')]
      return HttpResponse.json({ count: items.length, items })
    }),
  )
  renderReplay()

  const refund = await screen.findByRole('region', { name: '저장된 실행: 환불 신청' })
  const orders = await screen.findByRole('region', { name: '저장된 실행: 주문 내역' })
  const support = await screen.findByRole('region', { name: '저장된 실행: 고객센터' })

  expect((await compareLink(refund)).getAttribute('href')).toBe('/comparisons/exp_refund')
  expect((await compareLink(orders)).getAttribute('href')).toBe('/comparisons/exp_orders')
  expect(await within(support).findByText('저장된 실행이 없습니다')).toBeTruthy()
  expect(within(support).queryByRole('link', { name: '버전 비교 보기' })).toBeNull()
  expect(new Set(requested)).toEqual(new Set(['exp_refund', 'exp_orders', 'exp_support']))
})

it('한 실험의 조회가 실패해도 나머지 실험은 그대로 보인다', async () => {
  server.use(
    http.get(apiUrl('/api/runs'), ({ request }) => {
      const key = new URL(request.url).searchParams.get('experimentKey') ?? ''
      if (key === 'exp_orders') return new HttpResponse(null, { status: 500 })
      const items = [item(key, 'before'), item(key, 'after')]
      return HttpResponse.json({ count: items.length, items })
    }),
  )
  renderReplay()

  const refund = await screen.findByRole('region', { name: '저장된 실행: 환불 신청' })
  expect(await compareLink(refund)).toBeTruthy()
  const orders = screen.getByRole('region', { name: '저장된 실행: 주문 내역' })
  expect(await within(orders).findByText('연결 재시도 중')).toBeTruthy()
})

it('재생 표시는 등록된 모든 키에서 보이고 그 밖의 키에서는 보이지 않는다', () => {
  const { rerender } = render(<ReplayNotice experimentKey="exp_support" origins={['LIVE']} />)
  expect(screen.getByRole('note').textContent).toBe('저장된 실측 결과 재생')
  rerender(<ReplayNotice experimentKey="other" origins={['LIVE']} />)
  expect(screen.queryByRole('note')).toBeNull()
})
