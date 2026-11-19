import { request } from './client.ts'

/** AI 개선 진행 단계 (BE #130). 모르는 값은 문자열 그대로 */
export type ImprovementPhase = 'QUEUED' | 'STARTING' | 'LOOP' | 'BUILD_FINAL_SITE' | 'OFFICIAL_AND_VERIFY' | 'DONE' | string
export type ImprovementJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED' | string

/** 무엇으로 돌렸는지. 진단 Run에서 이어 왔으면 `sourceRunId`가 있다 */
export interface ImprovementInputDto {
  goal: string
  persona: string
  goalPage: string
  sourceRunId?: string
}

/** GET /api/improvements/{id} (BE #130·#131). `improvement`는 리포트(`improvement-v1` JSON), 루프가 끝나기 전에는 `null` */
export interface ImprovementJobDto {
  improvementId: string
  /** `LIVE` = 서버에서 시작한 실행(심사·시연용, 공식 기록 아님), `OFFICIAL` = 사전 등록 공식 실행 결과, `UNKNOWN` = 출처를 확인할 수 없는 결과 파일(연습 실행 등) */
  kind?: 'LIVE' | 'OFFICIAL' | 'UNKNOWN' | string
  status: ImprovementJobStatus
  phase: ImprovementPhase | null
  phases?: { phase: string; at: string }[]
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
  error: { code: string; message: string } | null
  input?: ImprovementInputDto | null
  improvement: unknown
}

export interface ImprovementListItemDto extends Omit<ImprovementJobDto, 'improvement'> {
  summary: { result?: string; beforeLabel?: string; afterLabel?: string | null; main?: { before?: number; after?: number } } | null
}

/** 시작 요청: 진단 Run에서 이어가기 또는 직접 입력 */
export type StartImprovementInput = { sourceRunId: string } | { goal: string; persona: string; goalPage: string }

export const ACTIVE_JOB_STATUSES = ['QUEUED', 'RUNNING']

export function startImprovement(input: StartImprovementInput, signal?: AbortSignal): Promise<ImprovementJobDto> {
  return request<ImprovementJobDto>('/api/improvements', { method: 'POST', body: input, signal })
}

export function getImprovement(improvementId: string, signal?: AbortSignal): Promise<ImprovementJobDto> {
  return request<ImprovementJobDto>(`/api/improvements/${encodeURIComponent(improvementId)}`, { signal })
}

export async function listImprovements(signal?: AbortSignal): Promise<ImprovementListItemDto[]> {
  const body = await request<{ items: ImprovementListItemDto[] }>('/api/improvements', { signal })
  return Array.isArray(body.items) ? body.items : []
}
