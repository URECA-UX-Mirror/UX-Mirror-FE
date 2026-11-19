/** 한글이 들어 있는지. 서버 문구가 사용자에게 보여 줄 한국어 문장인지 가릴 때 쓴다(영어 예외 문구·코드는 보이지 않는다) */
export const hasHangul = (text: string | null | undefined): boolean => !!text && /[가-힣]/.test(text)

/** 마지막 글자의 받침 번호(0 = 받침 없음). 한글 음절이 아니면 `null` */
function finalOf(word: string): number | null {
  const text = word.trim()
  const code = text.charCodeAt(text.length - 1) - 0xac00
  if (Number.isNaN(code) || code < 0 || code > 11171) return null
  return code % 28
}

/** 낱말 뒤 "로/으로". 받침 없음·ㄹ 받침은 "로", 다른 받침은 "으로", 한글이 아니면 "(으)로" */
export function roOf(word: string): string {
  const final = finalOf(word)
  if (final === null) return '(으)로'
  return final === 0 || final === 8 ? '로' : '으로'
}

/** 낱말 뒤 "을/를". 한글이 아니면 "을(를)" */
export function eulOf(word: string): string {
  const final = finalOf(word)
  if (final === null) return '을(를)'
  return final === 0 ? '를' : '을'
}

/** 낱말 뒤 "은/는". 한글이 아니면 "은(는)" */
export function eunOf(word: string): string {
  const final = finalOf(word)
  if (final === null) return '은(는)'
  return final === 0 ? '는' : '은'
}

/** 이름 하나를 따옴표로 */
export const quote = (label: string) => `'${label}'`
