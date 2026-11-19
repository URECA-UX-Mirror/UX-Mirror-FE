import { useParams } from 'react-router'
import './comparison.css'
import type { Comparison } from '../../domain/types.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { isReplayKey } from '../replay/constants.ts'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { ComparisonError } from './ComparisonError.tsx'
import { ComparisonSummary, PathComparison } from './ComparisonSummary.tsx'
import { ScreenDetails } from './ScreenDetails.tsx'
import { useComparison, useRunMeta } from './useComparisonData.ts'

function ComparisonBody({ comparison }: { comparison: Comparison }) {
  // 고객·할 일·메뉴 이름은 비교 응답에 없어 각 Run에서 읽는다
  const before = useRunMeta(comparison.beforeRunId)
  const after = useRunMeta(comparison.afterRunId)
  const persona = before.persona ?? after.persona
  const goal = before.goal ?? after.goal
  const task = [persona, goal].filter(Boolean).join(' · ')
  const mock =
    !isReplayKey(comparison.experimentKey) &&
    [comparison.beforeResultOrigin, comparison.afterResultOrigin].includes('MOCK')

  return (
    <>
      {task ? <p className="comparison-task">{task}</p> : null}
      {mock ? <p className="muted">예시 데이터로 만든 결과예요</p> : null}
      <ComparisonSummary comparison={comparison} meta={{ before, after }} />
      <PathComparison comparison={comparison} />
      {comparison.conditionsMatched ? <ScreenDetails comparison={comparison} /> : null}
    </>
  )
}

/** 지금 화면 vs 개선안. 서버가 준 결과만 보이고 값을 새로 계산하지 않는다 */
export function ComparisonPage() {
  const { experimentKey = '' } = useParams()
  const { comparison, error, loading, reload } = useComparison(experimentKey)

  return (
    <section className="comparison-page">
      <header className="page-header">
        <h1>{PAGE_NAMES.comparison}</h1>
        {comparison ? (
          <ReplayNotice
            experimentKey={experimentKey}
            origins={[comparison.beforeResultOrigin, comparison.afterResultOrigin]}
          />
        ) : null}
      </header>

      {loading ? <p role="status">불러오는 중이에요</p> : null}
      {error ? <ComparisonError experimentKey={experimentKey} error={error} onRetry={reload} /> : null}
      {comparison ? <ComparisonBody comparison={comparison} /> : null}
    </section>
  )
}
