import type { IssueListDto } from '../../api/dto/index.ts'
import type { RunRecord } from '../store.ts'

// ③ 결과 화면 개발용 시나리오. 기존 시드는 건드리지 않고 이 파일에서만 추가한다.
//   run_mock_maxsteps       최대 탐색 횟수(2)에 먼저 도달 → MAX_STEPS, extraSteps 계열 null, 목표 미도달 Issue
//   run_mock_issue_pending  종료 후에도 /issues가 계속 PENDING (분석 모듈 미연결 상태)
//   run_mock_issue_failed   /issues가 FAILED
//   run_mock_issue_empty    /issues가 COMPLETED이고 항목 0건
//   run_mock_sitemap        직접 입력한 목표 + 사이트 지도 기준(basis=SITE_MAP), 우회 이동(detourMoveCount) 1회
//   run_mock_sitemap_after  run_mock_sitemap과 같은 실험(mock-sitemap)의 After. 사이트 지도 기준이라 비교가 SITE_MAP끼리 된다
//   run_mock_mapfail        지도 오류로 referencePathConfig null(기준 없음), 목표는 preset
//   run_mock_direct_mapfail 직접 입력한 목표에서 지도 오류(referencePathConfig null)
//   run_mock_legacy_basis   basis 없는 과거 Run(ALLOWED_PATHS로 해석), detourMoveCount 없음

const SEED_AT_MS = Date.parse('2026-11-01T09:00:00+09:00')

const extra = (
  partial: Pick<RunRecord, 'runId' | 'experimentKey' | 'variant'> &
    Partial<RunRecord>,
  offsetMin: number,
): RunRecord => ({
  goalId: 'refund',
  personaId: 'novice-shopper',
  maxSteps: 8,
  createdAtMs: SEED_AT_MS + offsetMin * 60_000,
  ...partial,
})

export const RESULT_SEEDS: RunRecord[] = [
  extra(
    {
      runId: 'run_mock_maxsteps',
      experimentKey: 'mock-maxsteps',
      variant: 'before',
      maxSteps: 2,
    },
    30,
  ),
  extra(
    {
      runId: 'run_mock_issue_pending',
      experimentKey: 'mock-issue-pending',
      variant: 'before',
      scenario: 'direct',
    },
    31,
  ),
  extra(
    {
      runId: 'run_mock_issue_failed',
      experimentKey: 'mock-issue-failed',
      variant: 'before',
      scenario: 'direct',
    },
    32,
  ),
  extra(
    {
      runId: 'run_mock_issue_empty',
      experimentKey: 'mock-issue-empty',
      variant: 'before',
      scenario: 'direct',
    },
    33,
  ),
  extra(
    {
      runId: 'run_mock_sitemap',
      experimentKey: 'mock-sitemap',
      variant: 'before',
      // 직접 입력한 목표("주문 내역 화면 찾기"). 홈 → 마이페이지 → 주문 내역
      goalId: null,
      goal: '주문 내역 화면 찾기',
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/shop/orders', text: '주문 / 배송 조회', exact: false, scope: 'page' },
      personaId: null,
      persona: '쇼핑몰을 처음 쓰는 사용자',
      scenario: 'to-orders',
      reference: 'site-map',
    },
    34,
  ),
  extra(
    {
      runId: 'run_mock_sitemap_after',
      experimentKey: 'mock-sitemap',
      variant: 'after',
      goalId: null,
      goal: '주문 내역 화면 찾기',
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/shop/orders', text: '주문 / 배송 조회', exact: false, scope: 'page' },
      personaId: null,
      persona: '쇼핑몰을 처음 쓰는 사용자',
      scenario: 'to-orders-after',
      reference: 'site-map',
    },
    37,
  ),
  extra(
    {
      runId: 'run_mock_mapfail',
      experimentKey: 'mock-mapfail',
      variant: 'before',
      scenario: 'direct',
      reference: 'none',
    },
    35,
  ),
  extra(
    {
      runId: 'run_mock_direct_mapfail',
      experimentKey: 'mock-direct-mapfail',
      variant: 'before',
      goalId: null,
      goal: '주문 내역 화면 찾기',
      verification: { type: 'PATH_AND_VISIBLE_TEXT', path: '/shop/orders', text: '주문 / 배송 조회', exact: false, scope: 'page' },
      personaId: null,
      persona: '쇼핑몰을 처음 쓰는 사용자',
      scenario: 'to-orders',
      reference: 'none',
    },
    37,
  ),
  extra(
    {
      runId: 'run_mock_legacy_basis',
      experimentKey: 'mock-legacy-basis',
      variant: 'before',
      scenario: 'direct',
      reference: 'legacy',
    },
    36,
  ),
]

/** 특정 시드 Run의 `/issues` 응답을 고정한다. 해당하지 않으면 `null`이다. */
export function issueOverride(runId: string): IssueListDto | null {
  switch (runId) {
    case 'run_mock_issue_pending':
      return { runId, analysisStatus: 'PENDING', items: [] }
    case 'run_mock_issue_failed':
      return { runId, analysisStatus: 'FAILED', items: [] }
    case 'run_mock_issue_empty':
      return { runId, analysisStatus: 'COMPLETED', items: [] }
    default:
      return null
  }
}
