import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isAbortError } from '../../api/client.ts'
import { listImprovements, startImprovement, type ImprovementListItemDto } from '../../api/improvements.ts'
import { CustomerInputs } from '../../shared/CustomerInputs.tsx'
import { EMPTY_INPUT, inputProblems, type CustomerInput } from '../../shared/customerInput.ts'
import { PAGE_NAMES } from '../../shared/pageNames.ts'
import { goalPageName, kindLabel, shortTime, startErrorMessage } from './labels.ts'
import './improvement.css'

/** AI 개선 시작(직접 입력) + 지난 결과 목록. 진단 결과에서 "AI에게 고쳐 달라고 하기"로 오면 바로 상세 화면으로 간다 */
export function ImprovementListPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState<CustomerInput>(EMPTY_INPUT)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [items, setItems] = useState<ImprovementListItemDto[] | null>(null)
  const [listFailed, setListFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listImprovements(controller.signal).then(setItems).catch((error: unknown) => {
      if (!isAbortError(error)) setListFailed(true)
    })
    return () => controller.abort()
  }, [])

  async function start() {
    setShowErrors(true)
    if (inputProblems(input)) return
    setSubmitting(true)
    setStartError(null)
    try {
      const job = await startImprovement({ goal: input.goal.trim(), persona: input.persona.trim(), goalPage: input.pageKey })
      navigate(`/improvements/${encodeURIComponent(job.improvementId)}`)
    } catch (error) {
      setStartError(startErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="improvement-page">
      <header className="page-header">
        <h1>{PAGE_NAMES.improvement}</h1>
        <p className="page-lead">AI가 막히는 메뉴 이름을 찾아 새 이름을 제안하고, 다른 고객에게 손해가 없는지까지 확인해요. 약 5분 걸려요.</p>
      </header>

      <section className="card" aria-label="AI 개선 시작">
        <CustomerInputs value={input} onChange={setInput} showErrors={showErrors} disabled={submitting} />
        {startError ? <p role="alert" className="error-notice">{startError}</p> : null}
        <button type="button" className="primary" disabled={submitting} onClick={() => void start()}>
          {submitting ? '시작하는 중' : 'AI에게 고쳐 달라고 하기'}
        </button>
        <p className="muted">진단을 먼저 해 보면 어디서 막히는지 같이 볼 수 있어요. <Link to="/">{PAGE_NAMES.diagnose}</Link></p>
      </section>

      <section className="card" aria-label="지난 결과">
        <h2>지난 결과</h2>
        {listFailed ? <p role="alert">지난 결과를 불러오지 못했어요.</p> : items === null ? <p role="status">불러오는 중이에요</p> : items.length === 0 ? (
          <p className="muted">아직 없어요.</p>
        ) : (
          <ul className="improvement-list">
            {items.map((item) => (
              <li key={item.improvementId}>
                <Link to={`/improvements/${encodeURIComponent(item.improvementId)}`}>{itemTitle(item)}</Link>
                <span className="muted"> · {statusText(item)}{item.kind ? ` · ${kindLabel(item.kind)}` : ''}{shortTime(item.createdAt) ? ` · ${shortTime(item.createdAt)}` : ''}</span>
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
  if (s?.afterLabel) return `"${s.beforeLabel ?? ''}" → "${s.afterLabel}"`
  if (item.input) return `${item.input.persona} · ${goalPageName(item.input.goalPage)}`
  return s?.beforeLabel ? `"${s.beforeLabel}" 그대로` : 'AI 개선'
}

function statusText(item: ImprovementListItemDto): string {
  switch (item.status) {
    case 'QUEUED':
    case 'RUNNING': return '진행 중'
    case 'COMPLETED': return item.summary?.afterLabel ? '새 이름 찾음' : '바꿀 이름 없음'
    case 'FAILED': return '끝내지 못함'
    case 'INTERRUPTED': return '중간에 멈춤'
    default: return '확인 필요'
  }
}
