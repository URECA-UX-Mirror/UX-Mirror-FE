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
import { scenarioForGoal, stepSpecs, textVisibleOn, VISIBLE_TEXTS } from '../fixtures/scenario.ts'
import { issueOverride } from '../fixtures/runResult.ts'
import {
  addRun,
  allRuns,
  findExperimentRuns,
  findRun,
  firstExperimentRun,
} from '../store.ts'
import type { RunRecord } from '../store.ts'

// 오류 시나리오를 켜는 방법(화면 개발용):
//   POST /api/runs 의 experimentKey가 `mock-fail-503`으로 시작하면 503 BROWSER_ERROR
//   `mock-preflight-503`이면 도착 화면 확인 실패(503 BROWSER_ERROR, 재시도 가능)
//   도착 화면에 없는 verification.text는 422 CONTRACT_VALIDATION_ERROR (Before/After 구분)
//   runId가 `run_mock_error` 이면 상세·steps·issues가 모두 500(retryable) — 폴링 backoff 확인용
//   없는 runId는 404 RUN_NOT_FOUND
// 시드 Run(종료 상태로 시작):
//   run_mock_done_*(mock-done), run_mock_partial_*(mock-partial), run_mock_goback(모델 GO_BACK),
//   run_mock_invalid → run_mock_invalid_retry(mock-invalid), run_mock_invalid_only(mock-invalid-run)
//   run_mock_maxsteps(목표 미도달), run_mock_issue_pending|failed|empty(/issues 상태 고정) — fixtures/runResult.ts
//   run_mock_direct_before(mock-direct): 목표·사용자 유형 직접 입력, 허용 경로 없음
// 직접 입력 검사(UX-Mirror-BE #42와 같은 규칙): 빈 값·200자 초과·누출 금지 문자열·성공 조건 오류·첫 Run과 다른 입력은 422

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

// 서버(`uxm/leak.py` FORBIDDEN)와 같은 목록. 직접 입력 문장에 있으면 실행 전에 거부한다
const FORBIDDEN = ['variant', 'before', 'after', 'testMode', 'testmode', 'nochange', 'deadend',
  'experimentKey', 'data-test-goal', 'refund-entry', 'semanticKey', 'menu_', 'goalId']
const SHOP_PAGES = ['home', 'mypage', 'support', 'orders', 'refund']

type Inputs = Pick<RunRecord, 'goalId' | 'goal' | 'verification' | 'personaId' | 'persona'>

function sentenceError(text: unknown, field: string): string | null {
  if (typeof text !== 'string' || !text.trim()) return `${field}가 비어 있습니다.`
  if (text.trim().length > 200) return `${field}는 200자 이하여야 합니다.`
  const words = FORBIDDEN.filter((w) => text.includes(w))
  return words.length ? `${field}에 쓸 수 없는 글자가 있습니다: ${words.join(', ')}` : null
}

