import { Link } from 'react-router'
import type { OptimizationContext } from '../domain/types.ts'
import { optimizerRunText } from './optimizerRun.ts'
import { PAGE_NAMES } from './pageNames.ts'

/** Run이 속한 Optimization으로 가는 링크가 붙은 표시. `variant`는 호출하는 쪽이 함께 보인다 */
export function OptimizerRunTag({ context }: { context: OptimizationContext }) {
  return (
    <span className="optimizer-run-tag" data-role={context.executionRole}>
      {optimizerRunText(context)}{' '}
      <Link to={`/optimizations/${encodeURIComponent(context.optimizationId)}`}>
        {PAGE_NAMES.optimizerDetail} 보기
      </Link>
    </span>
  )
}
