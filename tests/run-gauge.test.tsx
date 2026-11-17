import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { RunGauge } from '../src/shared/RunGauge.tsx'

it('끝난 단계 수만큼 칸이 차고 진행 중이면 다음 칸이 차오르는 중으로 표시된다', () => {
  const { container } = render(<RunGauge stepCount={3} maxSteps={8} terminal={false} status="RUNNING" />)
  const bar = screen.getByRole('progressbar', { name: '탐색 진행률' })
  expect(bar.getAttribute('aria-valuenow')).toBe('3')
  expect(bar.getAttribute('aria-valuemax')).toBe('8')
  const cells = [...container.querySelectorAll('.run-gauge-cell')].map((cell) => cell.getAttribute('data-state'))
  expect(cells).toEqual(['done', 'done', 'done', 'active', 'pending', 'pending', 'pending', 'pending'])
  expect(screen.getByText('탐색 중')).toBeTruthy()
  expect(container.textContent).toContain('38%')
})

it('종료되면 진행 중 칸 없이 끝난 단계만 채워지고 최대 단계를 넘지 않는다', () => {
  const { container } = render(<RunGauge stepCount={10} maxSteps={4} terminal status="MAX_STEPS" />)
  const cells = [...container.querySelectorAll('.run-gauge-cell')].map((cell) => cell.getAttribute('data-state'))
  expect(cells).toEqual(['done', 'done', 'done', 'done'])
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4')
  expect(screen.getByText('탐색 종료')).toBeTruthy()
})

it('실행 대기(READY) 상태에서는 시작 전 문구만 보이고 차오르는 칸과 진행 점이 없다', () => {
  const { container } = render(<RunGauge stepCount={0} maxSteps={3} terminal={false} status="READY" />)
  const cells = [...container.querySelectorAll('.run-gauge-cell')].map((cell) => cell.getAttribute('data-state'))
  expect(cells).toEqual(['pending', 'pending', 'pending'])
  expect(screen.getByText('탐색 시작 전')).toBeTruthy()
  expect(screen.queryByText('탐색 중')).toBeNull()
  expect(container.querySelector('.run-gauge-dot')).toBeNull()
})