/** 목표·사용자 유형 입력을 검사하고 저장할 값으로 정리한다. 오류면 문자열 */
function resolveInputs(body: Partial<CreateRunRequestDto>): Inputs | string {
  if ((body.goalId === undefined) === (body.goal === undefined)) return 'goalId와 goal 중 하나만 보내야 합니다.'
  if ((body.personaId === undefined) === (body.persona === undefined)) return 'personaId와 persona 중 하나만 보내야 합니다.'
  const inputs: Inputs = { goalId: null, personaId: null }
  if (body.goalId !== undefined) {
    if (body.verification) return 'goalId로 실행할 때는 verification을 보내지 않습니다.'
    if (body.goalId !== 'refund') return '지원하지 않는 목표입니다'
    inputs.goalId = body.goalId
  } else {
    const error = sentenceError(body.goal, 'goal')
    if (error) return error
    const v = body.verification
    if (!v) return 'goal을 직접 입력할 때는 성공 조건(verification)이 필요합니다.'
    const page = v.path?.trim().replace(/\/$/, '').replace(/^\/shop\//, '')
    if (!v.path?.trim().startsWith('/shop/') || !SHOP_PAGES.includes(page)) return 'verification.path가 쇼핑몰 화면이 아닙니다.'
    if (!v.text?.trim() || v.text.trim().length > 100) return 'verification.text는 1~100자여야 합니다.'
    if (v.scope !== undefined && v.scope !== 'page' && v.scope !== 'main') return 'verification.scope는 page/main 중 하나여야 합니다.'
    inputs.goal = (body.goal as string).trim()
    inputs.verification = { type: 'PATH_AND_VISIBLE_TEXT', path: v.path.trim(), text: v.text.trim(),
      exact: v.exact ?? false, scope: v.scope ?? 'page' }
  }
  if (body.personaId !== undefined) {
    if (body.personaId !== 'novice-shopper') return '지원하지 않는 사용자 유형입니다'
    inputs.personaId = body.personaId
  } else {
    const error = sentenceError(body.persona, 'persona')
    if (error) return error
    inputs.persona = (body.persona as string).trim()
  }
  return inputs
}

const sameInputs = (a: Inputs, b: Inputs) =>
  a.goalId === b.goalId && (a.goal ?? null) === (b.goal ?? null) &&
  a.personaId === b.personaId && (a.persona ?? null) === (b.persona ?? null) &&
  JSON.stringify(a.verification ?? null) === JSON.stringify(b.verification ?? null)

export const runsHandlers = [
  http.post(apiUrl('/api/runs'), async ({ request }) => {
    await delay(200)
    const body = await readBody(request)

    if (body.experimentKey === 'mock-preflight-503') {
      return errorResponse(503, 'BROWSER_ERROR', `${body.variant === 'after' ? 'After' : 'Before'} 도착 화면을 읽지 못했습니다`, true)
    }
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
      (body.variant !== 'before' && body.variant !== 'after')
    ) {
      return validationError('요청 값이 올바르지 않습니다')
    }
    const inputs = resolveInputs(body)
    if (typeof inputs === 'string') return validationError(inputs)
    // 직접 입력한 목표는 성공 조건의 도착 화면에서 끝나는 시나리오로 진행한다(환불 화면으로 가서 성공 처리하지 않음)
    const scenario = inputs.verification ? scenarioForGoal(body.variant, inputs.verification.path) : undefined
    if (scenario === null) return validationError('MOCK에서 지원하지 않는 도착 화면입니다 (시작 화면 home 등)')
    // MOCK은 화면 전체 글자를 모르므로, 도착 화면의 알려진 제목과 맞는 성공 조건만 받는다.
    // 화면에 없는 글자로 만든 Run이 성공으로 표시되지 않게 실행 전에 거부한다(exact·scope 포함)
    const v = inputs.verification
    if (v && !textVisibleOn(v.path, v.text, v.exact)) {
      const known = (VISIBLE_TEXTS[v.path] ?? []).join(', ')
      return validationError(`${body.variant === 'after' ? 'After' : 'Before'} 도착 화면(${v.path})에 '${v.text}' 글자가 없습니다${v.exact ? ' (정확 일치)' : ''}. MOCK에서 판정할 수 있는 글자: ${known}`)
    }
    const first = firstExperimentRun(body.experimentKey)
    if (first && !sameInputs(inputs, first)) {
      return validationError('같은 experimentKey의 첫 실행과 입력이 다릅니다')
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
      ...inputs,
      ...(scenario ? { scenario } : {}),
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

  // 화면별 mock 이미지(PNG, 1440×900)를 돌려준다. 이미지는 `mock-pages/`의 목업 쇼핑몰을 `npm run mock:shots`로 찍은 것이다. 저장된 Step이 아니면 404(서버도 RUN_NOT_FOUND를 쓴다).
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
      // 상단 메뉴 라벨만 버전마다 다르다(Before `이용정보` / After `주문·환불`). 이미지는 버전별로 따로 있다
      const image = await fetch(
        `${import.meta.env.BASE_URL}mock/screens/${record.variant === 'after' ? 'after' : 'before'}/${spec.pageKey}.png`,
      )
      if (!image.ok) {
        return errorResponse(404, 'RUN_NOT_FOUND', '스크린샷을 찾을 수 없습니다')
      }
      return new HttpResponse(await image.arrayBuffer(), {
        headers: { 'Content-Type': 'image/png' },
      })
    },
  ),
]
