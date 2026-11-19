import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { isAbortError } from '../../api/client.ts'
import { listImprovements, type ImprovementListItemDto } from '../../api/improvements.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { goalPageName, quote, shortTime } from './labels.ts'
import './improvement.css'

/** 지난 AI 개선 결과. AI 개선은 진단 결과의 "AI에게 고쳐 달라고 하기"로만 시작한다 */
export function ImprovementListPage() {
  const [items, setItems] = useState<ImprovementListItemDto[] | null>(null)
  const [listFailed, setListFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listImprovements(controller.signal).then(setItems).catch((error: unknown) => {
      if (!isAbortError(error)) setListFailed(true)
    })
    return () => controller.abort()
  }, [])

  return (
    <section className="improvement-page">
      <header className="page-header">
        <h1>{PAGE_NAMES.improvement}</h1>
      </header>

      <section className="card imp-card" aria-label="지난 결과">
        {listFailed ? <p role="alert">지난 결과를 불러오지 못했어요.</p> : items === null ? <p role="status">불러오는 중이에요</p> : items.length === 0 ? (
          <div className="imp-empty">
            <p>아직 AI 개선 결과가 없어요. 진단 결과에서 'AI에게 고쳐 달라고 하기'로 시작할 수 있어요.</p>
            <Link to="/" className="primary-link">진단하러 가기</Link>
          </div>
        ) : (
          <ul className="imp-history">
            {items.map((item) => (
              <li key={item.improvementId}>
                <Link to={`/improvements/${encodeURIComponent(item.improvementId)}`}>{itemTitle(item)}</Link>
                <span className="muted"> · {[statusText(item), shortTime(item.createdAt)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function itemTitle(item: ImprovementListItemDto): string {
  const s = item.summary
  if (s?.afterLabel) return `${quote(s.beforeLabel ?? '')} → ${quote(s.afterLabel)}`
  if (item.input) return `${item.input.persona} · ${goalPageName(item.input.goalPage)}`
  return s?.beforeLabel ? quote(s.beforeLabel) : 'AI 개선'
}

function statusText(item: ImprovementListItemDto): string | null {
  switch (item.status) {
    case 'QUEUED':
    case 'RUNNING': return '진행 중'
    // 새 이름은 제목에 이미 보인다
    case 'COMPLETED': return item.summary?.afterLabel ? null : '바꿀 이름 없음'
    case 'FAILED': return '끝내지 못함'
    case 'INTERRUPTED': return '중간에 멈춤'
    default: return '확인 필요'
  }
}
