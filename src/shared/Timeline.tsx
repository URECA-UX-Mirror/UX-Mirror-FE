import { useState, type ReactNode } from 'react'
import './timeline.css'

export type StepState = 'done' | 'current' | 'upcoming'

/** 번호가 붙은 세로 단계 목록. 번호는 놓인 순서대로 매긴다 */
export function Timeline({ children, label }: { children: ReactNode; label: string }) {
  return <ol className="tl" aria-label={label}>{children}</ol>
}

/**
 * 단계 하나: 작은 질문 → 큰 답 한 줄 → 덧붙이는 내용.
 * 아직 오지 않은 단계(`upcoming`)는 질문만 흐리게 보인다.
 */
export function TimelineStep({ state, question, answer, tone, children }: {
  state: StepState
  question: string
  /** 큰 답 한 줄. 없으면 질문 아래에 바로 내용이 온다 */
  answer?: ReactNode
  /** 답의 색. 기본은 본문 색 */
  tone?: 'good' | 'bad'
  children?: ReactNode
}) {
  return (
    <li className="tl-step" data-state={state}>
      <span className="tl-dot" aria-hidden="true" />
      <section aria-label={question}>
        <h2 className="tl-question">{question}</h2>
        {state === 'upcoming' ? null : (
          <>
            {answer ? <p className="tl-answer" data-tone={tone}>{answer}</p> : null}
            {children ? <div className="tl-body">{children}</div> : null}
          </>
        )}
      </section>
    </li>
  )
}

/** 글자만 있는 접힘. `lazy`면 펼치기 전에는 안을 그리지 않는다 (스크린샷을 미리 받지 않게) */
export function Disclosure({ title, children, lazy = false }: { title: string; children: ReactNode; lazy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {!lazy || open ? <div className="disclosure-body">{children}</div> : null}
    </details>
  )
}
