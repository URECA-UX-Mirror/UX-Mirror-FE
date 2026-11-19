import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, it } from 'vitest'
import { RunResultPage } from '../src/features/run-result/RunResultPage.tsx'
import { formatPathMetric } from '../src/features/run-result/format.ts'

function renderResult(runId: string) {
  return render(
    <MemoryRouter initialEntries={[`/runs/${runId}/result`]}>
      <Routes>
        <Route path="/runs/:runId/result" element={<RunResultPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

it('요약은 목표 달성·클릭 수·살펴볼 점 카드를 보이고 전체 요약은 펼쳐야 보인다', async () => {
  renderResult('run_mock_goback')
  const summary = await screen.findByRole('region', { name: '요약' })
  expect(within(summary).getByText('목표 달성')).toBeTruthy()
  expect(within(summary).getByText('클릭 수')).toBeTruthy()
  expect(within(summary).getByText('살펴볼 점')).toBeTruthy()
  expect(within(summary).queryByText('추가 이동(extraSteps)')).toBeNull()
  fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
  expect(within(summary).getByText('추가 이동(extraSteps)')).toBeTruthy()
  expect(within(summary).getByText('끝난 이유')).toBeTruthy()
  // 개발자용 코드값(CLICK·GO_BACK·상태 코드)은 보이지 않는다
  expect(summary.textContent).not.toMatch(/CLICK|GO_BACK|SUCCESS|GOAL_VERIFIED/)
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
  // 마지막 도착 화면은 모델이 판단한 Step이 없어 도착 화면 이미지 endpoint로 가져온다
  fireEvent.click(nodes[4])
  expect((await within(detail).findByRole('img')).getAttribute('src')).toMatch(
    /\/api\/runs\/run_mock_goback\/screenshots\/goal$/,
  )
})

it('도착 화면 이미지는 bbox 없이 보이고 로드에 실패하면 "도착 화면 이미지 없음"을 보인다', async () => {
  renderResult('run_mock_done_before')
  const path = await screen.findByRole('region', { name: '탐색 경로' })
  const nodes = within(path).getAllByRole('button')
  fireEvent.click(nodes[nodes.length - 1])
  const detail = screen.getByRole('region', { name: '단계별 탐색 상세' })
  const image = await within(detail).findByRole('img')
  expect(image.getAttribute('src')).toMatch(/\/screenshots\/goal$/)
  expect(detail.querySelector('.screenshot-box')).toBeNull()
  fireEvent.error(image)
  expect(within(detail).getByText('도착 화면 이미지 없음')).toBeTruthy()
  // 다른 노드의 표시는 그대로다
  fireEvent.click(nodes[0])
  expect((await within(detail).findByRole('img')).getAttribute('src')).toMatch(/\/screenshots\/1\?kind=original$/)
})

it('목표에 도착하지 못한 Run은 도착 화면 이미지를 요청하지 않고 기존 문구를 보인다', async () => {
  renderResult('run_mock_maxsteps')
  const path = await screen.findByRole('region', { name: '탐색 경로' })
  const nodes = within(path).getAllByRole('button')
  fireEvent.click(nodes[nodes.length - 1])
  const detail = screen.getByRole('region', { name: '단계별 탐색 상세' })
  expect(await within(detail).findByText('마지막 화면 이미지 없음')).toBeTruthy()
  expect(detail.querySelector('img')).toBeNull()
})

it('검토 후보는 우선 검토·일반 검토 두 단계로만 보이고 항목을 열면 근거를 보인다', async () => {
  renderResult('run_mock_goback')
  const issues = await screen.findByRole('region', { name: '검토 후보' }, { timeout: 4000 })
  const cards = await within(issues).findAllByRole('listitem')
  expect(cards.length).toBeGreaterThan(0)
  for (const card of cards) {
    expect(card.textContent).toMatch(/우선 검토|일반 검토/)
  }
  expect(issues.textContent).not.toMatch(/높음|보통|참고/)
  fireEvent.click(within(cards[0]).getByRole('button', { expanded: false }))
  expect(within(issues).getByLabelText('근거')).toBeTruthy()
})

it('경로 기준이 없는 Run(직접 입력한 목표)은 추가 이동을 0이 아니라 계산 불가로 보인다', async () => {
  renderResult('run_mock_direct_before')
  const summary = await screen.findByRole('region', { name: '요약' })
  fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
  expect(within(summary).getAllByText('계산 불가 (경로 기준 없음)')).toHaveLength(2)
  expect(await screen.findByText('주문 내역 화면 찾기')).toBeTruthy()
  expect(screen.getByText('쇼핑몰을 처음 쓰는 사용자')).toBeTruthy()
})

async function openFullSummary(runId: string) {
  renderResult(runId)
  const summary = await screen.findByRole('region', { name: '요약' })
  fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
  return summary
}

it('SITE_MAP Run은 기준 배지와 최단 경로 대비 추가 단계·우회 이동을 보이고 허용 경로 이탈 행은 없다', async () => {
  const summary = await openFullSummary('run_mock_sitemap')
  expect(within(summary).getByText('사이트 지도')).toBeTruthy()
  expect(within(summary).getByText('최단 경로 대비 추가 단계')).toBeTruthy()
  expect(within(summary).getByText('우회 이동')).toBeTruthy()
  expect(within(summary).getByText('목표 거리가 줄지 않은 이동')).toBeTruthy()
  expect(within(summary).queryByText('허용 경로 이탈')).toBeNull()
  expect(within(summary).queryByText('사용 안 함')).toBeNull()
  expect(within(summary).queryByText('추가 이동(extraSteps)')).toBeNull()
  expect(summary.textContent).not.toMatch(/개선|단축/)
})

it('지도 오류 Run은 목표 종류와 무관하게 원인을 단정하지 않는 같은 문구로 보인다', async () => {
  for (const id of ['run_mock_mapfail', 'run_mock_direct_mapfail']) {
    const { unmount } = renderResult(id)
    const summary = await screen.findByRole('region', { name: '요약' })
    fireEvent.click(within(summary).getByRole('button', { name: '요약 전체 보기' }))
    expect(within(summary).getByText('기준 없음')).toBeTruthy()
    expect(within(summary).getAllByText('계산 불가 (경로 기준 없음)')).toHaveLength(2)
    expect(summary.textContent).not.toContain('지도 오류')
    unmount()
  }
})

it('허용 경로 Run은 기존 표시를 유지하고 우회 이동 행이 없다', async () => {
  const summary = await openFullSummary('run_mock_goback')
  expect(within(summary).getByText('허용 경로')).toBeTruthy()
  expect(within(summary).getByText('추가 이동(extraSteps)')).toBeTruthy()
  expect(within(summary).queryByText('우회 이동')).toBeNull()
})

it('basis가 없는 과거 Run은 허용 경로로 읽는다', async () => {
  const summary = await openFullSummary('run_mock_legacy_basis')
  expect(within(summary).getByText('허용 경로')).toBeTruthy()
  expect(within(summary).getByText('추가 이동(extraSteps)')).toBeTruthy()
})

it('목표 미도달 Run의 추가 이동은 해당 없음이다', async () => {
  const summary = await openFullSummary('run_mock_maxsteps')
  expect(within(summary).getAllByText('해당 없음').length).toBeGreaterThanOrEqual(2)
})

it('Step 지표의 목표 경로 확률에 기준별 설명이 붙는다', async () => {
  renderResult('run_mock_sitemap')
  const detail = await screen.findByRole('region', { name: '단계별 탐색 상세' })
  fireEvent.click(await within(detail).findByRole('button', { name: /지표 펼치기/ }))
  expect(within(detail).getByText(/목표에 더 가까워지는 클릭 후보들의 확률 합/)).toBeTruthy()
})

it('formatPathMetric은 지표 종류별로 null의 의미를 구분한다', () => {
  // extraSteps 계열: 미도달이면 해당 없음, 도달했는데 null이면 계산 불가
  expect(formatPathMetric(null, 'SITE_MAP', true)).toBe('계산 불가')
  expect(formatPathMetric(null, 'SITE_MAP', false)).toBe('해당 없음')
  // detourMoveCount: 목표 도달과 무관하게 null이면 계산 불가, 0은 0
  expect(formatPathMetric(null, 'SITE_MAP', false, 'detour')).toBe('계산 불가')
  expect(formatPathMetric(null, 'SITE_MAP', true, 'detour')).toBe('계산 불가')
  expect(formatPathMetric(0, 'SITE_MAP', false, 'detour')).toBe('0')
  // 기준 없음은 원인을 단정하지 않는다
  expect(formatPathMetric(null, null, false)).toBe('계산 불가 (경로 기준 없음)')
})
