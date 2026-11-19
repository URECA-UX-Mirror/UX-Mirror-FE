import { delay, http, HttpResponse } from 'msw'
import { apiUrl } from '../../api/client.ts'
import { errorResponse } from '../errors.ts'
import { buildComparison } from '../fixtures/comparison.ts'
import { buildIssues, getTiming } from '../fixtures/run.ts'
import { findExperimentRuns, findRun, type RunRecord } from '../store.ts'

// 시나리오 Run은 비교 대상에서 빠진다(임시, OI-11). 시나리오 Run만 있는 실험은 `404 RUN_NOT_FOUND`다.
const findComparableRuns = (key: string, variant: 'before' | 'after') =>
  findExperimentRuns(key, variant).filter((run) => !run.siteId)

// 응답 종류를 고르는 방법(화면 개발용): experimentKey로 고른다.
//   mock-done          COMPLETED  — 두 버전이 같은 화면(home, orders)만 방문
//   mock-partial       PARTIAL    — Before만 마이페이지 방문(NOT_VISITED_IN_AFTER)
//   mock-mismatch      PARTIAL    — conditionsMatched=false (mock-done의 Run을 쓴다)
//   mock-sitemap       COMPLETED/PARTIAL — 양쪽 모두 사이트 지도 기준(SITE_MAP). 우회 이동 행이 보인다
//   mock-basis-mismatch PARTIAL   — Before=사이트 지도, After=허용 경로. REFERENCE_PATH_CONFIG_MATCHED 실패
//   mock-invalid-run   409 COMPARISON_RUN_INVALID — 한쪽에 VALID Run이 없음
//   mock-error         500 ANALYSIS_ERROR
//   그 밖의 키          POST /api/runs 로 만든 Run을 비교한다. Before(3단계)와 After(2단계)라 PARTIAL이 나온다.
//                      없으면 404, 아직 끝나지 않았거나 Issue 분석이 PENDING이면 409 COMPARISON_NOT_READY

/** 최종 Run: 가장 최근의 VALID Run. 있으면 그 Run, 모두 INVALID면 `'invalid'`, Run이 없으면 `undefined` */
function finalRun(runs: RunRecord[]): RunRecord | 'invalid' | undefined {
  if (runs.length === 0) return undefined
  return runs.find((run) => !run.invalid) ?? 'invalid'
}

export const comparisonsHandlers = [
  http.get(apiUrl('/api/comparisons/:experimentKey'), async ({ params }) => {
    await delay(200)
    const key = String(params.experimentKey)

    if (key === 'mock-error') {
      return errorResponse(500, 'ANALYSIS_ERROR', '비교 분석에 실패했습니다', true)
    }
    if (key === 'mock-basis-mismatch') {
      const before = findRun('run_mock_sitemap')
      const after = findRun('run_mock_done_after')
      if (!before || !after) {
        return errorResponse(404, 'RUN_NOT_FOUND', '비교 대상을 찾을 수 없습니다')
      }
      return HttpResponse.json(
        buildComparison(before, after, false, key, 'REFERENCE_PATH_CONFIG_MATCHED'),
      )
    }
    const mismatch = key === 'mock-mismatch'
    const lookupKey = mismatch ? 'mock-done' : key

    const before = finalRun(findComparableRuns(lookupKey, 'before'))
    const after = finalRun(findComparableRuns(lookupKey, 'after'))

    if (before === undefined && after === undefined) {
      return errorResponse(404, 'RUN_NOT_FOUND', '비교 대상을 찾을 수 없습니다')
    }
    if (before === 'invalid' || after === 'invalid') {
      return errorResponse(
        409,
        'COMPARISON_RUN_INVALID',
        '유효한 실행이 없는 버전이 있습니다',
      )
    }
    const now = Date.now()
    if (
      !before ||
      !after ||
      !getTiming(before, now).terminal ||
      !getTiming(after, now).terminal ||
      buildIssues(before, now).analysisStatus === 'PENDING' ||
      buildIssues(after, now).analysisStatus === 'PENDING'
    ) {
      return errorResponse(
        409,
        'COMPARISON_NOT_READY',
        '두 버전의 분석이 모두 끝나면 비교할 수 있습니다',
      )
    }
    return HttpResponse.json(buildComparison(before, after, !mismatch, key))
  }),
]
