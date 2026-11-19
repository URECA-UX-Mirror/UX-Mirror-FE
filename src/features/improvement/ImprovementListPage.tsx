import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { isAbortError } from '../../api/client.ts'
import { listImprovements, type ImprovementListItemDto } from '../../api/improvements.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { goalPageName, quote, shortTime } from './labels.ts'
import './improvement.css'

/** AI에게 받은 개선안. 메뉴에는 없고 주소로만 연다. 새 개선안은 진단 화면에서만 받는다 */
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
    <section className="report-page">
      <header className="report-head">
        <h1>{PAGE_NAMES.improvementList}</h1>
      </header>

      <section aria-label="지난 결과">
        {listFailed ? <p role="alert">지난 결과를 불러오지 못했어요.</p> : items === null ? <p role="status">불러오는 중이에요</p> : items.length === 0 ? (
          <div className="imp-empty">
            <p>아직 받은 개선안이 없어요.</p>
            <Link to="/">새 진단 하러 가기</Link>
          </div>
        ) : (
          <ul className="imp-history">
            {items.map((item) => (
              <li key={item.improvementId}>
                <Link to={itemLink(item)}>{itemTitle(item)}</Link>
                <span className="muted"> · {[statusText(item), shortTime(item.createdAt)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

/** 진단에서 시작한 결과는 그 진단 화면에 있다 */
const itemLink = (item: ImprovementListItemDto) =>
  item.input?.sourceRunId
    ? `/runs/${encodeURIComponent(item.input.sourceRunId)}`
    : `/improvements/${encodeURIComponent(item.improvementId)}`

function itemTitle(item: ImprovementListItemDto): string {
  const s = item.summary
  if (s?.afterLabel) return `${quote(s.beforeLabel ?? '')} → ${quote(s.afterLabel)}`
  if (item.input) return `${item.input.goal} · ${goalPageName(item.input.goalPage)}`
  return s?.beforeLabel ? quote(s.beforeLabel) : '개선안'
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
