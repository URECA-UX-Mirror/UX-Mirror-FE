import { delay, http, HttpResponse } from 'msw'
import { apiUrl } from '../../api/client.ts'
import { errorResponse } from '../errors.ts'
import {
  buildComparison,
  type ComparisonMode,
} from '../fixtures/comparison.ts'
import { getTiming } from '../fixtures/run.ts'
import { findExperimentRun, findRun } from '../store.ts'

// 응답 종류를 고르는 방법(화면 개발용): experimentKey로 분기한다.
//   mock-done          Before/After 모두 종료된 Run(COMPLETED)
//   mock-partial       PARTIAL — 한쪽만 방문한 화면 포함
//   mock-mismatch      conditionsMatched=false — 모든 화면 비교 불가
//   mock-not-ready     409 COMPARISON_NOT_READY
//   mock-invalid-run   409 COMPARISON_RUN_INVALID
//   mock-error         500 ANALYSIS_ERROR
//   그 외               POST /api/runs 로 만든 Run을 찾는다. 없으면 404, 아직 끝나지 않았으면 409

const SEED_MODES: Record<string, ComparisonMode> = {
  'mock-done': 'COMPLETED',
  'mock-partial': 'PARTIAL',
  'mock-mismatch': 'MISMATCH',
}

export const comparisonsHandlers = [
  http.get(apiUrl('/api/comparisons/:experimentKey'), async ({ params }) => {
    await delay(200)
    const key = String(params.experimentKey)

    if (key === 'mock-not-ready') {
      return errorResponse(
        409,
        'COMPARISON_NOT_READY',
        '두 버전의 분석이 모두 끝나면 비교할 수 있습니다',
      )
    }
    if (key === 'mock-invalid-run') {
      return errorResponse(
        409,
        'COMPARISON_RUN_INVALID',
        '유효한 실행이 없는 버전이 있습니다',
      )
    }
    if (key === 'mock-error') {
      return errorResponse(500, 'ANALYSIS_ERROR', '비교 분석에 실패했습니다', true)
    }

    const seedMode = SEED_MODES[key]
    const before =
      seedMode !== undefined
        ? findRun('run_mock_done_before')
        : findExperimentRun(key, 'before')
    const after =
      seedMode !== undefined
        ? findRun('run_mock_done_after')
        : findExperimentRun(key, 'after')

    if (!before && !after) {
      return errorResponse(404, 'RUN_NOT_FOUND', '비교 대상을 찾을 수 없습니다')
    }
    const now = Date.now()
    if (
      !before ||
      !after ||
      !getTiming(before, now).terminal ||
      !getTiming(after, now).terminal
    ) {
      return errorResponse(
        409,
        'COMPARISON_NOT_READY',
        '두 버전의 분석이 모두 끝나면 비교할 수 있습니다',
      )
    }
    return HttpResponse.json(
      buildComparison(before, after, seedMode ?? 'COMPLETED'),
    )
  }),
]
