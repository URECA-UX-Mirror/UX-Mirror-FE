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
  within(section).findByRole('link', { name: '지금 화면 vs 개선안 보기' })

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
  expect(within(support).queryByRole('link', { name: '지금 화면 vs 개선안 보기' })).toBeNull()
  expect(new Set(requested)).toEqual(new Set(['exp_refund', 'exp_orders', 'exp_support']))
})

it('한 실험의 조회가 재시도 중이어도 나머지 실험은 그대로 보인다', async () => {
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

it('한 실험의 조회가 최종 실패하면 그 카드에만 오류와 다시 시도 버튼이 뜬다', async () => {
  server.use(
    http.get(apiUrl('/api/runs'), ({ request }) => {
      const key = new URL(request.url).searchParams.get('experimentKey') ?? ''
      if (key === 'exp_orders') {
        // 404는 폴링이 재시도 없이 멈추는 오류다
        return HttpResponse.json(
          { error: { code: 'RUN_NOT_FOUND', message: '저장된 실험을 찾을 수 없습니다', retryable: true } },
          { status: 404 },
        )
      }
      const items = [item(key, 'before'), item(key, 'after')]
      return HttpResponse.json({ count: items.length, items })
    }),
  )
  renderReplay()

  const orders = await screen.findByRole('region', { name: '저장된 실행: 주문 내역' })
  const alert = await within(orders).findByRole('alert')
  expect(alert.textContent).toContain('저장된 실험을 찾을 수 없습니다')
  expect(within(alert).getByRole('button', { name: '다시 시도' })).toBeTruthy()
  expect(within(orders).queryByRole('link', { name: '지금 화면 vs 개선안 보기' })).toBeNull()

  for (const name of ['저장된 실행: 환불 신청', '저장된 실행: 고객센터']) {
    const card = screen.getByRole('region', { name })
    expect(await compareLink(card)).toBeTruthy()
    expect(within(card).queryByRole('alert')).toBeNull()
  }
})

it('재생 표시는 목록의 키마다 보이고 목록에 없는 키에서는 보이지 않는다', () => {
  const { rerender } = render(<ReplayNotice experimentKey="exp_support" origins={['LIVE']} />)
  expect(screen.getByRole('note').textContent).toBe('저장된 실측 결과 재생')
  rerender(<ReplayNotice experimentKey="other" origins={['LIVE']} />)
  expect(screen.queryByRole('note')).toBeNull()
})
