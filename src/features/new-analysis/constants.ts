export const SITE = { name: 'MORO MARKET', urls: ['http://127.0.0.1:8001', 'http://127.0.0.1:8002'] } as const
export const VERSIONS = [
  { variant: 'before', name: 'v1 (변경 전)', change: '상단 메뉴: 이용정보' },
  { variant: 'after', name: 'v2 (변경 후)', change: '상단 메뉴: 주문·환불' },
] as const
export const STEPS = { min: 1, max: 15, default: 8 } as const
export function createExperimentKey() {
  return `exp_${crypto.randomUUID().replaceAll('-', '')}`
}
export function isSupportedUrl(value: string) {
  try {
    const url = new URL(value)
    return SITE.urls.some((origin) => url.origin === origin) && url.username === '' && url.password === ''
  } catch { return false }
}
