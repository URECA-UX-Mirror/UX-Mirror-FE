interface ResultOriginBadgeProps {
  /** `LIVE`, `MOCK`, `SAVED_MEASURED`(계약 §2.1). 화면에는 코드 대신 문구를 보이고 원문은 `data-origin`에만 둔다 */
  origin: string
}

const ORIGIN_LABELS: Readonly<Record<string, string>> = {
  LIVE: '실제 실행',
  SAVED_MEASURED: '저장된 실측 결과',
  MOCK: '예시 데이터',
}

const originLabel = (origin: string): string =>
  Object.hasOwn(ORIGIN_LABELS, origin) ? ORIGIN_LABELS[origin] : '출처 확인 필요'

export function ResultOriginBadge({ origin }: ResultOriginBadgeProps) {
  return (
    <span className="origin-badge" data-origin={origin}>
      {originLabel(origin)}
    </span>
  )
}
