import { useState } from 'react'
import { useParams } from 'react-router'
import './comparison.css'
import type { Comparison } from '../../domain/types.ts'
import { ComparisonError } from './ComparisonError.tsx'
import { ReplayNotice } from '../replay/ReplayNotice.tsx'
import { ConditionChecks } from './ConditionChecks.tsx'
import {
  ComparisonSetup,
  ConditionBar,
  IssueComparison,
  KpiCards,
  PathComparison,
} from './ComparisonSections.tsx'
import { OriginBadges } from './OriginBadges.tsx'
import { RunComparison } from './RunComparison.tsx'
import { ScreenComparisonCard } from './ScreenComparisonCard.tsx'
import { SingleScreenView } from './SingleScreenView.tsx'
import { useComparison, useRunBasis, useRunSteps } from './useComparisonData.ts'

function ComparisonBody({ comparison }: { comparison: Comparison }) {
  // 후보 박스는 비교 응답에 없으므로 각 Run의 Step에서 가져온다. Run마다 따로 조회한다.
  const beforeSteps = useRunSteps(comparison.beforeRunId)
  const afterSteps = useRunSteps(comparison.afterRunId)
  const beforeBasis = useRunBasis(comparison.beforeRunId)
  const afterBasis = useRunBasis(comparison.afterRunId)
  // 보기 방식은 화면 상태다. 기본은 한눈에 보기
  const [view, setView] = useState<'overview' | 'single'>('overview')

  return (
    <>
      <ComparisonSetup comparison={comparison} />

      {comparison.conditionsMatched ? (
        <ConditionBar />
      ) : (
        <ConditionChecks checks={comparison.conditionChecks} />
      )}

      <KpiCards comparison={comparison} />

      <section className="comparison-screens">
        <div className="comparison-screens-head">
          <h2>화면별 비교</h2>
          {comparison.screenComparisons.length === 0 ? null : (
            <div className="segmented" role="group" aria-label="보기 방식">
              <button
                type="button"
                aria-pressed={view === 'overview'}
                onClick={() => setView('overview')}
              >
                한눈에 보기
              </button>
              <button
                type="button"
                aria-pressed={view === 'single'}
                onClick={() => setView('single')}
              >
                하나씩 보기
              </button>
            </div>
          )}
        </div>
        {comparison.screenComparisons.length === 0 ? (
          <p className="muted">비교할 화면이 없습니다</p>
        ) : view === 'single' ? (
          <SingleScreenView
            screens={comparison.screenComparisons}
            beforeRunId={comparison.beforeRunId}
            afterRunId={comparison.afterRunId}
            beforeSteps={beforeSteps}
            afterSteps={afterSteps}
          />
        ) : (
          comparison.screenComparisons.map((screen) => (
            <ScreenComparisonCard
              key={screen.pageKey}
              screen={screen}
              beforeRunId={comparison.beforeRunId}
              afterRunId={comparison.afterRunId}
              beforeSteps={beforeSteps}
              afterSteps={afterSteps}
              beforeBasis={beforeBasis}
              afterBasis={afterBasis}
            />
          ))
        )}
      </section>

      <PathComparison comparison={comparison} />
      <IssueComparison comparison={comparison} />

      <RunComparison
        before={comparison.runComparison.before}
        after={comparison.runComparison.after}
        beforeBasis={beforeBasis}
        afterBasis={afterBasis}
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
      <header className="page-header">
        <div className="page-title-row">
          <h1>버전 비교</h1>
          {comparison ? (
            <OriginBadges
              before={comparison.beforeResultOrigin}
              after={comparison.afterResultOrigin}
            />
          ) : null}
          {comparison ? (
            <ReplayNotice
              experimentKey={experimentKey}
              origins={[comparison.beforeResultOrigin, comparison.afterResultOrigin]}
            />
          ) : null}
        </div>
        <p className="page-lead">두 버전의 AI 탐색 결과와 검토 항목을 비교합니다.</p>
        <p className="page-lead">
          <span className="mono">experimentKey: {experimentKey}</span>
        </p>
      </header>

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
