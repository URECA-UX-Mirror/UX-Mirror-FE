import { Link } from 'react-router'
import type { ImprovementReport, ImprovementVerification } from '../../domain/improvement.ts'
import { formatScoreDelta } from '../../domain/improvementScore.ts'
import { FINAL_IMPROVEMENT_ID, finalImprovementPath } from '../improvement/constants.ts'
import { useImprovement } from '../improvement/useImprovement.ts'
import { comparablePair } from '../improvement/verificationLinks.ts'

const NAME = '에이전트 최종안'

/**
 * "새 UX 분석" 버전 표의 변경 후 행. 자동 개선 최종 결과(`FINAL_IMPROVEMENT_ID`)에서 이름·점수 변화를 읽고,
 * 저장된 비교 화면으로 연결한다. 최종안 Run은 백엔드가 만들어 두므로 이 행은 Run을 시작하지 않는다.
 */
export function FinalVariantRow() {
  return FINAL_IMPROVEMENT_ID ? <LoadedRow id={FINAL_IMPROVEMENT_ID} /> : <MessageRow message="자동 개선 결과가 아직 없습니다." />
}

function MessageRow({ message }: { message: string }) {
  return (
    <tr data-variant="after">
      <th scope="row"><span className="version-dot" data-variant="after" />{NAME}</th>
      <td colSpan={6} className="muted">{message}</td>
    </tr>
  )
}

function LoadedRow({ id }: { id: string }) {
  const state = useImprovement(id)
  if (state.phase === 'loading') return <MessageRow message="자동 개선 결과 조회 중" />
  if (state.phase !== 'success') return <MessageRow message="자동 개선 결과를 불러오지 못했습니다." />
  const { report, verification } = state.view
  if (!report.ok) return <MessageRow message="자동 개선 결과를 읽을 수 없습니다." />
  return <ResultRow id={id} report={report.data} verification={verification.ok ? verification.data : null} />
}

function ResultRow({ id, report, verification }: { id: string; report: ImprovementReport; verification: ImprovementVerification | null }) {
  const improved = report.result === 'IMPROVED' && report.afterLabel !== null
  const lines = [report.main, ...report.guards]
  const reportPath = finalImprovementPath(id)
  const pairs = verification?.status === 'COMPLETED' ? verification.pairs.filter(comparablePair) : []
  return (
    <tr data-variant="after">
      <th scope="row"><span className="version-dot" data-variant="after" />{NAME}</th>
      <td>
        {improved
          ? <span className="change-chip" data-variant="after">상단 메뉴: {report.beforeLabel} → {report.afterLabel}</span>
          : <span className="muted">개선안 없음</span>}
      </td>
      <td colSpan={4}>
        {improved ? (
          <ul className="final-scores" aria-label="목표별 점수 변화">
            {lines.map((line, index) => (
              <li key={line.goalKey ?? line.name ?? index}>{line.name ?? line.goalKey ?? '목표'} {formatScoreDelta(line.delta)}</li>
            ))}
          </ul>
        ) : <span className="muted">채택한 개선안이 없어 비교할 최종안이 없습니다.</span>}
        {improved ? (
          <small className="cell-note">
            Run은 자동 개선 실행이 만든 저장 결과이며, {pairs.length ? `${pairs.map((pair) => pair.name ?? pair.goalKey ?? '목표').join('·')} 목표만 ` : '고정 목표만 '}비교할 수 있습니다. 직접 입력한 목표에는 최종안 비교가 없습니다.
          </small>
        ) : null}
      </td>
      <td className="col-action">
        {reportPath ? <Link to={reportPath}>자동 개선 리포트</Link> : null}
        {pairs.map((pair) => (
          <Link key={pair.experimentKey ?? pair.comparisonPath} to={pair.comparisonPath!}>
            {pair.name ?? pair.goalKey ?? '목표'} 비교 보기
          </Link>
        ))}
      </td>
    </tr>
  )
}
