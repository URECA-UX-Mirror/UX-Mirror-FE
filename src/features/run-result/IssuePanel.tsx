import { useState, type ReactNode } from 'react'
import { isApiError } from '../../api/client.ts'
import type { IssueList } from '../../domain/types.ts'
import type { PollingStatus } from '../../shared/polling/usePolling.ts'
import { evidenceLabel, evidenceValue, priorityLabel } from './issueLabels.ts'

interface IssuePanelProps {
  issues: IssueList | null
  pollingStatus: PollingStatus
  error: unknown
  /** 자동 재시도(backoff) 중 */
  retrying: boolean
  onRetry: () => void
}

/** 검토 후보(Issue). 서버 순서를 그대로 쓰고 다시 정렬하지 않는다. 열린 상세는 화면 상태다. */
export function IssuePanel({
  issues,
  pollingStatus,
  error,
  retrying,
  onRetry,
}: IssuePanelProps) {
  const [openId, setOpenId] = useState<string | null>(null)

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
        분석 대기 중
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
      <ul className="issue-list">
        {issues.items.map((issue) => {
          const open = openId === issue.issueId
          return (
            <li key={issue.issueId}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : issue.issueId)}
              >
                <span className="issue-priority">
                  {priorityLabel(issue.reviewPriority)}
                </span>{' '}
                {issue.title}
              </button>
              {open ? (
                <div className="issue-detail">
                  <p>{issue.description}</p>
                  <p>
                    유형: {issue.issueType}
                    {issue.pageKey ? ` · 화면: ${issue.pageKey}` : ''}
                    {issue.stepId === null ? '' : ` · Step ${issue.stepId}`}
                    {` · 발생 ${issue.occurrenceCount}회`}
                  </p>
                  <dl className="summary-grid">
                    {Object.entries(issue.evidence).map(([key, value]) => (
                      <div key={key} className="evidence-row">
                        <dt>{evidenceLabel(key)}</dt>
                        <dd>{evidenceValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className="result-section" aria-label="검토 후보">
      <h2>검토 후보</h2>
      <p className="probability-note">
        AI 탐색 기록 기반의 검토 후보이며 실제 사용자 결함이 아닙니다
      </p>
      {body}
    </section>
  )
}
