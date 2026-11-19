/**
 * 사용자가 직접 쓰는 문장(고객이 하려는 일·고객 유형) 검사. BE `api/input_rules.py`와 같은 규칙이라
 * 서버에 보내기 전에 같은 안내를 보인다. 서버도 같은 규칙으로 다시 거절한다.
 */
const MIN_CHARS = 4
const MIN_LETTERS = 2
const MAX_SAME_CHAR_RATIO = 0.6
export const MAX_SENTENCE = 200
/** AI에게 넘기면 안 되는 단어 (BE `uxm/leak.py` FORBIDDEN, 대소문자 그대로 비교) */
const FORBIDDEN = ['variant', 'before', 'after', 'testMode', 'testmode', 'nochange', 'deadend', 'experimentKey', 'data-test-goal', 'refund-entry', 'semanticKey', 'menu_', 'goalId']
const LETTER = /[A-Za-z가-힣ㄱ-ㆎ]/g

export function sentenceProblem(text: string, _field: string): string | null {
  if (!text.trim()) return '내용을 적어 주세요.'
  const compact = text.replace(/\s+/g, '')
  if (compact.length > MAX_SENTENCE) return `${MAX_SENTENCE}자까지 쓸 수 있어요.`
  if (compact.length < MIN_CHARS) return `조금 더 자세히 적어 주세요. (${MIN_CHARS}자 이상)`
  if ((compact.match(LETTER) ?? []).length < MIN_LETTERS) return '기호나 숫자 말고 글로 적어 주세요.'
  const counts = new Map<string, number>()
  for (const ch of compact) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  if (Math.max(...counts.values()) / compact.length > MAX_SAME_CHAR_RATIO) return '알아볼 수 있는 문장으로 적어 주세요.'
  const words = FORBIDDEN.filter((w) => text.includes(w))
  if (words.length) return `쓸 수 없는 단어가 있어요: ${words.join(', ')}`
  return null
}
