import { toIssueList } from '../adapters/issue.ts'
import { toCreatedRun, toRun, toRunList } from '../adapters/run.ts'
import { toStepList } from '../adapters/step.ts'
import type {
  CreatedRun,
  CreateRunInput,
  IssueList,
  Run,
  RunListItem,
  Step,
} from '../domain/types.ts'
import { apiUrl, request } from './client.ts'
import type {
  CreateRunRequestDto,
  CreateRunResponseDto,
  IssueListDto,
  RunDto,
  RunListDto,
  StepListDto,
} from './dto/index.ts'

const runPath = (runId: string) => `/api/runs/${encodeURIComponent(runId)}`

/** POST /api/runs (계약 §17.2). `startPath`·`viewport`·`promptVersion`은 보내지 않는다. */
export async function createRun(
  input: CreateRunInput,
  signal?: AbortSignal,
): Promise<CreatedRun> {
  const body: CreateRunRequestDto = {
    experimentKey: input.experimentKey,
    variant: input.variant,
    goalId: input.goalId,
    personaId: input.personaId,
    ...(input.maxSteps === undefined ? {} : { maxSteps: input.maxSteps }),
  }
  return toCreatedRun(
    await request<CreateRunResponseDto>('/api/runs', {
      method: 'POST',
      body,
      signal,
    }),
  )
}

/**
 * GET /api/runs (계약 §17.10). 최신 Run이 먼저 온다.
 * 이 브라우저에서 시작하지 않은 Run과 저장된 실측 Run도 포함된다.
 */
export async function listRuns(
  filter: { experimentKey?: string; variant?: 'before' | 'after' } = {},
  signal?: AbortSignal,
): Promise<RunListItem[]> {
  const query = new URLSearchParams()
  if (filter.experimentKey) query.set('experimentKey', filter.experimentKey)
  if (filter.variant) query.set('variant', filter.variant)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return toRunList(
    await request<RunListDto>(`/api/runs${suffix}`, { signal }),
  )
}

/** GET /api/runs/{runId} (계약 §17.3) */
export async function getRun(
  runId: string,
  signal?: AbortSignal,
): Promise<Run> {
  return toRun(await request<RunDto>(runPath(runId), { signal }))
}

/** GET /api/runs/{runId}/steps (계약 §17.4). 완전히 저장된 Step만 온다. */
export async function getRunSteps(
  runId: string,
  signal?: AbortSignal,
): Promise<Step[]> {
  return toStepList(
    await request<StepListDto>(`${runPath(runId)}/steps`, { signal }),
  )
}

/** GET /api/runs/{runId}/issues (계약 §17.5) */
export async function getRunIssues(
  runId: string,
  signal?: AbortSignal,
): Promise<IssueList> {
  return toIssueList(
    await request<IssueListDto>(`${runPath(runId)}/issues`, { signal }),
  )
}

/**
 * 원본 스크린샷 주소 (계약 §17.7). 항상 `VITE_API_BASE_URL` + 경로로 만든다.
 * 서버가 준 `screenshotRef`는 서버 내부 참조라서 주소로 쓰지 않는다.
 */
export function screenshotUrl(runId: string, stepId: number): string {
  return apiUrl(
    `${runPath(runId)}/screenshots/${stepId}?kind=original`,
  )
}
