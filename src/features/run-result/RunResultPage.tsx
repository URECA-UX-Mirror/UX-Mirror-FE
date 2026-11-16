import { useParams } from 'react-router'

// placeholder. 구현은 화면 ③ 이슈에서 한다(docs/architecture/frontend-structure.md).
export function RunResultPage() {
  const { runId } = useParams()
  return (
    <section>
      <h1>UX 탐색 분석 결과</h1>
      <p>runId: {runId}</p>
      <p>구현 예정</p>
    </section>
  )
}
