import { isApiError } from '../api/client.ts'
import { hasHangul } from './hangul.ts'

/** 화면에 그대로 보여도 되는 영문 (서비스·예시 쇼핑몰 이름) */
const ALLOWED_WORDS = /MORO MARKET|UX MIRROR|AI/g

/**
 * 서버 안내 문장을 화면에 보여도 되는지. 한글 문장이고, 경로(`/shop/x`)나 필드·환경변수 같은 영문 식별자(3글자 이상)가 없어야 한다.
 * 보여도 되면 그 문장, 아니면 `null`.
 */
export function plainServerMessage(message: string | null | undefined): string | null {
  const text = message?.trim()
  if (!text || !hasHangul(text)) return null
  const rest = text.replace(ALLOWED_WORDS, '')
  if (/\/[A-Za-z0-9_.{}-]/.test(rest) || /[A-Za-z_]{3,}/.test(rest)) return null
  return text
}

/** 코드마다 정해 둔 안내. 서버 문장 대신 이것을 보인다 */
const FIXED: Record<string, string> = {
  RUN_ALREADY_ACTIVE: '다른 진단이 돌고 있어요. 끝나면 시작할 수 있어요.',
  IMPROVEMENTS_DISABLED: '지금은 개선안을 받아 볼 수 없어요.',
  SITE_NOT_CONFIGURED: '사이트가 아직 준비되지 않았어요. 잠시 뒤 다시 해 주세요.',
}

/**
 * 시작 요청 실패 안내. 알려진 코드는 정해 둔 문장, 그 밖에는 서버 문장이 깨끗한 한글일 때만 그대로,
 * 아니면 짧은 대체 문장(`fallback`)이다. 코드·경로·영문 원문은 보이지 않는다.
 */
export function startFailureMessage(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback
  const code = error.code ?? ''
  if (Object.hasOwn(FIXED, code)) return FIXED[code]
  const plain = plainServerMessage(error.message)
  if (code === 'CONTRACT_VALIDATION_ERROR') return plain ?? '입력을 다시 확인해 주세요.'
  return plain ?? fallback
}
