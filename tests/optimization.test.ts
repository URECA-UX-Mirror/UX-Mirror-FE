import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { toRun } from '../src/adapters/run.ts'
import {
  toCandidateEvaluation,
  toOptimization,
  toOptimizationReport,
  toSelection,
  toVerification,
} from '../src/adapters/optimization.ts'
import { ApiError, apiUrl } from '../src/api/client.ts'
import type {
  CandidateEvaluationDto,
  OptimizationDto,
  RunDto,
} from '../src/api/dto/index.ts'
import {
  createOptimization,
  getOptimization,
  getOptimizationReport,
  startVerification,
} from '../src/api/optimizations.ts'
import {
  hasOptimizationErrorMessage,
  optimizationErrorMessage,
} from '../src/domain/optimizationErrors.ts'
import { isTerminalOptimizationStatus } from '../src/domain/optimizationStatus.ts'
import { buildOptimization, buildReport } from '../src/mocks/fixtures/optimization.ts'
import { buildRun } from '../src/mocks/fixtures/run.ts'
import { findOptimization, findRun } from '../src/mocks/store.ts'
import { useOptimizationProgress } from '../src/shared/useOptimizationProgress.ts'
import { server } from './setup.ts'

// UX Optimizer API 클라이언트·Adapter·폴링·오류 문구 (FE #68, 임시 OI-12). mock 시나리오 일관성은 mock-consistency.test.ts

const FAR_FUTURE = Date.parse('2100-01-01T00:00:00Z')

const completed = () => buildOptimization(findOptimization('opt_mock_completed')!, FAR_FUTURE)

// ---- 요청 형식 ----

it('createOptimization: 본문은 sourceRunId가 있을 때만 싣는다', async () => {
  const bodies: unknown[] = []
  server.use(
    http.post(apiUrl('/api/optimizations'), async ({ request }) => {
      bodies.push(await request.json())
      return HttpResponse.json(
        { optimizationId: 'opt_1', status: 'CREATED', createdAt: '2026-11-19T00:00:00Z' },
        { status: 202 },
      )
    }),
  )
  expect(await createOptimization()).toEqual({
    optimizationId: 'opt_1',
    status: 'CREATED',
    createdAt: '2026-11-19T00:00:00Z',
  })
  await createOptimization('run_1')
  expect(bodies).toEqual([{}, { sourceRunId: 'run_1' }])
})

it('startVerification: 본문 없는 POST /verify, 응답의 Run ID는 없으면 null이다', async () => {
  let seen: { method: string; path: string; contentType: string | null; body: string } | null = null
  server.use(
    http.post(apiUrl('/api/optimizations/:id/verify'), async ({ request }) => {
      seen = {
        method: request.method,
        path: new URL(request.url).pathname,
        contentType: request.headers.get('content-type'),
        body: await request.text(),
      }
      return HttpResponse.json(
        { optimizationId: 'opt/1', status: 'VERIFYING', verificationPhase: 'BASELINE', baselineRunId: null },
        { status: 202 },
      )
    }),
  )
  const started = await startVerification('opt/1')
  expect(seen).toEqual({ method: 'POST', path: '/api/optimizations/opt%2F1/verify', contentType: null, body: '' })
  expect(started).toEqual({
    optimizationId: 'opt/1',
    status: 'VERIFYING',
    verificationPhase: 'BASELINE',
    baselineRunId: null,
    validationRunId: null,
  })
})

it('getOptimization·getOptimizationReport: id를 인코딩한 GET 경로를 쓴다', async () => {
  const paths: string[] = []
  server.use(
    http.get(apiUrl('/api/optimizations/:id'), ({ request }) => {
      paths.push(new URL(request.url).pathname)
      return HttpResponse.json(buildOptimization(findOptimization('opt_mock_evaluated')!, FAR_FUTURE))
    }),
    http.get(apiUrl('/api/optimizations/:id/report'), ({ request }) => {
      paths.push(new URL(request.url).pathname)
      return HttpResponse.json(buildReport(findOptimization('opt_mock_completed')!, FAR_FUTURE))
    }),
  )
  expect((await getOptimization('opt a')).status).toBe('EVALUATED')
  expect((await getOptimizationReport('opt a')).status).toBe('COMPLETED')
  expect(paths).toEqual(['/api/optimizations/opt%20a', '/api/optimizations/opt%20a/report'])
})

