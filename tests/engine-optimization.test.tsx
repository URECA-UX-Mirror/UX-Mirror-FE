import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { toHealth } from '../src/adapters/misc.ts'
import { apiUrl } from '../src/api/client.ts'
import type { HealthDto } from '../src/api/dto/index.ts'
import { NewAnalysisPage } from '../src/features/new-analysis/NewAnalysisPage.tsx'
import { ScenarioPage } from '../src/features/scenario/ScenarioPage.tsx'
import { errorResponse } from '../src/mocks/errors.ts'
import { setMockActiveOptimization } from '../src/mocks/store.ts'
import { EngineStatus } from '../src/shared/EngineStatus.tsx'
import { activeOptimizationLabel } from '../src/shared/optimizationStatus.ts'
import { server } from './setup.ts'

// 진행 중인 작업 표시 (FE #67). health `activeOptimization`·`activeRunOwner`와 시작 화면의 진행 중 안내

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

const healthWith = (extra: Partial<HealthDto>) => server.use(http.get(apiUrl('/api/health'), () => HttpResponse.json({ ...baseHealth, ...extra })))
const statusLink = () => screen.queryByRole('link', { name: '보기' })

it('엔진 상태: 할 일이 없으면 준비됨, 후보 비교가 진행 중이면 후보 비교 중과 보기 링크', async () => {
  const view = render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('준비됨')).toBeTruthy()
  expect(statusLink()).toBeNull()
  view.unmount()

  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'MODEL_CALL_PENDING' })
  render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('후보 비교 중')).toBeTruthy()
  expect(statusLink()?.getAttribute('href')).toBe('/optimizations/opt_mock_1')
  // 개발자용 이름(Optimizer)·상태 코드는 보이지 않는다
  expect(screen.queryByText(/Optimizer|MODEL_CALL_PENDING/)).toBeNull()
})

it('엔진 상태: AI 개선이 진행 중이면 진단 중보다 먼저 AI 개선 중을 보이고 그 화면으로 연결한다', async () => {
  healthWith({ activeRun: 'run_1', activeRunOwner: { kind: 'IMPROVEMENT', runId: 'run_1', improvementId: 'imp 1' } })
  render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('AI 개선 중')).toBeTruthy()
  expect(statusLink()?.getAttribute('href')).toBe('/improvements/imp%201')
})

it('엔진 상태: 진단이 진행 중이면 진단 중과 진행 화면 링크', async () => {
  healthWith({ activeRun: 'run_1' })
  render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('진단 중')).toBeTruthy()
  expect(statusLink()?.getAttribute('href')).toBe('/runs/run_1')
})

it('엔진 상태: 링크 없는 작업은 다른 작업 진행 중, 준비 전은 준비 중, 조회 실패는 연결 안내', async () => {
  healthWith({ activeRunOwner: { kind: 'SOMETHING', runId: null, improvementId: null } })
  const first = render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('다른 작업 진행 중')).toBeTruthy()
  expect(statusLink()).toBeNull()
  first.unmount()

  healthWith({ status: 'NOT_READY' })
  const second = render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('준비 중')).toBeTruthy()
  second.unmount()

  server.use(http.get(apiUrl('/api/health'), () => errorResponse(500, 'STORAGE_ERROR', '서버 오류', true)))
  render(<MemoryRouter><EngineStatus /></MemoryRouter>)
  expect(await screen.findByText('서버에 연결할 수 없어요')).toBeTruthy()
})

const BUSY = '지금 다른 진단이 진행 중이에요. 끝나면 시작할 수 있어요.'

it('진단하기: 후보 비교가 진행 중이면 안내를 보이고 시작 버튼을 막는다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_1', status: 'EVALUATING' })
  render(<MemoryRouter><NewAnalysisPage /></MemoryRouter>)
  expect(await screen.findByText(BUSY)).toBeTruthy()
  expect((screen.getByRole('button', { name: '진단 시작' }) as HTMLButtonElement).disabled).toBe(true)
})

it('다른 사이트 진단: 후보 비교가 진행 중이면 안내를 보이고 시작 버튼을 막는다', async () => {
  setMockActiveOptimization({ optimizationId: 'opt_mock_2', status: 'VERIFYING' })
  render(<MemoryRouter><ScenarioPage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('진단할 사이트 링크'), { target: { value: 'https://ecudemo360127.cafe24.com' } })
  fireEvent.change(screen.getByLabelText('고객 유형'), { target: { value: '쇼핑몰을 처음 쓰는 사용자' } })
  fireEvent.change(screen.getByLabelText('고객이 하려는 일'), { target: { value: '마음에 드는 제품을 담을 화면 찾기' } })
  const select = screen.getByLabelText('도착하면 성공인 화면') as HTMLSelectElement
  fireEvent.change(select, { target: { value: 'products' } })
  expect(await screen.findByText(BUSY)).toBeTruthy()
  await waitFor(() => expect((screen.getByRole('button', { name: '진단 시작' }) as HTMLButtonElement).disabled).toBe(true))
})
