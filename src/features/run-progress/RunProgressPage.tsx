import { useParams } from 'react-router'

// placeholder. 구현은 화면 ② 이슈에서 한다(docs/architecture/frontend-structure.md).
export function RunProgressPage() {
  const { runId } = useParams()
  return (
    <section>
      <h1>AI 탐색 진행</h1>
      <p>runId: {runId}</p>
      <p>구현 예정</p>
    </section>
  )
}
