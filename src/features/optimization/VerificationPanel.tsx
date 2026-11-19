import { Link } from 'react-router'
import type { Optimization } from '../../domain/types.ts'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { RouteIcon } from '../../shared/icons.tsx'
import { verificationPhaseLabel } from './labels.ts'
import { isVerificationFailure } from './verification.ts'

/** 이 코드들은 Run을 만들기 전에 사이트를 다시 확인하다 실패한 것이라 검증 Run이 없다 */
const NO_RUN_CODES: ReadonlySet<string> = new Set(['SITE_INSTANCE_CHANGED', 'SITE_RECHECK_FAILED'])

function RunLink({ label, runId }: { label: string; runId: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {runId ? (
          <Link to={`/runs/${encodeURIComponent(runId)}`}>
            <span className="run-id">{runId}</span>
          </Link>
        ) : (
          '아직 만들어지지 않음'
        )}
      </dd>
    </div>
  )
}

/**
 * 검증 진행과 검증 단계 실패. 기준 Run → 후보 Run 순으로 만들어지므로 Run ID는 아직 `null`일 수 있다.
 * 모르는 `verificationPhase`는 원문을 그대로 보이고 오류로 만들지 않는다.
 * `FAILED`의 원인 문구는 `FailureNotice`가 보이고, 여기서는 검증 Run이 만들어졌는지만 알린다.
 */
export function VerificationPanel({ optimization }: { optimization: Optimization }) {
  const failed = isVerificationFailure(optimization)
  if (optimization.status !== 'VERIFYING' && optimization.status !== 'COMPLETED' && !failed) {
    return null
  }
  const { baselineRunId, validationRunId } = optimization
  const code = optimization.error?.code ?? null
  return (
    <section className="card" aria-label="검증 진행">
      <SectionTitle icon={<RouteIcon />} title="후보 검증" />
      {optimization.status === 'VERIFYING' ? (
        <p>
          지금 {optimization.verificationPhase ? verificationPhaseLabel(optimization.verificationPhase) : '사이트 확인'}을 진행 중입니다.
        </p>
      ) : null}
      <dl className="meta-row">
        <RunLink label="기준 실행 (C0)" runId={baselineRunId} />
        <RunLink label="후보 실행" runId={validationRunId} />
      </dl>
      {failed && baselineRunId === null && validationRunId === null ? (
        <p className="muted">
          {code !== null && NO_RUN_CODES.has(code)
            ? '검증 전에 멈춰 검증 Run이 만들어지지 않았습니다.'
            : '검증 Run이 만들어지기 전에 멈췄습니다.'}
        </p>
      ) : null}
    </section>
  )
}
