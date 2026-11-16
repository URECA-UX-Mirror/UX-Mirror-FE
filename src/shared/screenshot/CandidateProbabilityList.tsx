import type { Candidate, StepDecision } from '../../domain/types.ts'
import { formatPercent } from './boxStyle.ts'

interface CandidateProbabilityListProps {
  candidates: ReadonlyArray<
    Pick<Candidate, 'optionId' | 'label' | 'probability' | 'selected'>
  >
  decision: Pick<StepDecision, 'selectedActionType' | 'goBackProbability'>
}

/**
 * 후보별 선택 확률 목록. `selected`를 강조하고 GO_BACK 확률은 목록에만 보인다.
 * 반올림한 백분율의 합이 100이 아닐 수 있으므로 합계를 표시하거나 100%라고 단정하지 않는다.
 */
export function CandidateProbabilityList({
  candidates,
  decision,
}: CandidateProbabilityListProps) {
  const wentBack = decision.selectedActionType === 'GO_BACK'
  return (
    <div className="candidate-probabilities">
      {wentBack ? <p className="go-back-notice">이전 화면 복귀 선택</p> : null}
      <ul>
        {candidates.map((candidate) => (
          <li
            key={candidate.optionId}
            className={candidate.selected ? 'candidate-selected' : undefined}
          >
            <span>{candidate.label}</span>
            <span>{formatPercent(candidate.probability)}</span>
          </li>
        ))}
        {/* `null`이면 GO_BACK이 선택지에 없었던 것이라 행을 만들지 않는다 */}
        {decision.goBackProbability === null ? null : (
          <li className={wentBack ? 'candidate-selected' : undefined}>
            <span>이전 화면으로 돌아가기</span>
            <span>{formatPercent(decision.goBackProbability)}</span>
          </li>
        )}
      </ul>
      <p className="probability-note">
        모델의 선택 확률이며 실제 사용자의 클릭 확률이 아니다
      </p>
    </div>
  )
}
