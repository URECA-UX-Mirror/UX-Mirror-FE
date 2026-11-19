import { useState } from 'react'
import { Link } from 'react-router'
import type { IssueList, Run } from '../../domain/types.ts'
import { pathMetricNames, referenceBasisLabel } from '../../domain/referenceBasis.ts'
import { stopReasonLabel } from '../../shared/runLabels.ts'
import { formatPathMetric } from './format.ts'

interface RunSummaryPanelProps {
  run: Run
  /** 아직 응답이 없으면 `null` */
  issues: IssueList | null
  siteMapUnavailable?: boolean
}

function issueCountText(issues: IssueList | null, validity: Run['validity']): string {
  if (!issues) return '확인 중'
  switch (issues.analysisStatus) {
    case 'COMPLETED':
      if (validity === 'INVALID' && issues.items.length === 0) return '무효 실행'
      return `${issues.items.length}건`
    case 'FAILED':
      return '분석 실패'
    default:
      return '분석 대기 중'
  }
}

function StatCard({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: string
  unit?: string
  note: string
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <p className="stat-value">
        <strong>{value}</strong>
        {unit ? <span>{unit}</span> : null}
      </p>
      <p className="stat-note">{note}</p>
    </div>
  )
}

/** `Run.summary`를 그대로 표시한다. 계산하거나 보정하지 않는다. */
export function RunSummaryPanel({ run, issues, siteMapUnavailable = false }: RunSummaryPanelProps) {
  const { summary } = run
  const basis = run.referenceBasis
  // 기준 없음(`null`)은 이름을 정하지 않으므로 기존 허용 경로 표시를 쓴다
  const names = pathMetricNames(basis) ?? pathMetricNames('ALLOWED_PATHS')!
  // 전체 요약 표 펼침 여부는 화면 상태다
  const [open, setOpen] = useState(false)
  return (
    <section className="result-summary" aria-label="요약">
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
      {run.error ? (
        <div role="alert" className="invalid-notice">
          <strong>실행 오류</strong>
          <p>{run.error.message}</p>
        </div>
      ) : null}
      {siteMapUnavailable ? <p>이 사이트는 사이트 지도가 없어 경로 지표를 계산하지 않습니다</p> : null}
      {summary ? (
        <>
          <p className="basis-line">
            경로 지표 기준{' '}
            <span className="origin-badge" data-basis={basis ?? 'NONE'}>
              {referenceBasisLabel(basis)}
            </span>
          </p>
          <div className="stat-grid">
            <StatCard
              label="목표 달성"
              value={summary.goalReached ? '도달' : '도달하지 못함'}
              note={
                summary.goalReached
                  ? '목표 화면에 도착했어요'
                  : stopReasonLabel(run.terminationReason) ?? '목표 화면에 도착하지 못했어요'
              }
            />
            <StatCard
              label="클릭 수"
              value={String(summary.stepCount)}
              unit={`번 / 최대 ${run.maxSteps}`}
              note={`누름 ${summary.clickCount}번 · 뒤로 가기 ${summary.backCount}번`}
            />
            <StatCard
              label="살펴볼 점"
              value={issueCountText(issues, run.validity)}
              note="AI 고객의 기록에서 찾은 단서예요. 사람 테스트로 확인해 보세요"
            />
          </div>
          <button
            type="button"
            className="summary-toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? '요약 전체 접기' : '요약 전체 보기'}
          </button>
          {open ? (
            <dl className="summary-grid summary-full">
              <dt>끝난 이유</dt>
              <dd>{stopReasonLabel(run.terminationReason) ?? '-'}</dd>
              <dt>목표 화면 도달</dt>
              <dd>{summary.goalReached ? '도달' : '도달하지 못함'}</dd>
              <dt>탐색 단계</dt>
              <dd>
                {summary.stepCount} / 최대 {run.maxSteps}
              </dd>
              <dt>누른 횟수</dt>
              <dd>{summary.clickCount}</dd>
              <dt>뒤로 가기 횟수</dt>
              <dd>
                {summary.backCount} (모델 {summary.modelBackCount} · 시스템{' '}
                {summary.systemBackCount})
              </dd>
              <dt>{names.extraSteps}</dt>
              <dd>{formatPathMetric(summary.extraSteps, basis, summary.goalReached)}</dd>
              <dt>{names.extraNavigationCost}</dt>
              <dd>{formatPathMetric(summary.extraNavigationCost, basis, summary.goalReached)}</dd>
              {basis === 'SITE_MAP' ? (
                <>
                  <dt>{names.detourMoveCount}</dt>
                  <dd>
                    {formatPathMetric(summary.detourMoveCount, basis, summary.goalReached, 'detour')}
                    <span className="metric-hint">목표 거리가 줄지 않은 이동</span>
                  </dd>
                </>
              ) : null}
              <dt>검토 후보 수</dt>
              <dd>{issueCountText(issues, run.validity)}</dd>
            </dl>
          ) : null}
        </>
      ) : (
        <p>요약 정보가 없습니다</p>
      )}
    </section>
  )
}
