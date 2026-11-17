import type { ReactNode } from 'react'

interface SectionTitleProps {
  icon: ReactNode
  title: string
  /** 오른쪽 끝의 보조 문구 */
  aside?: ReactNode
  /** 오른쪽 끝의 버튼 같은 조작 요소 */
  action?: ReactNode
}

/** 카드 첫 줄의 제목 띠: 아이콘 + 제목 + 오른쪽 보조 문구·조작. 모든 화면의 카드가 같은 모양을 쓴다 */
export function SectionTitle({ icon, title, aside, action }: SectionTitleProps) {
  return (
    <div className="section-title">
      <span className="section-icon">{icon}</span>
      <h2>{title}</h2>
      {aside ? <span className="section-aside">{aside}</span> : null}
      {action ?? null}
    </div>
  )
}
