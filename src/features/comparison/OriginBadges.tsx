import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'
import { SIDE_NAMES } from './labels.ts'

interface OriginBadgesProps {
  before: string
  after: string
}

/** 두 출처가 같으면 배지 하나, 다르면 지금 화면·개선안 배지를 모두 보인다 */
export function OriginBadges({ before, after }: OriginBadgesProps) {
  if (before === after) return <ResultOriginBadge origin={before} />
  return (
    <span className="origin-badges">
      <span>{SIDE_NAMES.before}</span> <ResultOriginBadge origin={before} />{' '}
      <span>{SIDE_NAMES.after}</span> <ResultOriginBadge origin={after} />
    </span>
  )
}
