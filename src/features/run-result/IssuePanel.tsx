import type { ReactNode } from 'react'
import { isApiError } from '../../api/client.ts'
import type { IssueList } from '../../domain/types.ts'
import { ListChecksIcon } from '../../shared/icons.tsx'
import type { PollingStatus } from '../../shared/polling/usePolling.ts'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { evidenceLabel, evidenceValue, priorityLabel } from './issueLabels.ts'

interface IssuePanelProps {
  issues: IssueList | null
  pollingStatus: PollingStatus
  error: unknown
  /** 자동 재시도(backoff) 중 */
  retrying: boolean
  onRetry: () => void
}

/** 검토 후보(Issue). 서버 순서를 그대로 쓰고 다시 정렬하지 않는다. 카드마다 근거를 바로 보인다. */
export function IssuePanel({
  issues,
  pollingStatus,
  error,
  retrying,
  onRetry,
}: IssuePanelProps) {
  let body: ReactNode
  if (!issues) {
    body = error && pollingStatus === 'failed' ? (
      <p role="alert">
        검토 후보를 불러오지 못했습니다
        {isApiError(error) ? ` (${error.message})` : ''}.{' '}
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      </p>
    ) : (
      <p role="status">
        {retrying ? '연결 재시도 중' : '검토 후보를 불러오는 중'}
      </p>
    )
  } else if (issues.analysisStatus === 'PENDING') {
    body = (
      <p role="status">
        {pollingStatus === 'failed' && error
          ? `분석 대기 중 (조회 실패${isApiError(error) ? `: ${error.message}` : ''})`
          : retrying
            ? '분석 대기 중 · 연결 재시도 중'
            : '분석 대기 중'}
        {pollingStatus === 'exhausted' || pollingStatus === 'failed' ? (
          <>
            {' '}
            <button type="button" onClick={onRetry}>
              다시 조회
            </button>
          </>
        ) : null}
      </p>
    )
  } else if (issues.analysisStatus === 'FAILED') {
    body = <p role="alert">분석에 실패했습니다</p>
  } else if (issues.items.length === 0) {
    body = <p>검토 후보 0건</p>
  } else {
    body = (
      <ul className="issue-grid">
        {issues.items.map((issue) => (
          <li key={issue.issueId} className="issue-card">
            <div className="issue-card-head">
              <code>{issue.issueType}</code>
              <span className="issue-priority" data-priority={issue.reviewPriority}>
                {priorityLabel(issue.reviewPriority)}
              </span>
            </div>
            <h3>{issue.title}</h3>
            <p className="issue-desc">{issue.description}</p>
            <p className="issue-where num">
              {issue.pageKey ? `화면 ${issue.pageKey}` : '전체 세션'}
              {issue.stepId === null ? '' : ` · Step ${issue.stepId}`}
              {` · 발생 ${issue.occurrenceCount}회`}
            </p>
            <dl className="issue-evidence">
              {Object.entries(issue.evidence).map(([key, value]) => (
                <div key={key}>
                  <dt>{evidenceLabel(key)}</dt>
                  <dd>{evidenceValue(value)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="card" aria-label="검토 후보">
      <SectionTitle
        icon={<ListChecksIcon />}
        title="UX 검토 후보"
        aside={
          issues && issues.analysisStatus === 'COMPLETED'
            ? `${issues.items.length}건 탐지됨`
            : undefined
        }
      />
      <p className="probability-note">
        AI 탐색 기록 기반의 검토 후보이며 실제 사용자 결함이 아닙니다
      </p>
      {body}
    </section>
  )
}
