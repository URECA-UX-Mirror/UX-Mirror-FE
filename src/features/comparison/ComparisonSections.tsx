import type {
  Comparison,
  OptimizationContext,
  PathVisit,
  RunOutcome,
} from '../../domain/types.ts'
import { optimizerRunText } from '../../shared/optimizerRun.ts'
import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ListChecksIcon,
  RouteIcon,
  SettingsIcon,
} from '../../shared/icons.tsx'
import { VERSIONS } from '../new-analysis/constants.ts'
import { formatDelta, formatMetric, NULL_TEXT } from './format.ts'

const STATUS_TEXT: Record<string, string> = {
  COMPLETED: '모든 화면을 비교했습니다',
  PARTIAL: '비교할 수 있는 부분만 표시합니다',
}

// ---------- 비교 대상 ----------

function VersionPanel({
  side,
  runId,
  origin,
  outcome,
  context,
}: {
  side: 'before' | 'after'
  runId: string
  origin: string
  outcome: RunOutcome
  /** Optimizer 검증 Run이면 연결 정보. 어느 라벨 사이트인지는 `variant`(side)가 아니라 이 값으로 안다 */
  context?: OptimizationContext | null
}) {
  const version = VERSIONS.find((item) => item.variant === side)
  return (
    <div className="version-panel" data-side={side}>
      <div className="version-panel-head">
        <span className="version-panel-label">
          {side === 'before' ? '기준 버전 (Before)' : '비교 버전 (After)'}
        </span>
        <ResultOriginBadge origin={origin} />
      </div>
      <p className="version-panel-name">
        {version ? `${version.name} · ${version.change}` : side}
      </p>
      {context ? (
        <p className="version-panel-optimizer">{optimizerRunText(context)}</p>
      ) : null}
      <dl className="version-panel-meta">
        <dt>Run ID</dt>
        <dd>
          <span className="run-id">{runId}</span>
        </dd>
        <dt>종료 상태</dt>
        <dd className="num">
          {outcome.status} · {outcome.stepCount}단계
        </dd>
      </dl>
    </div>
  )
}

/** 비교 대상. 한 실험의 Before·After Run은 `experimentKey`로 정해져 있어 고르거나 바꾸지 않는다 */
export function ComparisonSetup({
  comparison,
  beforeContext = null,
  afterContext = null,
}: {
  comparison: Comparison
  beforeContext?: OptimizationContext | null
  afterContext?: OptimizationContext | null
}) {
  return (
    <section className="card" aria-label="비교 대상">
      <SectionTitle
        icon={<SettingsIcon />}
        title="비교 대상"
        aside={STATUS_TEXT[comparison.comparisonStatus] ?? comparison.comparisonStatus}
      />
      <div className="version-panels">
        <VersionPanel
          side="before"
          runId={comparison.beforeRunId}
          origin={comparison.beforeResultOrigin}
          outcome={comparison.runComparison.before}
          context={beforeContext}
        />
        <span className="version-vs" aria-hidden="true">
          <ArrowRightIcon size={18} />
        </span>
        <VersionPanel
          side="after"
          runId={comparison.afterRunId}
          origin={comparison.afterResultOrigin}
          outcome={comparison.runComparison.after}
          context={afterContext}
        />
      </div>
    </section>
  )
}

/** 비교 조건이 모두 맞을 때의 한 줄 안내. 어긋나면 `ConditionChecks`가 실패 항목을 보인다 */
export function ConditionBar() {
  return (
    <section className="condition-bar" aria-label="비교 조건 검증">
      <span className="condition-ok">
        <CheckCircleIcon size={16} />
        비교 조건 검증
      </span>
      <span>같은 사이트, 목표, 사용자 유형, 설정으로 실행한 두 Run입니다</span>
    </section>
  )
}

// ---------- 핵심 비교 3개 ----------

function KpiCard({
  label,
  title,
  chip,
  before,
  after,
  note,
}: {
  label: string
  title: string
  /** 서버가 준 증감. 없으면 칩을 만들지 않는다 */
  chip?: string
  before: string
  after: string
  note: string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {chip ? <span className="delta-chip">{chip}</span> : null}
      </div>
      <h3>{title}</h3>
      <dl className="kpi-values">
        <div data-side="before">
          <dt>Before</dt>
          <dd>{before}</dd>
        </div>
        <div data-side="after">
          <dt>After</dt>
          <dd>{after}</dd>
        </div>
      </dl>
      <p className="kpi-note">{note}</p>
    </div>
  )
}

/**
 * 핵심 비교. 값과 증감은 모두 서버가 준 그대로이고 배수·절감률·판정은 만들지 않는다.
 * 목표 경로 확률은 시작 화면(`home`)의 지표만 쓴다. 지표가 없으면 다른 화면 값으로 대신하지 않고 계산 불가로 둔다.
 */
