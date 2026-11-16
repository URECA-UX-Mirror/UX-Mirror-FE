import { useParams } from 'react-router'

// placeholder. 구현은 화면 ④ 이슈에서 한다(docs/architecture/frontend-structure.md).
export function ComparisonPage() {
  const { experimentKey } = useParams()
  return (
    <section>
      <h1>버전 비교</h1>
      <p>experimentKey: {experimentKey}</p>
      <p>구현 예정</p>
    </section>
  )
}
