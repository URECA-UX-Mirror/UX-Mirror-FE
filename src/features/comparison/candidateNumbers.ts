import type { Candidate, ScreenComparison } from '../../domain/types.ts'

/**
 * 후보 번호 매기기. 비교 표의 행 순서(`candidateComparisons`)를 기준으로 `semanticKey`가 같은 후보는
 * Before·After 어느 화면에서든 같은 번호를 쓴다. 표에 없는 후보는 그 뒤로 이어서 매긴다.
 */
export function candidateNumbers(
  screen: Pick<ScreenComparison, 'candidateComparisons'>,
  candidates: ReadonlyArray<Pick<Candidate, 'semanticKey'>>,
): number[] {
  const known = new Map(
    screen.candidateComparisons.map((item, index) => [item.semanticKey, index + 1]),
  )
  let next = screen.candidateComparisons.length
  return candidates.map((candidate) => known.get(candidate.semanticKey) ?? ++next)
}
