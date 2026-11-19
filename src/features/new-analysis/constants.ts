export const SITE = { name: 'MORO MARKET' } as const
export const VERSIONS = [
  { variant: 'before', name: '지금 화면', change: "상단 메뉴 '이용정보'" },
  { variant: 'after', name: '개선안', change: "상단 메뉴 '주문·환불'" },
] as const
export const STEPS = { min: 1, max: 15, default: 8 } as const
export function createExperimentKey() {
  return `exp_${crypto.randomUUID().replaceAll('-', '')}`
}
