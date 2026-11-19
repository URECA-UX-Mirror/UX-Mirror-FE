export const SITE = { name: 'MORO MARKET' } as const
export const VERSIONS = [
  { variant: 'before', name: '지금 화면', change: "상단 메뉴 '이용정보'" },
  { variant: 'after', name: '개선안', change: "상단 메뉴 '주문·환불'" },
] as const
/**
 * Run의 버전 표시. Optimizer·자동 개선 검증 Run은 라벨 사이트가 `VERSIONS.change`와 다를 수 있어 고정 변경 문구를 붙이지 않는다.
 * 연결 정보가 없는 일반 Run만 변경 문구를 붙인다. 모르는 `variant`는 원문이다.
 */
export function versionName(variant: string, hasContext: boolean): string {
  const version = VERSIONS.find((item) => item.variant === variant)
  if (!version) return variant
  return hasContext ? version.name : `${version.name} · ${version.change}`
}
export const STEPS = { min: 1, max: 15, default: 8 } as const
/** 직접 입력 길이 제한 (UX-Mirror-BE #42: 하려는 일·고객 200자) */
export const INPUT_LIMITS = { sentence: 200 } as const
export function createExperimentKey() {
  return `exp_${crypto.randomUUID().replaceAll('-', '')}`
}
