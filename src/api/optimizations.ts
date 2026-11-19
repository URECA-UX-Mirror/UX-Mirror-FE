import {
  toCreatedOptimization,
  toOptimization,
  toOptimizationReport,
  toStartedVerification,
} from '../adapters/optimization.ts'
import type {
  CreatedOptimization,
  Optimization,
  OptimizationReport,
  StartedVerification,
} from '../domain/types.ts'
import { request } from './client.ts'
import type {
  CreateOptimizationRequestDto,
  CreateOptimizationResponseDto,
  OptimizationDto,
  OptimizationReportDto,
  StartVerificationResponseDto,
} from './dto/index.ts'

// UX Optimizer API (임시, OI-12). 계약 v1.3.8 §17.12 기준이며 이 저장소의 계약 문서(v1.3.5)에는 아직 없다.

const optimizationPath = (optimizationId: string) =>
  `/api/optimizations/${encodeURIComponent(optimizationId)}`

/**
 * POST /api/optimizations → `202`. 후보 평가를 비동기로 시작한다. `sourceRunId`는 있을 때만 보낸다.
 * 후보 풀·목표·모델 조건은 서버가 동결하므로 요청으로 바꿀 수 없다.
 */
export async function createOptimization(
  sourceRunId?: string,
  signal?: AbortSignal,
): Promise<CreatedOptimization> {
  const body: CreateOptimizationRequestDto =
    sourceRunId === undefined ? {} : { sourceRunId }
  return toCreatedOptimization(
    await request<CreateOptimizationResponseDto>('/api/optimizations', {
      method: 'POST',
      body,
      signal,
    }),
  )
}

/** GET /api/optimizations/{id}. 폴링은 `useOptimizationProgress`가 한다 */
export async function getOptimization(
  optimizationId: string,
  signal?: AbortSignal,
): Promise<Optimization> {
  return toOptimization(
    await request<OptimizationDto>(optimizationPath(optimizationId), { signal }),
  )
}

/** POST /api/optimizations/{id}/verify → `202`. 평가가 끝난(`EVALUATED`) Optimization만 시작할 수 있다. 본문은 없다 */
export async function startVerification(
  optimizationId: string,
  signal?: AbortSignal,
): Promise<StartedVerification> {
  return toStartedVerification(
    await request<StartVerificationResponseDto>(
      `${optimizationPath(optimizationId)}/verify`,
      { method: 'POST', signal },
    ),
  )
}

/** GET /api/optimizations/{id}/report. 완료된(`COMPLETED`) Optimization만 받을 수 있고 아니면 `409 OPTIMIZATION_NOT_READY`다 */
export async function getOptimizationReport(
  optimizationId: string,
  signal?: AbortSignal,
): Promise<OptimizationReport> {
  return toOptimizationReport(
    await request<OptimizationReportDto>(
      `${optimizationPath(optimizationId)}/report`,
      { signal },
    ),
  )
}
