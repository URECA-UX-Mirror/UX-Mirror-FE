import { bypass, delay, http, HttpResponse } from 'msw'
import type {
  CreateRunRequestDto,
  CreateRunResponseDto,
  StepListDto,
} from '../../api/dto/index.ts'
import { apiUrl } from '../../api/client.ts'
import { errorResponse, runNotFound } from '../errors.ts'
import {
  buildIssues,
  buildRun,
  buildSteps,
  getTiming,
} from '../fixtures/run.ts'
import { addRun, allRuns, findExperimentRun, findRun } from '../store.ts'

// 오류 시나리오를 켜는 방법(화면 개발용):
//   POST /api/runs 의 experimentKey가 `mock-fail-503`으로 시작하면 503
//   runId가 `run_mock_error` 이면 상세·steps·issues가 모두 500(retryable) — 폴링 backoff 확인용
//   없는 runId는 404 RUN_NOT_FOUND, 시드 Run(`run_mock_done_*`, `run_mock_invalid`)은 처음부터 종료 상태

const ERROR_RUN_ID = 'run_mock_error'

function brokenRun() {
  return errorResponse(500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다', true)
}

async function readBody(request: Request): Promise<Partial<CreateRunRequestDto>> {
  try {
    return (await request.json()) as Partial<CreateRunRequestDto>
  } catch {
    return {}
  }
}

export const runsHandlers = [
  http.post(apiUrl('/api/runs'), async ({ request }) => {
    await delay(200)
    const body = await readBody(request)

    if (body.experimentKey?.startsWith('mock-fail-503')) {
      return errorResponse(
        503,
        'SERVICE_UNAVAILABLE',
        '실행 환경을 준비하지 못했습니다',
        true,
      )
    }
    if (
      !body.experimentKey ||
      (body.variant !== 'before' && body.variant !== 'after') ||
      !body.goalId ||
      !body.personaId
    ) {
      return errorResponse(
        422,
        'CONTRACT_VALIDATION_ERROR',
        '요청 값이 올바르지 않습니다',
      )
    }

    // maxSteps는 1~15 정수만 허용한다(계약 §5.1)
    if (
      body.maxSteps !== undefined &&
      (!Number.isInteger(body.maxSteps) ||
        body.maxSteps < 1 ||
        body.maxSteps > 15)
    ) {
      return errorResponse(
        422,
        'CONTRACT_VALIDATION_ERROR',
        '최대 탐색 횟수는 1~15 사이여야 합니다',
      )
    }

    const now = Date.now()
    const active = allRuns().find((run) => !getTiming(run, now).terminal)
    if (active) {
      return errorResponse(
        409,
        'RUN_ALREADY_ACTIVE',
        '다른 분석이 실행 중입니다',
      )
    }
    if (findExperimentRun(body.experimentKey, body.variant)) {
      return errorResponse(
        409,
        'EXPERIMENT_RUN_EXISTS',
        '같은 버전의 실행이 이미 있습니다',
      )
    }

    const record = {
      runId: `run_mock_${now.toString(36)}`,
      experimentKey: body.experimentKey,
      variant: body.variant,
      goalId: body.goalId,
      personaId: body.personaId,
      maxSteps: body.maxSteps ?? 8,
      createdAtMs: now,
    }
    addRun(record)

    const response: CreateRunResponseDto = {
      runId: record.runId,
      experimentKey: record.experimentKey,
      variant: record.variant,
      status: 'READY',
      maxSteps: record.maxSteps,
      createdAt: new Date(now).toISOString(),
    }
    return HttpResponse.json(response, { status: 201 })
  }),

  http.get(apiUrl('/api/runs/:runId'), async ({ params }) => {
    await delay(120)
    const runId = String(params.runId)
    if (runId === ERROR_RUN_ID) return brokenRun()
    const record = findRun(runId)
    if (!record) return runNotFound()
    return HttpResponse.json(buildRun(record, Date.now()))
  }),

  // 완전히 저장된 Step만 온다. 시작 직후에는 빈 배열이다.
  http.get(apiUrl('/api/runs/:runId/steps'), async ({ params }) => {
    await delay(120)
    const runId = String(params.runId)
    if (runId === ERROR_RUN_ID) return brokenRun()
    const record = findRun(runId)
    if (!record) return runNotFound()
    const { doneSteps } = getTiming(record, Date.now())
    const items = buildSteps(record, doneSteps)
    const body: StepListDto = { runId, count: items.length, items }
    return HttpResponse.json(body)
  }),

  http.get(apiUrl('/api/runs/:runId/issues'), async ({ params }) => {
    await delay(120)
    const runId = String(params.runId)
    if (runId === ERROR_RUN_ID) return brokenRun()
    const record = findRun(runId)
    if (!record) return runNotFound()
    return HttpResponse.json(buildIssues(record, Date.now()))
  }),

  // 정적 PNG(1440×900)를 돌려준다. 저장된 Step이 아니면 404.
  http.get(
    apiUrl('/api/runs/:runId/screenshots/:stepId'),
    async ({ params }) => {
      await delay(80)
      const record = findRun(String(params.runId))
      const stepId = Number(params.stepId)
      if (!record) return runNotFound()
      const { doneSteps } = getTiming(record, Date.now())
      if (!Number.isInteger(stepId) || stepId < 1 || stepId > doneSteps) {
        return errorResponse(404, 'SCREENSHOT_NOT_FOUND', '화면이 없습니다')
      }
      const image = await fetch(
        bypass(new URL('/mock/screenshot.png', location.origin)),
      )
      return new HttpResponse(await image.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png' },
      })
    },
  ),
]
