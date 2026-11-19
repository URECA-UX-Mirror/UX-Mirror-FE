import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { toHealth } from '../src/adapters/misc.ts'
import type { HealthDto } from '../src/api/dto/index.ts'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'
import { ScenarioPage } from '../src/features/scenario/ScenarioPage.tsx'
import { setMockActiveOptimization } from '../src/mocks/store.ts'
import { EngineStatus } from '../src/shared/EngineStatus.tsx'
import { activeOptimizationLabel } from '../src/shared/optimizationStatus.ts'

// UX Optimizer 진행 중 표시 (FE #67). health `activeOptimization`과 409 RUN_ALREADY_ACTIVE 안내

afterEach(() => setMockActiveOptimization(null))

const baseHealth: HealthDto = {
  status: 'READY',
  backend: { ready: true },
  model: { ready: true, modelVersion: 'm', endpointId: 'e' },
  browser: { ready: true },
  agent: { ready: true },
  activeRun: null,
  checkedAt: '2026-11-19T00:00:00Z',
}

it('Adapter: 필드가 없으면 null, 있으면 그대로, 모르는 status도 오류로 만들지 않는다', () => {
  expect(toHealth(baseHealth).activeOptimization).toBeNull()
  expect(toHealth({ ...baseHealth, activeOptimization: null }).activeOptimization).toBeNull()
  expect(
    toHealth({ ...baseHealth, activeOptimization: { optimizationId: 'opt_1', status: 'VERIFYING' } }).activeOptimization,
  ).toEqual({ optimizationId: 'opt_1', status: 'VERIFYING' })
  expect(
    toHealth({ ...baseHealth, activeOptimization: { optimizationId: 'opt_1', status: 'NEW_STATE' } }).activeOptimization,
  ).toEqual({ optimizationId: 'opt_1', status: 'NEW_STATE' })
  // 형식이 어긋난 값은 진행 중이 아닌 것으로 본다
  expect(toHealth({ ...baseHealth, activeOptimization: {} as never }).activeOptimization).toBeNull()
})

it('상태 문구: 알려진 상태를 구분하고 모르는 값은 진행 중으로 보인다', () => {
  expect(activeOptimizationLabel('EVALUATING')).toBe('후보 평가 중')
  expect(activeOptimizationLabel('VERIFYING')).toBe('후보 검증 중')
  expect(activeOptimizationLabel('MODEL_CALL_PENDING')).toBe('모델 응답 대기 중')
  expect(activeOptimizationLabel('SOMETHING_NEW')).toBe('진행 중')
})

it('엔진 상태에 진행 중인 Optimizer가 표시되고, 없으면 표시하지 않는다', async () => {
  const view = render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText(/엔진 준비 완료/)).toBeTruthy()
  expect(screen.queryByText(/Optimizer/)).toBeNull()
  view.unmount()

  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'MODEL_CALL_PENDING' })
  render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText(/Optimizer 모델 응답 대기 중/)).toBeTruthy()
})

it('새 UX 분석: Optimizer 진행 중 안내를 보이고, 시작하면 409의 서버 메시지를 그대로 보인다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'EVALUATING' })
  render(<MemoryRouter><NewAnalysisPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('탐색 목표 문장'), { target: { value: '주문 내역 화면 찾기' } })
  fireEvent.change(screen.getByLabelText('사용자 유형 문장'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  expect(await screen.findByText(/Optimizer가 후보 평가 중입니다/)).toBeTruthy()
  const button = () => screen.getAllByRole('button', { name: '분석 시작' })[0] as HTMLButtonElement
  // 시작 버튼은 서버 판단(409)에 맡기고 막지 않는다
  await waitFor(() => expect(button().disabled).toBe(false))
  fireEvent.click(button())
  expect(await screen.findByText('Optimization opt_mock_1 후보 평가가 진행 중입니다.')).toBeTruthy()
  expect(screen.queryByText('진행 중인 Run 보기')).toBeNull()
})

it('시나리오 테스트: Optimizer 진행 중 안내를 보이고, 시작하면 409의 서버 메시지를 그대로 보인다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_2', status: 'VERIFYING' })
  render(<MemoryRouter><ScenarioPage /></MemoryRouter>)
  await screen.findByLabelText('사이트 선택')
  fireEvent.change(screen.getByLabelText('상황 문장'), { target: { value: '마음에 드는 제품을 담을 화면 찾기' } })
  fireEvent.change(screen.getByLabelText('사용자 유형 문장'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  const select = screen.getByLabelText('도착 화면') as HTMLSelectElement
  const option = Array.from(select.options).find((o) => o.textContent === '제품 목록')!
  fireEvent.change(select, { target: { value: option.value } })
  expect(await screen.findByText(/Optimizer가 후보 검증 중입니다/)).toBeTruthy()
  const start = screen.getByRole('button', { name: '시나리오 시작' }) as HTMLButtonElement
  await waitFor(() => expect(start.disabled).toBe(false))
  fireEvent.click(start)
  expect(await screen.findByText('Optimization opt_mock_2 후보 검증 실행이 진행 중입니다.')).toBeTruthy()
})
