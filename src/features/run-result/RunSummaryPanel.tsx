import { Link } from 'react-router'
import type { IssueList, Run } from '../../domain/types.ts'
import { formatCount } from './format.ts'

interface RunSummaryPanelProps {
  run: Run
  /** 아직 응답이 없으면 `null` */
  issues: IssueList | null
}

function issueCountText(issues: IssueList | null): string {
  if (!issues) return '확인 중'
  switch (issues.analysisStatus) {
    case 'COMPLETED':
      return `${issues.items.length}건`
    case 'FAILED':
      return '분석 실패'
    default:
      return '분석 대기 중'
  }
}

/** `Run.summary`를 그대로 표시한다. 계산하거나 보정하지 않는다. */
export function RunSummaryPanel({ run, issues }: RunSummaryPanelProps) {
  const { summary } = run
  return (
    <section className="result-section" aria-label="요약">
      <h2>요약</h2>
      {run.validity === 'INVALID' ? (
        <div role="alert" className="invalid-notice">
          <strong>무효 처리된 실행</strong>
          {run.invalidReason ? <p>사유: {run.invalidReason}</p> : null}
          {run.replacementRunId ? (
            <p>
              <Link
                to={`/runs/${encodeURIComponent(run.replacementRunId)}/result`}
              >
                대체 실행 보기 ({run.replacementRunId})
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {summary ? (
        <dl className="summary-grid">
          <dt>종료 상태</dt>
          <dd>
            {run.status}
            {run.terminationReason ? ` (${run.terminationReason})` : ''}
          </dd>
          <dt>목표 화면 도달</dt>
          <dd>{summary.goalReached ? '도달' : '도달하지 못함'}</dd>
          <dt>탐색 단계</dt>
          <dd>
            {summary.stepCount} / 최대 {run.maxSteps}
          </dd>
          <dt>CLICK 횟수</dt>
          <dd>{summary.clickCount}</dd>
          <dt>GO_BACK 횟수</dt>
          <dd>
            {summary.backCount} (모델 {summary.modelBackCount} · 시스템{' '}
            {summary.systemBackCount})
          </dd>
          <dt>추가 이동(extraSteps)</dt>
          <dd>{formatCount(summary.extraSteps)}</dd>
          <dt>추가 이동 비용</dt>
          <dd>{formatCount(summary.extraNavigationCost)}</dd>
          <dt>검토 후보 수</dt>
          <dd>{issueCountText(issues)}</dd>
        </dl>
      ) : (
        <p>요약 정보가 없습니다</p>
      )}
    </section>
  )
}
