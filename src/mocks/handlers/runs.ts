import { delay, http, HttpResponse } from 'msw'
import type {
  CreateRunRequestDto,
  CreateRunResponseDto,
  RunListDto,
  StepListDto,
} from '../../api/dto/index.ts'
import { apiUrl } from '../../api/client.ts'
import { errorResponse, runNotFound } from '../errors.ts'
import {
  buildIssues,
  buildRun,
  buildSteps,
  getTiming,
  scenarioOf,
} from '../fixtures/run.ts'
import { stepSpecs } from '../fixtures/scenario.ts'
import { screenshotSvg } from '../fixtures/screenshot.ts'
import { issueOverride } from '../fixtures/runResult.ts'
import {
  addRun,
  allRuns,
  findExperimentRuns,
  findRun,
} from '../store.ts'

// 오류 시나리오를 켜는 방법(화면 개발용):
//   POST /api/runs 의 experimentKey가 `mock-fail-503`으로 시작하면 503 BROWSER_ERROR
//   runId가 `run_mock_error` 이면 상세·steps·issues가 모두 500(retryable) — 폴링 backoff 확인용
//   없는 runId는 404 RUN_NOT_FOUND
// 시드 Run(종료 상태로 시작):
//   run_mock_done_*(mock-done), run_mock_partial_*(mock-partial), run_mock_goback(모델 GO_BACK),
//   run_mock_invalid → run_mock_invalid_retry(mock-invalid), run_mock_invalid_only(mock-invalid-run)
//   run_mock_maxsteps(목표 미도달), run_mock_issue_pending|failed|empty(/issues 상태 고정) — fixtures/runResult.ts

const ERROR_RUN_ID = 'run_mock_error'
const EXPERIMENT_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function brokenRun() {
  // 저장 실패 등 서버 내부 오류(계약 §4.9 STORAGE_ERROR, API 500)
  return errorResponse(500, 'STORAGE_ERROR', '서버 오류가 발생했습니다', true)
}

async function readBody(request: Request): Promise<Partial<CreateRunRequestDto>> {
  try {
    return (await request.json()) as Partial<CreateRunRequestDto>
  } catch {
    return {}
  }
}

const validationError = (message: string) =>
  errorResponse(422, 'CONTRACT_VALIDATION_ERROR', message)

export const runsHandlers = [
  http.post(apiUrl('/api/runs'), async ({ request }) => {
    await delay(200)
    const body = await readBody(request)

    if (body.experimentKey?.startsWith('mock-fail-503')) {
      return errorResponse(
        503,
        'BROWSER_ERROR',
        '실행 환경을 준비하지 못했습니다',
        true,
      )
    }
    // experimentKey: [A-Za-z0-9_-] 1~64자(계약 §5.1)
    if (
      !body.experimentKey ||
      !EXPERIMENT_KEY_PATTERN.test(body.experimentKey) ||
      (body.variant !== 'before' && body.variant !== 'after') ||
      !body.goalId ||
      !body.personaId
    ) {
      return validationError('요청 값이 올바르지 않습니다')
    }
    if (body.goalId !== 'refund' || body.personaId !== 'novice-shopper') {
      return validationError('지원하지 않는 목표 또는 사용자 유형입니다')
    }
    // maxSteps는 1~15 정수만 허용한다(계약 §5.1)
    if (
      body.maxSteps !== undefined &&
      (!Number.isInteger(body.maxSteps) ||
        body.maxSteps < 1 ||
        body.maxSteps > 15)
    ) {
      return validationError('최대 탐색 횟수는 1~15 사이여야 합니다')
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
    // 진행 중이거나 VALID인 Run이 있으면 거부한다. 모두 INVALID일 때만 같은 키로 다시 만들 수 있다.
    const blocking = findExperimentRuns(body.experimentKey, body.variant).filter(
      (run) => !run.invalid,
    )
    if (blocking.length > 0) {
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

  // Run 목록(계약 §17.10). 최신 Run이 먼저 온다.
  http.get(apiUrl('/api/runs'), async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const experimentKey = url.searchParams.get('experimentKey')
    const variant = url.searchParams.get('variant')
    const now = Date.now()
    const items = allRuns()
      .filter((run) => !experimentKey || run.experimentKey === experimentKey)
      .filter((run) => !variant || run.variant === variant)
      .map((run) => {
        const dto = buildRun(run, now)
        return {
          runId: dto.runId,
          experimentKey: dto.experimentKey,
          variant: dto.variant,
          status: dto.status,
          terminationReason: dto.terminationReason,
          validity: dto.validity,
          replacementRunId: dto.replacementRunId,
          resultOrigin: dto.resultOrigin,
          goalReached: dto.summary?.goalReached ?? null,
          createdAt: dto.createdAt,
          finishedAt: dto.finishedAt,
        }
      })
    const body: RunListDto = { count: items.length, items }
    return HttpResponse.json(body)
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
    const now = Date.now()
    const override = getTiming(record, now).terminal
      ? issueOverride(runId)
      : null
    return HttpResponse.json(override ?? buildIssues(record, now))
  }),

  // 화면별 mock 이미지(SVG, 1440×900)를 돌려준다. 저장된 Step이 아니면 404(서버도 RUN_NOT_FOUND를 쓴다).
  http.get(
    apiUrl('/api/runs/:runId/screenshots/:stepId'),
    async ({ params, request }) => {
      await delay(80)
      const record = findRun(String(params.runId))
      const stepId = Number(params.stepId)
      if (!record) return runNotFound()
      const { doneSteps } = getTiming(record, Date.now())
      // 오버레이 이미지는 mock에 없다. 없으면 404다(계약 §17.7)
      const kind = new URL(request.url).searchParams.get('kind')
      if (
        kind === 'overlay' ||
        !Number.isInteger(stepId) ||
        stepId < 1 ||
        stepId > doneSteps
      ) {
        return errorResponse(
          404,
          'RUN_NOT_FOUND',
          '스크린샷을 찾을 수 없습니다',
        )
      }
      const scenario = scenarioOf(record)
      const spec = stepSpecs(scenario)[stepId - 1]
      // 홈 상단 메뉴 라벨만 버전마다 다르다(Before `이용정보` / After `주문·환불`)
      const menuLabel = scenario === 'after' ? '주문·환불' : '이용정보'
      return new HttpResponse(screenshotSvg(spec.pageKey, menuLabel), {
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
      })
    },
  ),
]
