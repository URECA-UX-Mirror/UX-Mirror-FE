import { useParams } from 'react-router'
import './comparison.css'
import type { Comparison } from '../../domain/types.ts'
import { ComparisonError } from './ComparisonError.tsx'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { ConditionChecks } from './ConditionChecks.tsx'
import { OriginBadges } from './OriginBadges.tsx'
import { RunComparison } from './RunComparison.tsx'
import { ScreenComparisonCard } from './ScreenComparisonCard.tsx'
import { useComparison, useRunSteps } from './useComparisonData.ts'

const STATUS_TEXT: Record<string, string> = {
  COMPLETED: '모든 화면을 비교했습니다',
  PARTIAL: '비교할 수 있는 부분만 표시합니다',
}

function ComparisonBody({ comparison }: { comparison: Comparison }) {
  // 후보 박스는 비교 응답에 없으므로 각 Run의 Step에서 가져온다. Run마다 따로 조회한다.
  const beforeSteps = useRunSteps(comparison.beforeRunId)
  const afterSteps = useRunSteps(comparison.afterRunId)

  return (
    <>
      <p>
        {STATUS_TEXT[comparison.comparisonStatus] ?? comparison.comparisonStatus}
        <span className="muted">
          {' '}
          · Before {comparison.beforeRunId} · After {comparison.afterRunId}
        </span>
      </p>

      {comparison.conditionsMatched ? null : (
        <ConditionChecks checks={comparison.conditionChecks} />
      )}

      <section className="comparison-screens">
        <h2>화면별 비교</h2>
        {comparison.screenComparisons.length === 0 ? (
          <p className="muted">비교할 화면이 없습니다</p>
        ) : (
          comparison.screenComparisons.map((screen) => (
            <ScreenComparisonCard
              key={screen.pageKey}
              screen={screen}
              beforeRunId={comparison.beforeRunId}
              afterRunId={comparison.afterRunId}
              beforeSteps={beforeSteps}
              afterSteps={afterSteps}
            />
          ))
        )}
      </section>

      <RunComparison
        before={comparison.runComparison.before}
        after={comparison.runComparison.after}
      />
    </>
  )
}

/** ④ 버전 비교. 서버가 준 before/after 값과 증감만 표시하고 비교 계산이나 판정은 하지 않는다. */
export function ComparisonPage() {
  const { experimentKey = '' } = useParams()
  const { comparison, error, loading, reload } = useComparison(experimentKey)

  return (
    <section className="comparison-page">
      <header className="comparison-header">
        <h1>버전 비교</h1>
        {comparison ? (
          <OriginBadges
            before={comparison.beforeResultOrigin}
            after={comparison.afterResultOrigin}
          />
        ) : null}
      </header>
      {comparison ? (
        <ReplayNotice
          experimentKey={experimentKey}
          origins={[comparison.beforeResultOrigin, comparison.afterResultOrigin]}
        />
      ) : null}
      <p className="muted">experimentKey: {experimentKey}</p>

      {loading ? <p role="status">비교 결과를 불러오는 중</p> : null}
      {error ? (
        <ComparisonError
          experimentKey={experimentKey}
          error={error}
          onRetry={reload}
        />
      ) : null}
      {comparison ? <ComparisonBody comparison={comparison} /> : null}
    </section>
  )
}