it('오류 응답은 ApiError로 코드와 상태를 담는다', async () => {
  const error = await getOptimization('opt_none').catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 404, code: 'OPTIMIZATION_NOT_FOUND' })
  const notReady = await getOptimizationReport('opt_mock_evaluated').catch((e: unknown) => e)
  expect(notReady).toMatchObject({ status: 409, code: 'OPTIMIZATION_NOT_READY' })
})

// ---- Adapter ----

const evaluation = (patch: Partial<CandidateEvaluationDto> = {}): CandidateEvaluationDto => ({
  candidateId: 'C2',
  candidateOrder: 2,
  label: '주문·환불',
  role: 'CANDIDATE',
  semanticClarityRank: 1,
  siteInstanceId: 'site-c2',
  candidateValidity: 'VALID',
  invalidReasons: [],
  evaluationStatus: 'COMPLETED',
  probabilities: { a: 0.7, b: 0.3 },
  targetOptionProbability: 0.7,
  goalPathProbability: 0.9,
  goalPathBasis: 'ALLOWED_PATHS',
  metricNullReasons: {},
  modelLatencyMs: 1000,
  error: null,
  evaluatedAt: '2026-11-19T00:00:00Z',
  ...patch,
})

it('Adapter: 계산할 수 없는 지표는 0이 아니라 null이고 사유를 그대로 둔다', () => {
  const result = toCandidateEvaluation(
    evaluation({
      goalPathProbability: null,
      goalPathBasis: null,
      metricNullReasons: { goalPathProbability: 'NO_REFERENCE_PATH' },
      // 숫자가 아닌 값이 와도 0으로 바꾸지 않는다
      targetOptionProbability: 'x' as never,
      probabilities: { a: 0.7, b: null as never },
    }),
  )
  expect(result.goalPathProbability).toBeNull()
  expect(result.targetOptionProbability).toBeNull()
  expect(result.metricNullReasons).toEqual({ goalPathProbability: 'NO_REFERENCE_PATH' })
  expect(result.probabilities).toEqual({ a: 0.7 })
})

it('Adapter: 평가 전 후보와 모르는 평가 상태·유효성 값은 오류 없이 그대로 둔다', () => {
  const waiting = toCandidateEvaluation(
    evaluation({
      candidateValidity: null,
      evaluationStatus: null,
      probabilities: null,
      targetOptionProbability: null,
      goalPathProbability: null,
      modelLatencyMs: null,
      evaluatedAt: null,
    }),
  )
  expect(waiting).toMatchObject({
    candidateValidity: null,
    evaluationStatus: null,
    probabilities: null,
    modelLatencyMs: null,
  })
  const unknown = toCandidateEvaluation(
    evaluation({ evaluationStatus: 'PAUSED' as never, candidateValidity: 'MAYBE' as never, invalidReasons: ['NEW_REASON'] }),
  )
  expect(unknown).toMatchObject({ evaluationStatus: 'PAUSED', candidateValidity: 'MAYBE', invalidReasons: ['NEW_REASON'] })
})

it('Adapter: 모르는 상태와 이유 코드는 원문 그대로이고 선정·검증이 없으면 null이다', () => {
  const dto = { ...buildOptimization(findOptimization('opt_mock_completed')!, FAR_FUTURE) }
  const result = toOptimization({
    ...dto,
    status: 'RE_EVALUATING' as never,
    verificationPhase: 'SOMETHING' as never,
    selection: { selectionReasonCode: 'NEW_REASON', excludedCandidates: [{ candidateId: 'C3', reasonCodes: ['A', 'B'] }] },
    verification: { decision: 'MAYBE', reasonCode: 'ANOTHER_REASON' },
    finalDecision: 'SOMETHING_NEW',
  })
  expect(result.status).toBe('RE_EVALUATING')
  expect(result.verificationPhase).toBe('SOMETHING')
  expect(result.selection).toMatchObject({
    reasonCode: 'NEW_REASON',
    recommendedCandidateId: null,
    excludedCandidates: [{ candidateId: 'C3', reasonCodes: ['A', 'B'] }],
  })
  expect(result.verification).toMatchObject({ decision: 'MAYBE', reasonCode: 'ANOTHER_REASON' })
  expect(result.finalDecision).toBe('SOMETHING_NEW')
  expect(toSelection(null)).toBeNull()
  expect(toVerification(undefined)).toBeNull()
  // `finalDecision`이 우선, 없으면 `decision`
  expect(toVerification({ finalDecision: 'A', decision: 'B' })?.decision).toBe('A')
})

