import { Link } from 'react-router'
import { isTerminalStatus } from '../../domain/runStatus.ts'
import { isScenarioRun } from '../../domain/site.ts'
import type { RunListItem } from '../../domain/types.ts'
import { optimizerRunText } from '../../shared/optimizerRun.ts'
import { VERSIONS } from '../new-analysis/constants.ts'
import { shortTime } from '../improvement/labels.ts'
import { statusLabel } from '../run-progress/statusLabel.ts'

interface OtherRunsProps {
  currentRunId: string
  items: RunListItem[] | null
  error: unknown
  /** 자동 재시도가 끝나 멈춘 상태 */
  failed: boolean
  onRetry: () => void
}

/** 목록 한 줄의 이름: 화면 종류 + 시작 시각 (Run ID는 보이지 않는다) */
function runName(item: RunListItem): string {
  const kind = isScenarioRun(item) ? '다른 사이트' : VERSIONS.find((v) => v.variant === item.variant)?.name ?? '진단'
  const time = shortTime(item.createdAt)
  return time ? `${kind} · ${time}` : kind
}

/** "같은 조건의 다른 진단". 서버가 준 순서(최신 먼저)를 그대로 쓴다. 조회에 실패해도 화면의 나머지는 계속 동작한다. */
export function OtherRuns({
  currentRunId,
  items,
  error,
  failed,
  onRetry,
}: OtherRunsProps) {
  return (
    <section className="result-section" aria-label="다른 실행 보기">
      <h2>같은 조건의 다른 진단</h2>
      {items === null ? (
        error && failed ? (
          <p role="status">
            목록을 불러오지 못했어요.{' '}
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          </p>
        ) : (
          <p role="status">
            {error ? '다시 연결하는 중이에요' : '목록을 불러오는 중이에요'}
          </p>
        )
      ) : (
        <ul className="run-list">
          {items.map((item) => (
            <li
              key={item.runId}
              aria-current={item.runId === currentRunId ? 'true' : undefined}
            >
              {item.runId === currentRunId ? (
                <strong>{runName(item)} (지금 보는 진단)</strong>
              ) : (
                <Link to={isTerminalStatus(item.status) ? `/runs/${encodeURIComponent(item.runId)}/result` : `/runs/${encodeURIComponent(item.runId)}`}>
                  {runName(item)}
                </Link>
              )}
              {item.optimizationContext ? (
                <span> · {optimizerRunText(item.optimizationContext)}</span>
              ) : null}
              <span> · {statusLabel({ status: item.status, error: null })}</span>
              {item.validity === 'INVALID' ? <span> · 결과로 쓸 수 없음</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
