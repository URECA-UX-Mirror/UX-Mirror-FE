import { useState } from 'react'
import { Link } from 'react-router'
import type { IssueList, Run } from '../../domain/types.ts'
import { pathMetricNames, referenceBasisLabel } from '../../domain/referenceBasis.ts'
import { formatPathMetric, NOT_USED } from './format.ts'

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
export function RunSummaryPanel({ run, issues }: RunSummaryPanelProps) {
  const { summary } = run
  const basis = run.referenceBasis
  const directGoal = run.goalId === null
  const names = pathMetricNames(basis)
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
                  ? '목표 화면에 도달했습니다'
                  : '정해진 단계 안에 목표 화면에 도달하지 못했습니다'
              }
            />
            <StatCard
              label="탐색 단계"
              value={String(summary.stepCount)}
              unit={`단계 / 최대 ${run.maxSteps}`}
              note={`CLICK ${summary.clickCount}회 · GO_BACK ${summary.backCount}회 (모델 ${summary.modelBackCount} · 시스템 ${summary.systemBackCount})`}
            />
            <StatCard
              label="UX 검토 후보"
              value={issueCountText(issues)}
              note="AI 탐색 기록 기반의 선별 항목이며 실제 결함 확정이 아닙니다"
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
              {basis === 'SITE_MAP' ? (
                <>
                  <dt>{names?.extraSteps}</dt>
                  <dd>{formatPathMetric(summary.extraSteps, basis, directGoal, summary.goalReached)}</dd>
                  <dt>{names?.extraNavigationCost}</dt>
                  <dd>
                    {formatPathMetric(summary.extraNavigationCost, basis, directGoal, summary.goalReached)}
                  </dd>
                  <dt>{names?.detourMoveCount}</dt>
                  <dd>
                    {formatPathMetric(summary.detourMoveCount, basis, directGoal, summary.goalReached)}
                    <span className="metric-hint">목표 거리가 줄지 않은 이동</span>
                  </dd>
                  <dt>허용 경로 이탈</dt>
                  <dd>{NOT_USED}</dd>
                </>
              ) : (
                <>
                  <dt>추가 이동(extraSteps)</dt>
                  <dd>{formatPathMetric(summary.extraSteps, basis, directGoal, summary.goalReached)}</dd>
                  <dt>추가 이동 비용</dt>
                  <dd>
                    {formatPathMetric(summary.extraNavigationCost, basis, directGoal, summary.goalReached)}
                  </dd>
                </>
              )}
              <dt>검토 후보 수</dt>
              <dd>{issueCountText(issues)}</dd>
            </dl>
          ) : null}
        </>
      ) : (
        <p>요약 정보가 없습니다</p>
      )}
    </section>
  )
}