it('Adapter: 진행 중에는 선정·검증·Run ID가 없다(null)', () => {
  const early = toOptimization(buildOptimization(findOptimization('opt_mock_evaluated')!, Date.parse('2026-11-01T09:40:00+09:00') + 2000))
  expect(early).toMatchObject({
    status: 'EVALUATING',
    selection: null,
    verification: null,
    finalDecision: null,
    baselineRunId: null,
    validationRunId: null,
    error: null,
  })
  expect(early.evaluations).toHaveLength(early.progress.evaluatedCount)
})

it('Adapter: 실패한 Optimization은 실패 단계와 직전 상태를 담고 details는 가져오지 않는다', () => {
  const failed = toOptimization(buildOptimization(findOptimization('opt_mock_site_changed')!, FAR_FUTURE))
  expect(failed.status).toBe('FAILED')
  expect(failed.error).toEqual({
    code: 'SITE_INSTANCE_CHANGED',
    message: expect.any(String),
    retryable: false,
    occurredAt: expect.any(String),
    failedPhase: 'VERIFYING',
    lastStatus: 'VERIFYING',
  })
})

it('Adapter: 보고서는 두 검증 Run과 정책 버전, 한계 안내를 도메인 타입으로 옮긴다', () => {
  const report = toOptimizationReport(buildReport(findOptimization('opt_mock_completed')!, FAR_FUTURE)!)
  expect(report.runs.baseline).toMatchObject({ executionRole: 'BASELINE', variant: 'before', label: '이용정보', validity: 'VALID' })
  expect(report.runs.candidate).toMatchObject({ executionRole: 'CANDIDATE', variant: 'after', label: '주문·환불' })
  expect(report.runs.candidate.path.length).toBeGreaterThan(0)
  expect(report.policyVersions).toEqual({ selection: 'selection-v1', verification: 'verification-v1' })
  expect(report.limitations).toMatchObject({ baselineRunCount: 1, candidateRunCount: 1, repeated: false })
  expect(report.finalDecision).toBe(completed().finalDecision)
})

it('Adapter: Run의 optimizationContext는 있으면 옮기고 없으면 null(일반 Run)이다', () => {
  const normal = buildRun(findRun('run_mock_done_before')!, FAR_FUTURE)
  expect('optimizationContext' in normal).toBe(false)
  expect(toRun(normal).optimizationContext).toBeNull()
  expect(toRun({ ...normal, optimizationContext: null } as RunDto).optimizationContext).toBeNull()

  const candidate = findRun('run_opt_mock_completed_candidate')!
  const run = toRun(buildRun(candidate, FAR_FUTURE))
  expect(run.optimizationContext).toEqual({
    optimizationId: 'opt_mock_completed',
    candidateId: 'C2',
    label: '주문·환불',
    siteInstanceId: 'site-c2',
    executionRole: 'CANDIDATE',
  })
  // 어느 라벨 사이트인지는 variant가 아니라 context로 구분한다. 후보 Run도 variant는 after다
  expect(run.variant).toBe('after')
})

it('Adapter: 모르는 executionRole도 오류로 만들지 않는다', () => {
  const dto = buildRun(findRun('run_opt_mock_completed_candidate')!, FAR_FUTURE)
  const run = toRun({ ...dto, optimizationContext: { ...dto.optimizationContext!, executionRole: 'SHADOW' as never } })
  expect(run.optimizationContext?.executionRole).toBe('SHADOW')
})

// ---- 종료 판정과 폴링 ----

it('종료 판정: COMPLETED·FAILED만 종료이고 진행 중·모르는 상태는 종료가 아니다', () => {
  expect(isTerminalOptimizationStatus('COMPLETED')).toBe(true)
  expect(isTerminalOptimizationStatus('FAILED')).toBe(true)
  for (const status of ['CREATED', 'EVALUATING', 'EVALUATED', 'VERIFYING', 'MODEL_CALL_PENDING', 'SOMETHING_NEW', '']) {
    expect([status, isTerminalOptimizationStatus(status)]).toEqual([status, false])
  }
})

