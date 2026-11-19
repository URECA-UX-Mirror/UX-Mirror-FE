import type { ImprovementCandidate, ImprovementView } from '../../domain/improvement.ts'
import { formatScore } from '../../domain/improvementScore.ts'
import { eulOf, quote } from './labels.ts'
import { shortReason } from './reasons.ts'

type Row = { label: string; score: ImprovementCandidate['mainScore']; adopted: boolean; reason: string | null }

/**
 * 접힌 "어떻게 골랐는지 보기"의 내용. 회차·점수 계산 표 대신 세 줄로 줄였다(#103):
 * 몇 개를 시험해 무엇을 골랐는지 → 나머지를 왜 뺐는지 → 이름별 찾아올 가능성과 결과.
 */
export function ChoiceSummary({ view, goalNames }: { view: ImprovementView; goalNames: Record<string, string> }) {
  const rounds = view.rounds.ok ? view.rounds.data : []
  // 여러 회차에 걸쳐 고쳐 나가면 마지막에 고른 이름만 최종으로 본다. 앞서 골랐다가 바뀐 이름은 "더 나은 이름이 있어요"
  const finalRound = [...rounds].reverse().find((r) => r.adopted !== null)
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const round of rounds) {
    for (const c of round.candidates) {
      if (seen.has(c.label)) continue
      seen.add(c.label)
      const picked = c.candidateId === round.adopted
      const final = picked && round === finalRound
      rows.push({ label: c.label, score: c.mainScore, adopted: final, reason: picked && !final ? 'NOT_BEST' : c.reason })
    }
  }
  if (!rows.length) return null
  // 고른 이름 먼저, 나머지는 찾아올 가능성 높은 순
  rows.sort((a, b) => Number(b.adopted) - Number(a.adopted) || (b.score ?? -1) - (a.score ?? -1))

  const adopted = rows.find((r) => r.adopted)
  const start = rounds[0]?.baseline
  const dropped = rows.filter((r) => !r.adopted)
  const reasons = new Map<string, number>()
  for (const r of dropped) {
    const text = r.reason ? shortReason(r.reason, goalNames) : '안 골랐어요'
    reasons.set(text, (reasons.get(text) ?? 0) + 1)
  }
  const [topReason, topCount] = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0] ?? []

  return (
    <div className="imp-choice">
      <p>
        이름 {rows.length}개를 시험해서{' '}
        {adopted ? <><strong>{quote(adopted.label)}</strong>{eulOf(adopted.label)} 골랐어요.</> : '고를 이름을 찾지 못했어요.'}
      </p>
      {topReason ? (
        <p className="muted">
          {topCount === dropped.length ? '나머지는 모두' : '나머지는 대부분'} {topReason.replace(/요$/, '서')} 뺐어요.
        </p>
      ) : null}
      <ul className="imp-choice-list">
        {start?.label ? (
          <li data-start>
            <span>{quote(start.label)} <span className="muted">(지금)</span></span>
            <span className="imp-num">{formatScore(start.mainScore)}</span>
            <span className="muted">—</span>
          </li>
        ) : null}
        {rows.map((r) => (
          <li key={r.label} data-adopted={r.adopted}>
            <span>{quote(r.label)}</span>
            <span className="imp-num">{r.score === null ? '—' : formatScore(r.score)}</span>
            <span className={r.adopted ? 'imp-pick' : 'muted'}>{r.adopted ? '✓ 골랐어요' : r.reason ? shortReason(r.reason, goalNames) : '안 골랐어요'}</span>
          </li>
        ))}
      </ul>
      <p className="muted">숫자는 원하는 화면을 찾아올 가능성이에요.</p>
    </div>
  )
}
