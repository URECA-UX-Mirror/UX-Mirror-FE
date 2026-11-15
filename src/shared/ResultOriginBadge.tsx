interface ResultOriginBadgeProps {
  /** `LIVE`, `MOCK`, `SAVED_MEASURED`. 서버 값을 그대로 표시한다(계약 §2.1) */
  origin: string
}

export function ResultOriginBadge({ origin }: ResultOriginBadgeProps) {
  return (
    <span className="origin-badge" data-origin={origin}>
      {origin}
    </span>
  )
}