it('폴링 훅: 종료 상태(COMPLETED·FAILED)에서 멈춘다', async () => {
  for (const [id, status] of [['opt_mock_completed', 'COMPLETED'], ['opt_mock_interrupted', 'FAILED']] as const) {
    const { result, unmount } = renderHook(() => useOptimizationProgress(id))
    await waitFor(() => expect(result.current.status).toBe('done'))
    expect(result.current.data?.status).toBe(status)
    unmount()
  }
})

it('폴링 훅: EVALUATED(검증 대기)는 종료가 아니라 폴링이 이어진다', async () => {
  const { result, unmount } = renderHook(() => useOptimizationProgress('opt_mock_evaluated'))
  await waitFor(() => expect(result.current.data?.status).toBe('EVALUATED'))
  expect(result.current.status).toBe('polling')
  unmount()
})

it('폴링 훅: 없는 Optimization(404)은 재시도 없이 멈추고 enabled=false이면 조회하지 않는다', async () => {
  const missing = renderHook(() => useOptimizationProgress('opt_none'))
  await waitFor(() => expect(missing.result.current.status).toBe('failed'))
  expect(missing.result.current.error).toMatchObject({ status: 404, code: 'OPTIMIZATION_NOT_FOUND' })
  missing.unmount()

  const off = renderHook(() => useOptimizationProgress('opt_mock_completed', { enabled: false }))
  expect(off.result.current).toMatchObject({ status: 'idle', data: null })
  off.unmount()
})

// ---- 오류 문구 ----

it('오류 문구: API 오류 코드와 실패 코드를 한 함수에서 화면 문구로 바꾼다', () => {
  const api = ['OPTIMIZATION_NOT_FOUND', 'OPTIMIZATION_NOT_READY', 'OPTIMIZATION_ALREADY_PROCESSED', 'RUN_ALREADY_ACTIVE',
    'INVALID_SITE_INSTANCE', 'EXPERIMENT_CONDITION_MISMATCH', 'MODEL_UNAVAILABLE', 'OPTIMIZER_POLICY_UNAVAILABLE']
  const failure = ['BASELINE_INVALID', 'BASELINE_NOT_EVALUATED', 'MODEL_TIMEOUT', 'SITE_INSTANCE_CHANGED',
    'SITE_RECHECK_FAILED', 'RUN_TIMEOUT', 'OPTIMIZATION_INTERRUPTED', 'OPTIMIZATION_FAILED']
  const messages = new Set<string>()
  for (const code of [...api, ...failure, 'BROWSER_ERROR']) {
    expect([code, hasOptimizationErrorMessage(code)]).toEqual([code, true])
    const message = optimizationErrorMessage(code, '서버 원문')
    expect(message).not.toBe('서버 원문')
    expect(message).not.toMatch(/[A-Z_]{8,}/) // 코드명을 그대로 보이지 않는다
    messages.add(message)
  }
  expect(messages.size).toBe(api.length + failure.length + 1) // 코드마다 문구가 다르다
})

it('오류 문구: 모르는 코드는 서버 메시지, 그것도 없으면 일반 안내를 쓴다', () => {
  expect(hasOptimizationErrorMessage('NEW_CODE')).toBe(false)
  expect(optimizationErrorMessage('NEW_CODE', '  서버 안내  ')).toBe('서버 안내')
  expect(optimizationErrorMessage('NEW_CODE', '  ')).toBe('요청을 처리하지 못했습니다.')
  expect(optimizationErrorMessage(null)).toBe('요청을 처리하지 못했습니다.')
  // 객체 기본 속성 이름이 코드로 와도 문구로 오해하지 않는다
  expect(hasOptimizationErrorMessage('toString')).toBe(false)
})

it('도메인 타입 변환 결과에 내부 주소(baseUrl)가 없다', () => {
  const json = JSON.stringify(toOptimization(completed() as OptimizationDto))
  expect(json).not.toMatch(/baseUrl|127\.0\.0\.1|localhost/)
})