export function KpiCards({ comparison }: { comparison: Comparison }) {
  const { before, after } = comparison.runComparison
  const start = comparison.screenComparisons.find((screen) => screen.pageKey === 'home')
  const goal = start?.metrics?.goalPathProbability
  return (
    <section className="kpi-grid" aria-label="핵심 비교">
      <KpiCard
        label="목표 경로 선택 확률"
        title="시작 화면 후보 확률"
        chip={goal ? formatDelta(goal.delta, 'probability') : undefined}
        before={goal ? formatMetric(goal.before, 'probability') : NULL_TEXT}
        after={goal ? formatMetric(goal.after, 'probability') : NULL_TEXT}
        note="목표 경로로 이어지는 후보의 선택 확률입니다. 모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다"
      />
      <KpiCard
        label="탐색 비용"
        title="이동에 든 비용"
        before={String(before.navigationCost)}
        after={String(after.navigationCost)}
        note="탐색 중 발생한 이동 비용의 합계입니다"
      />
      <KpiCard
        label="목표 도달 · 탐색 단계"
        title="소요 단계"
        before={`${before.goalReached ? '도달' : '미도달'} · ${before.stepCount}단계`}
        after={`${after.goalReached ? '도달' : '미도달'} · ${after.stepCount}단계`}
        note={`성공한 이동 클릭 ${before.successfulNavigationClickCount} → ${after.successfulNavigationClickCount}, 뒤로 가기 ${before.backCount} → ${after.backCount}`}
      />
    </section>
  )
}

// ---------- 탐색 경로 ----------

function PathChain({
  side,
  outcome,
}: {
  side: 'before' | 'after'
  outcome: RunOutcome
}) {
  return (
    <div className="path-panel" data-side={side}>
      <div className="path-panel-head">
        <span className="path-panel-label">{side === 'before' ? 'Before 경로' : 'After 경로'}</span>
        <span className="num muted">총 {outcome.stepCount}단계</span>
      </div>
      {outcome.path.length === 0 ? (
        <p className="muted">탐색 경로 정보가 없습니다</p>
      ) : (
        <ol className="path-chain">
          {outcome.path.map((visit: PathVisit) => (
            <li key={visit.sequence} data-back={visit.enteredBy === 'GO_BACK' ? 'true' : undefined}>
              <span className="path-node">
                {visit.pageKey}
                {visit.enteredBy === 'GO_BACK' ? <small>복귀</small> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function PathComparison({ comparison }: { comparison: Comparison }) {
  return (
    <section className="card" aria-label="탐색 경로 비교">
      <SectionTitle
        icon={<RouteIcon />}
        title="탐색 경로 비교"
        aside="실제로 방문한 화면 순서"
      />
      <div className="path-panels">
        <PathChain side="before" outcome={comparison.runComparison.before} />
        <PathChain side="after" outcome={comparison.runComparison.after} />
      </div>
    </section>
  )
}

// ---------- 검토 항목 ----------

const ISSUE_TYPES: { type: string; label: string }[] = [
  { type: 'CHOICE_AMBIGUITY', label: '선택 모호성' },
  { type: 'REFERENCE_PATH_DEVIATION', label: '기준 경로 이탈' },
  { type: 'REPEATED_VISIT', label: '반복 방문' },
  { type: 'EXTRA_STEPS', label: '추가 단계' },
  { type: 'GOAL_NOT_REACHED', label: '목표 화면 미도달' },
]

function Detected({ yes }: { yes: boolean }) {
  return (
    <span className="detect-badge" data-detected={yes ? 'true' : 'false'}>
      {yes ? '탐지됨' : '탐지되지 않음'}
    </span>
  )
}

/** 검토 항목 비교. 탐지 여부만 보이고 개선·해소 같은 판정은 쓰지 않는다 */
export function IssueComparison({ comparison }: { comparison: Comparison }) {
  const { before, after } = comparison.runComparison
  return (
    <section className="card" aria-label="검토 항목 비교">
      <SectionTitle
        icon={<ListChecksIcon />}
        title="검토 항목 비교"
        aside="AI 탐색 기록 기반의 검토 후보이며 실제 사용자 결함이 아닙니다"
      />
      <div className="comparison-table-scroll">
        <table className="issue-compare">
          <thead>
            <tr>
              <th scope="col">검토 항목</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {ISSUE_TYPES.map(({ type, label }) => (
              <tr key={type}>
                <th scope="row">
                  {label}
                  <code>{type}</code>
                </th>
                <td>
                  <Detected yes={before.detectedIssueTypes.includes(type)} />
                </td>
                <td>
                  <Detected yes={after.detectedIssueTypes.includes(type)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
