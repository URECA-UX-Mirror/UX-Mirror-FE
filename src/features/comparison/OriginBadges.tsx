import { ResultOriginBadge } from '../../shared/ResultOriginBadge.tsx'

interface OriginBadgesProps {
  before: string
  after: string
}

/** 두 출처가 같으면 배지 하나, 다르면 Before·After 배지를 모두 보인다 */
export function OriginBadges({ before, after }: OriginBadgesProps) {
  if (before === after) return <ResultOriginBadge origin={before} />
  return (
    <span className="origin-badges">
      <span>Before</span> <ResultOriginBadge origin={before} />{' '}
      <span>After</span> <ResultOriginBadge origin={after} />
    </span>
  )
}
