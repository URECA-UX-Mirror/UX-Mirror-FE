import { screenshotUrl } from '../../api/runs.ts'
import type { ScreenComparison, Step } from '../../domain/types.ts'
import { ScreenshotViewer } from '../../shared/screenshot/ScreenshotViewer.tsx'
import { candidateNumbers } from './candidateNumbers.ts'
import type { RunStepsState } from './useComparisonData.ts'
import { pageName, SIDE_NAMES, type Side } from './labels.ts'

interface ScreenshotPaneProps {
  side: Side
  runId: string
  stepId: number | null
  stepsState: RunStepsState
  screen: Pick<ScreenComparison, 'pageKey' | 'candidateComparisons'>
}

/** 한쪽의 스크린샷과 누를 곳 번호. 박스는 이 Run의 Step에서만 가져온다 */
export function ScreenshotPane({ side, runId, stepId, stepsState, screen }: ScreenshotPaneProps) {
  const title = SIDE_NAMES[side]
  const step: Step | undefined = stepId === null ? undefined : stepsState.steps.get(stepId)
  let body
  if (stepId === null) {
    body = <p className="muted">이 화면에 들르지 않았어요</p>
  } else if (!step) {
    body = (
      <p className="muted" role="status">
        {stepsState.failed
          ? '화면을 불러오지 못했어요'
          : stepsState.loading
            ? '화면을 불러오는 중이에요'
            : '화면이 없어요'}
      </p>
    )
  } else {
    const numbers = candidateNumbers(screen, step.candidates)
    body = (
      <ScreenshotViewer
        src={screenshotUrl(runId, step.stepId)}
        alt={`${title}의 ${pageName(screen.pageKey)} 화면`}
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
      <figcaption className="side-tag" data-side={side}>
        {title}
      </figcaption>
      {body}
    </figure>
  )
}
