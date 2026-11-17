import { useState } from 'react'
import type { ScreenComparison } from '../../domain/types.ts'
import { CandidateProbabilityList } from '../../shared/screenshot/CandidateProbabilityList.tsx'
import { candidateNumbers } from './candidateNumbers.ts'
import { ScreenshotPane } from './ScreenshotPane.tsx'
import type { RunStepsState } from './useComparisonData.ts'

type Side = 'before' | 'after'

interface SingleScreenViewProps {
  screens: ScreenComparison[]
  beforeRunId: string
  afterRunId: string
  beforeSteps: RunStepsState
  afterSteps: RunStepsState
}

/**
 * 하나씩 보기. 화면(pageKey)과 버전(Before·After)을 고르면 그 화면을 크게 한 장 보이고,
 * 오른쪽에 같은 Step의 후보 확률 게이지를 둔다. 후보 번호는 한눈에 보기와 같다.
 * 선택한 화면·버전은 화면 상태다.
 */
export function SingleScreenView({
  screens,
  beforeRunId,
  afterRunId,
  beforeSteps,
  afterSteps,
}: SingleScreenViewProps) {
  const [pageKey, setPageKey] = useState<string | null>(null)
  const [side, setSide] = useState<Side>('before')

  if (screens.length === 0) return null
  const screen = screens.find((item) => item.pageKey === pageKey) ?? screens[0]
  const runId = side === 'before' ? beforeRunId : afterRunId
  const stepId = side === 'before' ? screen.beforeStepId : screen.afterStepId
  const stepsState = side === 'before' ? beforeSteps : afterSteps
  const step = stepId === null ? undefined : stepsState.steps.get(stepId)
  const title = side === 'before' ? 'Before' : 'After'

  return (
    <div className="comparison-single">
      <div className="single-controls">
        <div className="segmented" role="group" aria-label="화면 선택">
          {screens.map((item) => (
            <button
              key={item.pageKey}
              type="button"
              aria-pressed={item.pageKey === screen.pageKey}
              onClick={() => setPageKey(item.pageKey)}
            >
              {item.pageKey}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="버전 선택">
          <button
            type="button"
            aria-pressed={side === 'before'}
            onClick={() => setSide('before')}
          >
            Before
          </button>
          <button
            type="button"
            aria-pressed={side === 'after'}
            onClick={() => setSide('after')}
          >
            After
          </button>
        </div>
      </div>
      <div className="single-body">
        <ScreenshotPane
          title={title}
          runId={runId}
          stepId={stepId}
          stepsState={stepsState}
          screen={screen}
        />
        {step ? (
          <CandidateProbabilityList
            candidates={step.candidates}
            decision={step.decision}
            numberOf={(index) => candidateNumbers(screen, step.candidates)[index]}
          />
        ) : null}
      </div>
    </div>
  )
}
