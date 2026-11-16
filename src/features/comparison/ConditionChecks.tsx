import type { ConditionCheck } from '../../domain/types.ts'

interface ConditionChecksProps {
  checks: ConditionCheck[]
}

/**
 * 비교 조건이 맞지 않을 때 실패한 항목을 서버 순서대로 보인다.
 * `code` 값으로 판정하지 않고 서버의 `matched`만 쓴다.
 */
export function ConditionChecks({ checks }: ConditionChecksProps) {
  const failed = checks.filter((check) => !check.matched)
  return (
    <section className="comparison-conditions" role="alert">
      <h2>비교 조건이 일치하지 않습니다</h2>
      <p>
        모든 화면을 비교할 수 없습니다. 아래 Run 단위 결과는 그대로 표시합니다.
      </p>
      <ul>
        {failed.map((check) => (
          <li key={check.code}>
            <code>{check.code}</code>
            {check.message ? <span> — {check.message}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
