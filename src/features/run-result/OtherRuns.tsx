import { Link } from 'react-router'
import { isApiError } from '../../api/client.ts'
import type { RunListItem } from '../../domain/types.ts'
import { isTerminalStatus } from '../../domain/runStatus.ts'

interface OtherRunsProps {
  currentRunId: string
  items: RunListItem[] | null
  error: unknown
  onRetry: () => void
}

/** "다른 실행 보기". 서버가 준 순서(최신 먼저)를 그대로 쓴다. 조회에 실패해도 화면의 나머지는 계속 동작한다. */
export function OtherRuns({
  currentRunId,
  items,
  error,
  onRetry,
}: OtherRunsProps) {
  return (
    <section className="result-section" aria-label="다른 실행 보기">
      <h2>다른 실행 보기</h2>
      {items === null ? (
        error ? (
          <p role="status">
            실행 목록을 불러오지 못했습니다
            {isApiError(error) ? ` (${error.message})` : ''}.{' '}
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          </p>
        ) : (
          <p role="status">실행 목록을 불러오는 중</p>
        )
      ) : (
        <ul className="run-list">
          {items.map((item) => (
            <li
              key={item.runId}
              aria-current={item.runId === currentRunId ? 'true' : undefined}
            >
              {item.runId === currentRunId ? (
                <strong>{item.runId} (현재)</strong>
              ) : isTerminalStatus(item.status) ? (
                <Link to={`/runs/${encodeURIComponent(item.runId)}/result`}>
                  {item.runId}
                </Link>
              ) : (
                <Link to={`/runs/${encodeURIComponent(item.runId)}`}>
                  {item.runId}
                </Link>
              )}
              <span> · {item.variant}</span>
              <span> · {item.status}</span>
              {item.goalReached === null ? null : (
                <span>
                  {item.goalReached ? ' · 목표 화면 도달' : ' · 목표 화면 미도달'}
                </span>
              )}
              {item.validity === 'INVALID' ? (
                <span>
                  {' '}
                  · 무효 처리된 실행
                  {item.replacementRunId
                    ? ` (대체 실행: ${item.replacementRunId})`
                    : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
