import type { Step } from '../domain/types.ts'
import { selectedLabel } from './stepLabel.ts'

/** 그 Step에서 모델이 고른 행동(종류와 후보 이름). 진행·결과 화면이 같이 쓴다 */
export function SelectedAction({ step }: { step: Step }) {
  return (
    <div className="action-block">
      <span className="action-block-label">선택된 행동</span>
      <p>
        <span className="action-type" data-type={step.decision.selectedActionType}>
          {step.decision.selectedActionType}
        </span>
        <span className="action-name">{selectedLabel(step)}</span>
      </p>
    </div>
  )
}
