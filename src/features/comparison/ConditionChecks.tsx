import type { ConditionCheck } from '../../domain/types.ts'
import { hasHangul } from '../../shared/hangul.ts'
import { conditionLabel } from './labels.ts'

interface ConditionChecksProps {
  checks: ConditionCheck[]
}

/**
 * 비교 조건이 맞지 않을 때 실패한 항목을 서버 순서대로 보인다.
 * `code` 값으로 판정하지 않고 서버의 `matched`만 쓴다. 화면에는 코드 대신 항목 이름을, 서버 문구는 한국어일 때만 보인다.
 */
export function ConditionChecks({ checks }: ConditionChecksProps) {
  const failed = checks.filter((check) => !check.matched)
  return (
    <section className="comparison-conditions" role="alert">
      <h2>비교 조건이 일치하지 않습니다</h2>
      <p>
        모든 화면을 비교할 수 없습니다. 아래 진단 전체 비교는 그대로 표시합니다.
      </p>
      <ul>
        {failed.map((check) => (
          <li key={check.code}>
            {conditionLabel(check.code)}
            {hasHangul(check.message) ? <span> — {check.message}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
