import { screenshotUrl } from '../../api/runs.ts'
import type { ScreenComparison, Step } from '../../domain/types.ts'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { candidateNumbers } from './candidateNumbers.ts'
import type { RunStepsState } from './useComparisonData.ts'
import { SIDE_NAMES } from './labels.ts'

interface ScreenshotPaneProps {
  side: 'before' | 'after'
  runId: string
  stepId: number | null
  stepsState: RunStepsState
  screen: Pick<ScreenComparison, 'candidateComparisons'>
}

/** 한 버전의 스크린샷과 후보 박스. 박스는 이 Run의 Step에서만 가져온다 */
export function ScreenshotPane({
  side,
  runId,
  stepId,
  stepsState,
  screen,
}: ScreenshotPaneProps) {
  const title = SIDE_NAMES[side]
  const step: Step | undefined =
    stepId === null ? undefined : stepsState.steps.get(stepId)
  let body
  if (stepId === null) {
    body = <p className="muted">이 버전에서 방문하지 않아 화면이 없습니다</p>
  } else if (!step) {
    body = (
      <p className="muted" role="status">
        {stepsState.failed
          ? '화면 정보를 불러오지 못했습니다'
          : stepsState.loading
            ? '화면 준비 중'
            : '화면 없음'}
      </p>
    )
  } else {
    const numbers = candidateNumbers(screen, step.candidates)
    body = (
      <ScreenshotViewer
        src={screenshotUrl(runId, step.stepId)}
        alt={`${title} 화면 (${step.stepId}번째 클릭)`}
        viewport={step.page.viewport}
        screenshotSize={step.page.screenshotSize}
        scroll={step.page.scroll}
        boxes={step.candidates.map((candidate, index) => ({
          id: candidate.optionId,
          bbox: candidate.bbox,
          label: candidate.label,
          tag: numbers[index],
          highlighted: candidate.selected,
        }))}
        runInProgress={false}
      />
    )
  }
  return (
    <figure className="comparison-pane" data-side={side}>
      <figcaption className="browser-bar">
        <span className="browser-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-url mono">{step?.page.path ?? '-'}</span>
        <span className="browser-tag">{title}</span>
      </figcaption>
      {body}
    </figure>
  )
}
