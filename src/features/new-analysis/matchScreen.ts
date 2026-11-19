/** 찾아야 할 화면 하나. MORO MARKET은 `GOAL_SCREENS`, 등록 사이트는 서버가 고를 수 있다고 한 화면에서 만든다 */
export interface GoalScreen {
  pageKey: string
  label: string
  path: string
  /** 도착했는지 확인하는 글자 (화면에는 보이지 않는다) */
  text: string
}

/** MORO MARKET 화면별 낱말. 문장에 이 낱말이 있으면 그 화면을 찾는 것으로 본다 */
export const MORO_KEYWORDS: Record<string, string[]> = {
  refund: ['환불', '반품', '돌려보내', '교환', '취소'],
  orders: ['배송', '주문', '어디쯤', '도착', '조회'],
  mypage: ['쿠폰', '포인트', '적립', '내 정보', '회원', '마이'],
  support: ['문의', '질문', '상담', '고객센터', '도움'],
}

const compact = (text: string) => text.toLowerCase().replace(/\s+/g, '')

/** 화면 이름·확인 글자에서 뽑은 낱말 (두 글자 이상). 등록 사이트는 따로 정한 낱말이 없어 이것으로 맞춘다 */
export function screenWords(screen: GoalScreen): string[] {
  const words = `${screen.label} ${screen.text}`.split(/[\s·/(),&+|-]+/).map(compact).filter((word) => word.length >= 2)
  return [...new Set(words)]
}

/**
 * 문장에서 찾아야 할 화면을 낱말로 고른다 (AI를 쓰지 않는다). 화면마다 문장에 들어 있는 낱말 수를 세어
 * 가장 많은 화면 하나를 고르고, 맞는 낱말이 없거나 1등이 둘 이상이면 고르지 않는다(`null`).
 * `keywords`에 그 화면의 낱말이 있으면 그것만, 없으면 화면 이름·확인 글자의 낱말을 쓴다.
 */
export function matchScreen(sentence: string, screens: readonly GoalScreen[], keywords: Record<string, string[]> = {}): string | null {
  const text = compact(sentence)
  if (!text) return null
  let best: string | null = null
  let bestScore = 0
  let tied = false
  for (const screen of screens) {
    const words = Object.hasOwn(keywords, screen.pageKey) ? keywords[screen.pageKey].map(compact) : screenWords(screen)
    const score = new Set(words.filter((word) => word && text.includes(word))).size
    if (score > bestScore) {
      best = screen.pageKey
      bestScore = score
      tied = false
    } else if (score === bestScore && score > 0) {
      tied = true
    }
  }
  return tied ? null : best
}
