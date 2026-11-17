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
