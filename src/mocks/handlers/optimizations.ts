import { delay, http, HttpResponse } from 'msw'
import type {
  CreateOptimizationRequestDto,
  CreateOptimizationResponseDto,
  StartVerificationResponseDto,
} from '../../api/dto/index.ts'
import { apiUrl } from '../../api/client.ts'
import { errorResponse } from '../errors.ts'
import {
  buildOptimization,
  buildReport,
  verificationRuns,
} from '../fixtures/optimization.ts'
import { getTiming } from '../fixtures/run.ts'
import {
  addOptimization,
  allRuns,
  findOptimization,
  findRun,
  getMockActiveOptimization,
  markOptimizationVerifying,
} from '../store.ts'
import type { OptimizationScenario } from '../store.ts'

// UX Optimizer API mock (FE #68, 임시 OI-12). 시나리오 선택법과 시드는 fixtures/optimization.ts 주석을 따른다.
// 오류 응답은 BE README "UX Optimizer API"의 코드를 쓴다. 한 시간에 Optimization 하나만 진행하고, 진행 중에는 일반 Run도 409다.

const SCENARIO_BY_SOURCE: Record<string, OptimizationScenario> = {
  'mock-opt-partial': 'partial',
  'mock-opt-eval-timeout': 'eval-timeout',
  'mock-opt-site-changed': 'site-changed',
  'mock-opt-interrupted': 'interrupted',
  'mock-opt-invalid-site': 'invalid-site',
}

const notFound = () =>
  errorResponse(404, 'OPTIMIZATION_NOT_FOUND', 'Optimization을 찾을 수 없습니다.')

async function readBody(request: Request): Promise<CreateOptimizationRequestDto> {
  try {
    return (await request.json()) as CreateOptimizationRequestDto
  } catch {
    return {}
  }
}

/** 다른 Optimization이나 Run이 진행 중이면 `true`다(BE는 이때 `409 RUN_ALREADY_ACTIVE`) */
function busy(nowMs: number): boolean {
  return (
    getMockActiveOptimization(nowMs) !== null ||
    allRuns().some((run) => !getTiming(run, nowMs).terminal)
  )
}

const alreadyActive = () =>
  errorResponse(409, 'RUN_ALREADY_ACTIVE', '다른 실행이나 후보 평가가 진행 중입니다.', true)

export const optimizationsHandlers = [
  http.post(apiUrl('/api/optimizations'), async ({ request }) => {
    await delay(200)
    const { sourceRunId } = await readBody(request)

    if (sourceRunId === 'mock-opt-policy-unavailable') {
      return errorResponse(503, 'OPTIMIZER_POLICY_UNAVAILABLE', '후보 선정·판단 모듈을 불러오지 못했습니다.')
    }
    if (sourceRunId === 'mock-opt-condition-mismatch') {
      return errorResponse(422, 'EXPERIMENT_CONDITION_MISMATCH', 'Optimization 설정의 목표·사용자 유형이 preset에 없습니다.')
    }
    if (sourceRunId === 'mock-opt-model-unavailable') {
      return errorResponse(503, 'MODEL_UNAVAILABLE', '모델을 사용할 수 없습니다.', true)
    }
    const scenario = sourceRunId ? SCENARIO_BY_SOURCE[sourceRunId] : undefined
    if (sourceRunId && !scenario && !findRun(sourceRunId)) {
      return errorResponse(404, 'RUN_NOT_FOUND', '기준 진단 Run을 찾을 수 없습니다.')
    }

    const now = Date.now()
    if (busy(now)) return alreadyActive()

    const optimizationId = `opt_mock_${now.toString(36)}`
    addOptimization({
      optimizationId,
      scenario: scenario ?? 'success',
      sourceRunId: scenario ? null : (sourceRunId ?? null),
      createdAtMs: now,
    })
    const body: CreateOptimizationResponseDto = {
      optimizationId,
      status: 'CREATED',
      createdAt: new Date(now).toISOString(),
    }
    return HttpResponse.json(body, { status: 202 })
  }),

  http.get(apiUrl('/api/optimizations/:optimizationId'), async ({ params }) => {
    await delay(120)
    const record = findOptimization(String(params.optimizationId))
    if (!record) return notFound()
    return HttpResponse.json(buildOptimization(record, Date.now()))
  }),

  http.post(apiUrl('/api/optimizations/:optimizationId/verify'), async ({ params }) => {
    await delay(200)
    const record = findOptimization(String(params.optimizationId))
    if (!record) return notFound()
    const now = Date.now()
    const { status } = buildOptimization(record, now)
    if (status === 'VERIFYING' || status === 'COMPLETED') {
      return errorResponse(409, 'OPTIMIZATION_ALREADY_PROCESSED', '이미 검증 중이거나 완료된 Optimization입니다.')
    }
    if (status !== 'EVALUATED') {
      return errorResponse(409, 'OPTIMIZATION_NOT_READY', '후보 평가가 끝난 뒤에만 검증할 수 있습니다.')
    }
    if (busy(now)) return alreadyActive()
    if (record.scenario === 'invalid-site') {
      return errorResponse(422, 'INVALID_SITE_INSTANCE', '후보 C2의 사이트 인스턴스가 등록되어 있지 않습니다.')
    }

    markOptimizationVerifying(record.optimizationId, now)
    // 사이트가 바뀌는 시나리오는 Run을 만들지 않으므로 Run ID가 없다
    const [baseline, candidate] = verificationRuns({ ...record, verifyAtMs: now })
    const body: StartVerificationResponseDto = {
      optimizationId: record.optimizationId,
      status: 'VERIFYING',
      verificationPhase: 'BASELINE',
      baselineRunId: baseline?.runId ?? null,
      validationRunId: candidate?.runId ?? null,
    }
    return HttpResponse.json(body, { status: 202 })
  }),

  http.get(apiUrl('/api/optimizations/:optimizationId/report'), async ({ params }) => {
    await delay(150)
    const record = findOptimization(String(params.optimizationId))
    if (!record) return notFound()
    const report = buildReport(record, Date.now())
    if (!report) {
      return errorResponse(409, 'OPTIMIZATION_NOT_READY', '완료된 Optimization만 보고서를 볼 수 있습니다.')
    }
    return HttpResponse.json(report)
  }),
]
