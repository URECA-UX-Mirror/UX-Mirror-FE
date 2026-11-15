import { toIssueList } from '../adapters/issue.ts'
import { toCreatedRun, toRun } from '../adapters/run.ts'
import { toStepList } from '../adapters/step.ts'
import type {
  CreatedRun,
  CreateRunInput,
  IssueList,
  Run,
  Step,
} from '../domain/types.ts'
import { apiUrl, request } from './client.ts'
import type {
  CreateRunRequestDto,
  CreateRunResponseDto,
  IssueListDto,
  RunDto,
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
