import {
  candidateErrorMessage,
} from '../../domain/optimizationErrors.ts'
import type { CandidateEvaluation, CandidateLabel } from '../../domain/types.ts'
import { formatProbability } from '../run-result/format.ts'
import {
  evaluationStatusLabel,
  metricLabel,
  reasonLabel,
  roleLabel,
} from './labels.ts'

export type CardPhase = 'waiting' | 'evaluating' | 'skipped-by-stop'

interface CandidateCardProps {
  candidate: CandidateLabel
  /** 아직 평가가 끝나지 않았으면 `undefined` */
  evaluation: CandidateEvaluation | undefined
  /** 평가가 끝나지 않은 후보가 지금 어떤 상태인지(대기·평가 중·평가 단계가 중단돼 평가하지 못함) */
  pending: CardPhase
  recommended: boolean
  verification: boolean
}

function Metric({
  name,
  value,
  reason,
}: {
  name: string
  value: number | null
  reason: string | undefined
}) {
  return (
    <div>
      <dt>{metricLabel(name)}</dt>
      <dd className="num">
        {value === null ? (
          <>
            계산 불가{reason ? <span className="muted"> · {reasonText(reason)}</span> : null}
          </>
        ) : (
          formatProbability(value)
        )}
      </dd>
    </div>
  )
}

function reasonText(code: string) {
  const label = reasonLabel(code)
  return label ? `${label} (${code})` : code
}

/** 평가 상태에 따라 본문을 정한다. `null` 지표는 0이 아니라 "계산 불가"와 사유로 보인다 */
function Body({ evaluation }: { evaluation: CandidateEvaluation }) {
  if (evaluation.evaluationStatus === 'COMPLETED') {
    return (
      <dl className="candidate-metrics">
        <Metric
          name="targetOptionProbability"
          value={evaluation.targetOptionProbability}
          reason={evaluation.metricNullReasons.targetOptionProbability}
        />
        <Metric
          name="goalPathProbability"
          value={evaluation.goalPathProbability}
          reason={evaluation.metricNullReasons.goalPathProbability}
        />
      </dl>
    )
  }
  const invalid = evaluation.invalidReasons
  const baselineSkipped =
    evaluation.role === 'BASELINE' && evaluation.candidateValidity === 'INVALID_CANDIDATE'
  return (
    <div className="candidate-reason">
      {baselineSkipped ? (
        <p>기준 화면이 평가 설정과 달라 모델 평가를 하지 않았습니다.</p>
      ) : evaluation.error ? (
        <p>{candidateErrorMessage(evaluation.error.code, evaluation.error.message)}</p>
      ) : evaluation.evaluationStatus === 'SKIPPED' ? (
        <p>이 후보는 평가에서 제외되었습니다.</p>
      ) : null}
      {evaluation.error ? (
        <p className="muted">
          오류 코드 <code>{evaluation.error.code}</code>
        </p>
      ) : null}
      {invalid.length > 0 ? (
        <ul className="reason-list" aria-label="무효 사유">
          {invalid.map((code) => (
            <li key={code}>{reasonText(code)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const PENDING_LABELS: Record<CardPhase, string> = {
  waiting: '평가 대기',
  evaluating: '평가 중',
  'skipped-by-stop': '평가하지 못함',
}

export function CandidateCard({
  candidate,
  evaluation,
  pending,
  recommended,
  verification,
}: CandidateCardProps) {
  const statusText = evaluation?.evaluationStatus
    ? evaluationStatusLabel(evaluation.evaluationStatus)
    : PENDING_LABELS[pending]
  return (
    <li
      className="candidate-card"
      data-status={evaluation?.evaluationStatus ?? pending}
      data-candidate={candidate.candidateId}
    >
      <div className="candidate-card-head">
        <span className="badge-mono">{candidate.candidateId}</span>
        <strong>{candidate.label}</strong>
        <span className="candidate-role" data-role={candidate.role}>
          {roleLabel(candidate.role)}
        </span>
        <span className="candidate-status">{statusText}</span>
      </div>
      {recommended || verification ? (
        <p className="candidate-marks">
          {recommended ? <span className="candidate-mark">추천 후보</span> : null}
          {verification ? <span className="candidate-mark">검증 후보</span> : null}
        </p>
      ) : null}
      {evaluation ? <Body evaluation={evaluation} /> : null}
    </li>
  )
}
