import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { RunResultPage } from '../src/features/run-result/RunResultPage.tsx'

function renderResult(runId: string) {
  return render(
    <MemoryRouter initialEntries={[`/runs/${runId}/result`]}>
      <Routes>
        <Route path="/runs/:runId/result" element={<RunResultPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('요약은 목표 달성·탐색 단계·검토 후보 카드를 보이고 전체 요약은 펼쳐야 보인다', async () => {
  renderResult('run_mock_goback')
  const summary = await screen.findByRole('region', { name: '요약' })
  expect(within(summary).getByText('목표 달성')).toBeTruthy()
  expect(within(summary).getByText('탐색 단계')).toBeTruthy()
  expect(within(summary).getByText('UX 검토 후보')).toBeTruthy()
  expect(within(summary).queryByText('추가 이동(extraSteps)')).toBeNull()
  fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
  expect(within(summary).getByText('추가 이동(extraSteps)')).toBeTruthy()
})

it('탐색 경로는 노드 사이에 이동을 만든 행동을 보이고 노드를 고르면 상세가 바뀐다', async () => {
  renderResult('run_mock_goback')
  const path = await screen.findByRole('region', { name: '탐색 경로' })
  const nodes = within(path).getAllByRole('button')
  // home → mypage → (모델 GO_BACK) home → orders → refund
  expect(nodes).toHaveLength(5)
  expect(path.textContent).toContain('모델 GO_BACK 복귀')
  expect(within(path).getByText('이전 화면 복귀')).toBeTruthy()
  expect(nodes[0].getAttribute('aria-pressed')).toBe('true')

  const detail = screen.getByRole('region', { name: '단계별 탐색 상세' })
  expect(detail.textContent).toContain('선택된 노드: home')
  fireEvent.click(nodes[1])
  expect(nodes[1].getAttribute('aria-pressed')).toBe('true')
  expect(detail.textContent).toContain('선택된 노드: mypage')
  // 마지막 도착 화면은 모델이 판단한 Step이 없어 이미지가 없다
  fireEvent.click(nodes[4])
  expect(await within(detail).findByText('도착 화면 이미지 없음')).toBeTruthy()
})

it('검토 후보는 우선 검토·일반 검토 두 단계로만 보이고 카드마다 근거를 바로 보인다', async () => {
  renderResult('run_mock_goback')
  const issues = await screen.findByRole('region', { name: '검토 후보' }, { timeout: 4000 })
  const cards = await within(issues).findAllByRole('listitem')
  expect(cards.length).toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.textContent).toMatch(/우선 검토|일반 검토/)
    expect(card.querySelector('.issue-evidence')).toBeTruthy()
  }
  expect(issues.textContent).not.toMatch(/높음|보통|참고/)
})
